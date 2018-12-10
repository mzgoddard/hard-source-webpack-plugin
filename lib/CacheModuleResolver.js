const nodeObjectHash = require('node-object-hash');
const parseJson = require('parse-json');

const serial = require('./util/serial');
const pluginCompat = require('./util/plugin-compat');
const relateContext = require('./util/relate-context');
const { parityCacheFromCache, pushParityWriteOps } = require('./util/parity');

const serialJsonKey = {
  freeze(arg, value, extra) {
    return JSON.parse(arg);
  },
  thaw(arg, frozen, extra) {
    return JSON.stringify(arg);
  },
};

const serialJson = {
  freeze(arg, value, extra) {
    return JSON.stringify(arg);
  },
  thaw(arg, frozen, extra) {
    return JSON.parse(arg);
  },
};

const serialObjectAssign = serial.objectAssign;

const serialResolveOptionsKey = serialObjectAssign({
  context: serial.path,
  userRequest: serial.request,
  options: serialObjectAssign({
    request: serial.request,
  }),
});

const serialResolveKey = serialObjectAssign({
  context: serial.path,
  request: serial.request,
});

const serialNormalModuleResolveKey = serial.pipe(
  serialJsonKey,
  {
    freeze(arg, key, extra) {
      if (Array.isArray(arg)) {
        return [
          arg[0],
          serial.path.freeze(arg[1], arg[1], extra),
          serial.request.freeze(arg[2], arg[2], extra),
        ];
      } else if (!arg.request) {
        return serialResolveOptionsKey.freeze(arg, arg, extra);
      } else {
        return serialResolveKey.freeze(arg, arg, extra);
      }
    },
    thaw(arg, frozen, extra) {
      if (Array.isArray(arg)) {
        return [
          arg[0],
          serial.path.thaw(arg[1], arg[1], extra),
          serial.request.thaw(arg[2], arg[2], extra),
        ];
      } else if (!arg.request) {
        return serialResolveOptionsKey.thaw(arg, arg, extra);
      } else {
        return serialResolveKey.thaw(arg, arg, extra);
      }
    },
  },
  serialJson,
);

const serialNormalModuleId = {
  freeze(arg, module, extra) {
    return (
      id.substring(0, 24) + serial.request.freeze(id.substring(24), id, extra)
    );
  },
  thaw(arg, frozen, extra) {
    return (
      id.substring(0, 24) + serial.request.thaw(id.substring(24), id, extra)
    );
  },
};

const serialResolveContext = serialObjectAssign({
  identifier: serialNormalModuleId,
  resource: serialNormalModuleId,
});

const serialResolveNormal = serialObjectAssign({
  context: serial.path,
  request: serial.request,
  userRequest: serial.request,
  rawRequest: serial.request,
  resource: serial.request,
  loaders: serial.loaders,
  resourceResolveData: serial.objectAssign({
    context: serial.created({
      issuer: serial.request,
      resolveOptions: serial.identity,
    }),
    path: serial.path,
    request: serial.request,
    descriptionFilePath: serial.path,
    descriptionFileRoot: serial.path,
  }),
});

const serialResolve = {
  freeze(arg, module, extra) {
    if (arg.type === 'context') {
      return serialResolveContext.freeze(arg, arg, extra);
    }
    return serialResolveNormal.freeze(arg, arg, extra);
  },
  thaw(arg, frozen, extra) {
    if (arg.type === 'context') {
      return serialResolveContext.thaw(arg, arg, extra);
    }
    return serialResolveNormal.thaw(arg, arg, extra);
  },
};

