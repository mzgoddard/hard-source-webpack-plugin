const nodeObjectHash = require('node-object-hash');

const pluginCompat = require('./util/plugin-compat');
const relateContext = require('./util/relate-context');

class ModuleResolverCache {
  apply(compiler) {
    let moduleResolveCache = {};

    let moduleResolveCacheChange = [];

    let moduleResolveCacheSerializer;

    const compilerHooks = pluginCompat.hooks(compiler);

    compilerHooks._hardSourceCreateSerializer.tap(
      'HardSource - ModuleResolverCache',
      (cacheSerializerFactory, cacheDirPath) => {
        moduleResolveCacheSerializer = cacheSerializerFactory.create({
          name: 'module-resolve',
          type: 'data',
          cacheDirPath,
        });
      },
    );

    compilerHooks._hardSourceResetCache.tap(
      'HardSource - ModuleResolverCache',
      () => {
        moduleResolveCache = {};
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
          const parsed = JSON.parse(key);
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

        function contextNormalModuleResolve(compiler, resolved) {
          if (typeof resolved === 'string') {
            resolved = JSON.parse(resolved);
          }
          if (resolved.type === 'context') {
            return Object.assign({}, resolved, {
              identifier: contextNormalModuleId(compiler, resolved.identifier),
              resource: contextNormalRequest(compiler, resolved.resource),
            });
          }
          return Object.assign({}, resolved, {
            context: contextNormalRequest(compiler, resolved.context),
            request: contextNormalRequest(compiler, resolved.request),
            userRequest: contextNormalRequest(compiler, resolved.userRequest),
            rawRequest: contextNormalRequest(compiler, resolved.rawRequest),
            resource: contextNormalRequest(compiler, resolved.resource),
            loaders: resolved.loaders.map(loader =>
              Object.assign({}, loader, {
                loader: contextNormalPath(compiler, loader.loader),
              }),
            ),
          });
        }

        return moduleResolveCacheSerializer
          .read()
          .then(contextKeys(compiler, contextNormalModuleResolveKey))
          .then(contextValues(compiler, contextNormalModuleResolve))
          .then(copyWithDeser.bind(null, moduleResolveCache));
      },
    );

    compilerHooks._hardSourceVerifyCache.tapPromise(
      'HardSource - ModuleResolverCache',
      () =>
        compiler.__hardSource_missingVerify.then(() => {
          const missingCache = compiler.__hardSource_missingCache;

          // Invalidate resolve cache items.
          Object.keys(moduleResolveCache).forEach(key => {
            const resolveKey = JSON.parse(key);
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
          return Promise.resolve();
        }

        const moduleResolveOps = [];

        function relateNormalModuleResolveKey(compiler, key) {
          const parsed = JSON.parse(key);
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
          return Object.assign({}, resolved, {
            context: relateNormalRequest(compiler, resolved.context),
            request: relateNormalRequest(compiler, resolved.request),
            userRequest: relateNormalRequest(compiler, resolved.userRequest),
            rawRequest: relateNormalRequest(compiler, resolved.rawRequest),
            resource: relateNormalRequest(compiler, resolved.resource),
            loaders: resolved.loaders.map(loader =>
              Object.assign({}, loader, {
                loader: relateNormalPath(compiler, loader.loader),
              }),
            ),
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
                ? JSON.stringify(
                    relateNormalModuleResolve(
                      compiler,
                      moduleResolveCache[key],
                    ),
                  )
                : null,
            });
          });

        moduleResolveCacheChange = [];

        return moduleResolveCacheSerializer.write(moduleResolveOps);
      },
    );
  }
}

module.exports = ModuleResolverCache;