class ModuleResolverCache {
  apply(compiler) {
    let moduleResolveCache = {};
    let parityCache = {};

    let moduleResolveCacheChange = [];

    let moduleResolveCacheSerializer;

    const compilerHooks = pluginCompat.hooks(compiler);

    compilerHooks._hardSourceCreateSerializer.tap(
      'HardSource - ModuleResolverCache',
      (cacheSerializerFactory, cacheDirPath) => {
        moduleResolveCacheSerializer = cacheSerializerFactory.create({
          name: 'module-resolve',
          type: 'data',
          autoParse: true,
          cacheDirPath,
        });
      },
    );

    compilerHooks._hardSourceResetCache.tap(
      'HardSource - ModuleResolverCache',
      () => {
        moduleResolveCache = {};
        parityCache = {};
      },
    );

    compilerHooks._hardSourceReadCache.tapPromise(
      'HardSource - ModuleResolverCache',
      ({
        contextKeys,
        contextValues,
        contextNormalPath,
        contextNormalRequest,
        contextNormalModuleId,
        copyWithDeser,
      }) => {
        function contextNormalModuleResolveKey(compiler, key) {
          if (key.startsWith('__hardSource_parityToken')) {
            return key;
          }
          const parsed = parseJson(key);
          if (Array.isArray(parsed)) {
            return JSON.stringify([
              parsed[0],
              contextNormalPath(compiler, parsed[1]),
              parsed[2],
            ]);
          } else {
            return JSON.stringify(
              Object.assign({}, parsed, {
                context: contextNormalPath(compiler, parsed.context),
              }),
            );
          }
        }

        function contextNormalModuleResolve(compiler, resolved, key) {
          if (key.startsWith('__hardSource_parityToken')) {
            parityCache[key] = resolved;
            return;
          }
          if (typeof resolved === 'string') {
            resolved = parseJson(resolved);
          }
          if (resolved.type === 'context') {
            return Object.assign({}, resolved, {
              identifier: contextNormalModuleId(compiler, resolved.identifier),
              resource: contextNormalRequest(compiler, resolved.resource),
            });
          }
          return serialResolveNormal.thaw(resolved, resolved, {
            compiler,
          });
        }

        return moduleResolveCacheSerializer
          .read()
          .then(contextKeys(compiler, contextNormalModuleResolveKey))
          .then(contextValues(compiler, contextNormalModuleResolve))
          .then(copyWithDeser.bind(null, moduleResolveCache));
      },
    );

    compilerHooks._hardSourceParityCache.tap(
      'HardSource - ModuleResolverCache',
      parityRoot => {
        parityCacheFromCache('ModuleResolver', parityRoot, parityCache);
      },
    );

    compilerHooks._hardSourceVerifyCache.tapPromise(
      'HardSource - ModuleResolverCache',
      () =>
        compiler.__hardSource_missingVerify.then(() => {
          const missingCache = compiler.__hardSource_missingCache;

          // Invalidate resolve cache items.
          Object.keys(moduleResolveCache).forEach(key => {
            const resolveKey = parseJson(key);
            const resolveItem = moduleResolveCache[key];
            let normalId = 'normal';
            if (resolveItem.resolveOptions) {
              normalId = `normal-${new nodeObjectHash({ sort: false }).hash(
                resolveItem.resolveOptions,
              )}`;
            }
            if (resolveItem.type === 'context') {
              const contextMissing =
                missingCache.context[
                  JSON.stringify([
                    resolveKey.context,
                    resolveItem.resource.split('?')[0],
                  ])
                ];
              if (!contextMissing || contextMissing.invalid) {
                resolveItem.invalid = true;
                resolveItem.invalidReason = 'resolved context invalid';
              }
            } else {
              const normalMissing =
                missingCache[normalId] &&
                missingCache[normalId][
                  JSON.stringify([
                    resolveKey[1],
                    resolveItem.resource.split('?')[0],
                  ])
                ];
              if (!normalMissing || normalMissing.invalid) {
                resolveItem.invalid = true;
                resolveItem.invalidReason = `resolved normal invalid${
                  normalMissing
                    ? ` ${normalMissing.invalidReason}`
                    : ': resolve entry not in cache'
                }`;
              }
              resolveItem.loaders.forEach(loader => {
                if (typeof loader === 'object') {
                  if (loader.loader != null) {
                    loader = loader.loader;
                  } else {
                    // Convert { "0": "b", "1": "a", "2": "r" } into "bar"
                    loader = Object.assign([], loader).join('');
                  }
                }
                // Loaders specified in a dependency are searched for from the
                // context of the module containing that dependency.
                let loaderMissing =
                  missingCache.loader[
                    JSON.stringify([resolveKey[1], loader.split('?')[0]])
                  ];
                if (!loaderMissing) {
                  // webpack searches for rule based loaders from the project
                  // context.
                  loaderMissing =
                    missingCache.loader[
                      JSON.stringify([
                        // compiler may be a Watching instance, which refers to the
                        // compiler
                        (compiler.options || compiler.compiler.options).context,
                        loader.split('?')[0],
                      ])
                    ];
                }
                if (!loaderMissing || loaderMissing.invalid) {
                  resolveItem.invalid = true;
                  resolveItem.invalidReason = 'resolved loader invalid';
                }
              });
            }
          });
        }),
    );

    compilerHooks.compilation.tap(
      'HardSource - ModuleResolverCache',
      compilation => {
        compilation.__hardSourceModuleResolveCache = moduleResolveCache;
        compilation.__hardSourceModuleResolveCacheChange = moduleResolveCacheChange;
      },
    );

    compilerHooks._hardSourceWriteCache.tapPromise(
      'HardSource - ModuleResolverCache',
      (
        compilation,
        { relateNormalPath, relateNormalModuleId, relateNormalRequest },
      ) => {
        if (compilation.compiler.parentCompilation) {
          const moduleResolveOps = [];
          pushParityWriteOps(compilation, moduleResolveOps);

          return moduleResolveCacheSerializer.write(moduleResolveOps);
        }

        const moduleResolveOps = [];

        function relateNormalModuleResolveKey(compiler, key) {
          const parsed = parseJson(key);
          if (Array.isArray(parsed)) {
            return JSON.stringify([
              parsed[0],
              relateNormalPath(compiler, parsed[1]),
              relateContext.relateAbsoluteRequest(parsed[1], parsed[2]),
            ]);
          } else {
            if (!parsed.request) {
              return JSON.stringify(
                Object.assign({}, parsed, {
                  context: relateNormalPath(compiler, parsed.context),
                  userRequest: relateContext.relateAbsoluteRequest(
                    parsed.context,
                    parsed.userRequest,
                  ),
                  options: Object.assign({}, parsed.options, {
                    request: relateContext.relateAbsoluteRequest(
                      parsed.context,
                      parsed.options.request,
                    ),
                  }),
                }),
              );
            } else {
              return JSON.stringify(
                Object.assign({}, parsed, {
                  context: relateNormalPath(compiler, parsed.context),
                  request: relateContext.relateAbsoluteRequest(
                    parsed.context,
                    parsed.request,
                  ),
                }),
              );
            }
          }
        }

        function relateNormalModuleResolve(compiler, resolved) {
          if (resolved.type === 'context') {
            return Object.assign({}, resolved, {
              identifier: relateNormalModuleId(compiler, resolved.identifier),
              resource: relateNormalRequest(compiler, resolved.resource),
            });
          }
          return serialResolveNormal.freeze(resolved, resolved, {
            compiler,
          });
        }

        moduleResolveCacheChange
          .reduce((carry, value) => {
            if (!carry.includes(value)) {
              carry.push(value);
            }
            return carry;
          }, [])
          .forEach(key => {
            // console.log(key, moduleResolveCache[key]);
            // moduleResolveCache[key] && console.log(relateNormalModuleResolveKey(compiler, key));
            // moduleResolveCache[key] && console.log(relateNormalModuleResolve(compiler, moduleResolveCache[key]));
            moduleResolveOps.push({
              key: relateNormalModuleResolveKey(compiler, key),
              value: moduleResolveCache[key]
                ? relateNormalModuleResolve(compiler, moduleResolveCache[key])
                : null,
            });
          });

        moduleResolveCacheChange = [];

        pushParityWriteOps(compilation, moduleResolveOps);

        return moduleResolveCacheSerializer.write(moduleResolveOps);
      },
    );
  }
}

module.exports = ModuleResolverCache;
