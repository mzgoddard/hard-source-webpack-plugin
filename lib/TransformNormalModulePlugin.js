const NormalModule = require('webpack/lib/NormalModule');
const Module = require('webpack/lib/Module');

const nodeObjectHash = require('node-object-hash');

const logMessages = require('./util/log-messages');
const {
  relateNormalPath,
  relateNormalRequest,
  relateNormalPathSet,
  relateNormalLoaders,
} = require('./util/relate-context');
const pluginCompat = require('./util/plugin-compat');
const serial = require('./util/serial');

const serialResolveRequest = serial.created({
  context: serial.path,
  request: serial.request,
});

const serialResolved = serial.created({
  // context: serial.path,
  // request: serial.request,
  // userRequest: serial.request,
  // rawRequest: serial.request,
  resource: serial.request,
  resolveOptions: serial.identity,
  // loaders: serial.loaders,
});

const serialJson = {
  freeze(arg, value, extra) {
    return JSON.parse(arg);
  },
  thaw(arg, frozen, extra) {
    return JSON.stringify(arg);
  },
};

const serialMap = serial.map;

const serialResolvedMap = serial.map(
  serial.pipe(
    { freeze: serialJson.freeze, thaw: serial.identity.thaw },
    serialResolveRequest,
    { freeze: serial.identity.freeze, thaw: serialJson.thaw },
  ),
  serialResolved,
);

const serialResourceHashMap = serial.map(serial.request, serial.identity);

const serialNormalConstructor4 = serial.constructed(NormalModule, {
  data: serial.pipe(
    { freeze: (arg, module) => module, thaw: arg => arg },
    serial.created({
      type: serial.identity,
      request: serial.request,
      userRequest: serial.request,
      rawRequest: serial.request,
      loaders: serial.loaders,
      resource: serial.path,
      parser: serial.parser,
      generator: serial.generator,
      resolveOptions: serial.identity,
    }),
  ),
});

const serialNormalModuleExtra4 = {
  freeze() {},
  thaw(arg, frozen, extra, methods) {
    extra.module = arg;
    return arg;
  },
};

const serialNormalIdentifier4 = {
  freeze(arg, module, extra, methods) {
    return serial.request.freeze(module.identifier(), null, extra, methods);
  },
  thaw(arg) {
    return arg;
  },
};

const serialNormalAssigned4 = serial.assigned({
  factoryMeta: serial.identity,
  issuer: serial.pipe(
    {
      freeze(arg, { issuer }) {
        return issuer && typeof issuer === 'object'
          ? issuer.identifier()
          : issuer;
      },
      thaw(arg, frozen, extra) {
        return arg;
      },
    },
    serial.request,
    {
      freeze(arg) {
        return arg;
      },
      thaw(arg, frozen, { compilation }) {
        if (compilation.modules) {
          for (const module of compilation.modules) {
            if (
              module &&
              typeof module.identifier === 'function' &&
              module.identifier() === arg
            ) {
              return module;
            }
          }
          for (const cacheId in compilation.cache) {
            const module = compilation.cache[cacheId];
            if (
              module &&
              typeof module.identifier === 'function' &&
              module.identifier() === arg
            ) {
              return module;
            }
          }
        }
        return arg;
      },
    },
  ),
  useSourceMap: serial.identity,
  lineToLine: serial.identity,
});

const serialNormalOriginExtra4 = {
  freeze() {},
  thaw(arg, frozen, extra) {
    if (typeof arg.issuer === 'object') {
      extra.origin = arg.issuer;
    }
    return arg;
  },
};

const serialNormalBuild4 = serial.assigned({
  built: serial.identity,
  buildTimestamp: serial.identity,
  buildMeta: serial.identity,
  buildInfo: serial.created({
    assets: serial.moduleAssets,
    cacheable: serial.identity,
    contextDependencies: serial.pathSet,
    exportsArgument: serial.identity,
    fileDependencies: serial.pathSet,
    harmonyModule: serial.identity,
    jsonData: serial.identity,
    strict: serial.identity,
  }),
  warnings: serial.moduleWarning,
  errors: serial.moduleError,
  _source: serial.source,
  _buildHash: serial.identity,
  hash: serial.identity,
  _lastSuccessfulBuildMeta: serial.identity,

  __hardSource_resolved: serialResolvedMap,
  __hardSource_oldHashes: serial.pipe(
    {
      freeze(arg, module, extra) {
        const obj = {};
        const cachedMd5s = extra.compilation.__hardSourceFileMd5s;

        for (const file of module.buildInfo.fileDependencies) {
          obj[file] = cachedMd5s[file];
        }
        for (const dir of module.buildInfo.contextDependencies) {
          obj[dir] = cachedMd5s[dir];
        }

        return obj;
      },
      thaw: serial.identity.thaw,
    },
    serialResourceHashMap,
  ),
});

const serialNormalError4 = {
  freeze() {},
  thaw(arg, module, extra) {
    arg.error = arg.errors[0] || null;
    return arg;
  },
};

const serialNormalSourceExtra4 = {
  freeze() {},
  thaw(arg, module, extra) {
    extra.source = arg._source;
    return arg;
  },
};

const serialNormalSource4 = serial.assigned({
  _cachedSource: serial.source,
  _cachedSourceHash: serial.identity,
  renderedHash: serial.identity,
});

const serialNormalModule4PreBuild = serial.serial('NormalModule', {
  constructor: serialNormalConstructor4,
  setModuleExtra: serialNormalModuleExtra4,
  identifier: serialNormalIdentifier4,
  assigned: serialNormalAssigned4,
  setOriginExtra: serialNormalOriginExtra4,
});

const serialNormalModule4PostBuild = serial.serial('NormalModule', {
  build: serialNormalBuild4,
  dependencyBlock: serial.dependencyBlock,
  setError: serialNormalError4,
  setSourceExtra: serialNormalSourceExtra4,
  source: serialNormalSource4,
});

const serialNormalModule4 = serial.serial('NormalModule', {
  constructor: serialNormalConstructor4,
  setModuleExtra: serialNormalModuleExtra4,
  identifier: serialNormalIdentifier4,
  assigned: serialNormalAssigned4,
  setOriginExtra: serialNormalOriginExtra4,
  build: serialNormalBuild4,
  dependencyBlock: serial.dependencyBlock,
  setError: serialNormalError4,
  setSourceExtra: serialNormalSourceExtra4,
  source: serialNormalSource4,
});

const needRebuild4 = function() {
  if (this.error) {
    this.cacheItem.invalid = true;
    this.cacheItem.invalidReason = 'error building';
    return true;
  }
  const fileHashes = this.__hardSourceFileMd5s;
  const cachedHashes = this.__hardSourceCachedMd5s;
  const resolvedLast = this.__hardSource_resolved;
  const missingCache = this.__hardSource_missingCache;

  for (const file of this.buildInfo.fileDependencies) {
    if (!cachedHashes[file] || fileHashes[file] !== cachedHashes[file]) {
      this.cacheItem.invalid = true;
      this.cacheItem.invalidReason = 'md5 mismatch';
      return true;
    }
  }
  for (const dir of this.buildInfo.contextDependencies) {
    if (!cachedHashes[dir] || fileHashes[dir] !== cachedHashes[dir]) {
      this.cacheItem.invalid = true;
      this.cacheItem.invalidReason = 'md5 mismatch';
      return true;
    }
  }

  let resolvedNeedRebuild = false;
  for (const _resolveKey in resolvedLast) {
    const resolveKey = JSON.parse(_resolveKey);
    const resolved = resolvedLast[_resolveKey];
    let normalId = 'normal';
    if (resolved.resolveOptions) {
      normalId = `normal-${new nodeObjectHash({ sort: false }).hash(
        resolved.resolveOptions,
      )}`;
    }
    const resolvedMissing =
      missingCache[normalId] &&
      missingCache[normalId][
        JSON.stringify([resolveKey.context, resolved.resource.split('?')[0]])
      ];
    if (!resolvedMissing || resolvedMissing.invalid) {
      resolved.invalid = true;
      resolved.invalidReason = `resolved normal invalid${
        resolvedMissing
          ? ` ${resolvedMissing.invalidReason}`
          : ': resolve entry not in cache'
      }`;
      resolvedNeedRebuild = true;
    }
  }
  return resolvedNeedRebuild;
};

const serialNormalModule3 = serial.serial('NormalModule', {
  constructor: serial.constructed(NormalModule, {
    request: serial.request,
    userRequest: serial.request,
    rawRequest: serial.request,
    loaders: serial.loaders,
    resource: serial.path,
    parser: serial.parser,
  }),

  setModuleExtra: serialNormalModuleExtra4,
  // Used internally by HardSource
  identifier: serialNormalIdentifier4,

  assigned: serial.assigned({
    issuer: serial.pipe(
      {
        freeze(arg, { issuer }) {
          return issuer && typeof issuer === 'object'
            ? issuer.identifier()
            : issuer;
        },
        thaw(arg, frozen, extra) {
          return arg;
        },
      },
      serial.request,
      {
        freeze(arg) {
          return arg;
        },
        thaw(arg, frozen, { compilation }) {
          if (compilation.modules) {
            for (const module of compilation.modules) {
              if (
                module &&
                typeof module.identifier === 'function' &&
                module.identifier() === arg
              ) {
                return module;
              }
            }
            for (const cacheId in compilation.cache) {
              const module = compilation.cache[cacheId];
              if (
                module &&
                typeof module.identifier === 'function' &&
                module.identifier() === arg
              ) {
                return module;
              }
            }
          }
          return arg;
        },
      },
    ),
    useSourceMap: serial.identity,
    lineToLine: serial.identity,
  }),

  setOriginExtra: {
    freeze() {},
    thaw(arg, frozen, extra) {
      if (typeof arg.issuer === 'object') {
        extra.origin = arg.issuer;
      }
      return arg;
    },
  },

  build: serial.assigned({
    built: serial.identity,
    buildTimestamp: serial.identity,
    cacheable: serial.identity,
    meta: serial.identity,
    assets: serial.moduleAssets,
    fileDependencies: serial.pathArray,
    contextDependencies: serial.pathArray,
    harmonyModule: serial.identity,
    strict: serial.identity,
    exportsArgument: serial.identity,
    warnings: serial.moduleWarning,
    errors: serial.moduleError,
    _source: serial.source,

    __hardSource_resolved: serialResolvedMap,
    __hardSource_oldHashes: serial.pipe(
      {
        freeze(arg, module, extra) {
          const obj = {};
          const cachedMd5s = extra.compilation.__hardSourceCachedMd5s;

          for (const file of module.fileDependencies) {
            obj[file] = cachedMd5s[file];
          }
          for (const dir of module.contextDependencies) {
            obj[dir] = cachedMd5s[dir];
          }

          return obj;
        },
        thaw: serial.identity.thaw,
      },
      serialResourceHashMap,
    ),
  }),

  hash: {
    freeze(arg, module, { compilation }, methods) {
      return module.getHashDigest(compilation.dependencyTemplates);
    },
    thaw(arg) {
      return arg;
    },
  },

  dependencyBlock: serial.dependencyBlock,

  setError: {
    freeze() {},
    thaw(arg, module, extra) {
      arg.error = arg.errors[0] || null;
      return arg;
    },
  },

  setSourceExtra: {
    freeze() {},
    thaw(arg, module, extra) {
      extra.source = arg._source;
      return arg;
    },
  },

  source: serial.assigned({
    _cachedSource: serial.created({
      source: serial.source,
      hash: serial.identity,
    }),
  }),
});

const needRebuild3 = function() {
  if (this.error) {
    this.cacheItem.invalid = true;
    this.cacheItem.invalidReason = 'error building';
    return true;
  }
  const fileHashes = this.__hardSourceFileMd5s;
  const cachedHashes = this.__hardSourceCachedMd5s;
  const resolvedLast = this.__hardSource_resolved;
  const missingCache = this.__hardSource_missingCache;

  for (const file of this.fileDependencies) {
    if (!cachedHashes[file] || fileHashes[file] !== cachedHashes[file]) {
      this.cacheItem.invalid = true;
      this.cacheItem.invalidReason = 'md5 mismatch';
      return true;
    }
  }
  for (const dir of this.contextDependencies) {
    if (!cachedHashes[dir] || fileHashes[dir] !== cachedHashes[dir]) {
      this.cacheItem.invalid = true;
      this.cacheItem.invalidReason = 'md5 mismatch';
      return true;
    }
  }

  let resolvedNeedRebuild = false;
  for (const _resolveKey in resolvedLast) {
    const resolveKey = JSON.parse(_resolveKey);
    const resolved = resolvedLast[_resolveKey];
    let normalId = 'normal';
    if (resolved.resolveOptions) {
      normalId = `normal-${new nodeObjectHash({ sort: false }).hash(
        resolved.resolveOptions,
      )}`;
    }
    const resolvedMissing =
      missingCache[normalId] &&
      missingCache[normalId][
        JSON.stringify([resolveKey.context, resolved.resource.split('?')[0]])
      ];
    if (!resolvedMissing || resolvedMissing.invalid) {
      resolved.invalid = true;
      resolved.invalidReason = `resolved normal invalid${
        resolvedMissing
          ? ` ${resolvedMissing.invalidReason}`
          : ': resolve entry not in cache'
      }`;
      resolvedNeedRebuild = true;
    }
  }

  return resolvedNeedRebuild;
};

const cacheable = module =>
  module.buildInfo ? module.buildInfo.cacheable : module.cacheable;

class TransformNormalModulePlugin {
  constructor(options) {
    this.options = options || {};
  }

  apply(compiler) {
    const schema = this.options.schema;

    let serialNormalModule = serialNormalModule4;
    let needRebuild = needRebuild4;
    if (schema < 4) {
      serialNormalModule = serialNormalModule3;
      needRebuild = needRebuild3;
    }

    let createHash;
    if (schema >= 4) {
      createHash = require('webpack/lib/util/createHash');
    }

    let freeze;
    let mapFreeze;
    let _methods;

    pluginCompat.tap(
      compiler,
      '_hardSourceMethods',
      'TransformNormalModulePlugin',
      methods => {
        _methods = methods;

        // store = methods.store;
        // fetch = methods.fetch;
        freeze = methods.freeze;
        // thaw = methods.thaw;
        mapFreeze = methods.mapFreeze;
        // mapThaw = methods.mapThaw;
      },
    );

    pluginCompat.tap(
      compiler,
      'compilation',
      'TransformNormalModulePlugin',
      compilation => {
        pluginCompat.tap(
          compilation,
          'succeedModule',
          'TransformNormalModulePlugin',
          module => {
            if (module instanceof NormalModule) {
              try {
                module._dependencyBlock = freeze(
                  'DependencyBlock',
                  null,
                  module,
                  {
                    module,
                    parent: module,
                    compilation,
                  },
                );
              } catch (e) {
                logMessages.moduleFreezeError(compilation, module, e);
              }
            }
          },
        );
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceFreezeModule',
      'TransformNormalModulePlugin',
      (frozen, module, extra) => {
        // Set hash if it was not set.
        if (
          schema === 4 &&
          module instanceof NormalModule &&
          module.buildTimestamp &&
          !module.hash
        ) {
          const outputOptions = extra.compilation.outputOptions;
          const hashFunction = outputOptions.hashFunction;
          const hashDigest = outputOptions.hashDigest;
          const hashDigestLength = outputOptions.hashDigestLength;

          if (module.buildInfo && module._initBuildHash) {
            module._initBuildHash(extra.compilation);
          }

          const moduleHash = createHash(hashFunction);
          module.updateHash(moduleHash);
          module.hash = moduleHash.digest(hashDigest);
          module.renderedHash = module.hash.substr(0, hashDigestLength);
          if (module._cachedSource) {
            module._cachedSourceHash = module.getHashDigest(
              extra.compilation.dependencyTemplates,
            );
          }
        }

        if (
          module.request &&
          (cacheable(module) || !module.built) &&
          module instanceof NormalModule &&
          (!frozen ||
            (schema >= 4 && module.hash !== frozen.build.hash) ||
            (schema < 4 &&
              module.getHashDigest(extra.compilation.dependencyTemplates) !==
                frozen.hash))
        ) {
          const compilation = extra.compilation;

          if (module.cacheItem) {
            module.cacheItem.invalid = false;
            module.cacheItem.invalidReason = null;
          }

          let serialModule = serialNormalModule;
          if (!module.built) {
            serialModule = serialNormalModule4PreBuild;
          }
          const f = serialModule.freeze(
            null,
            module,
            {
              module,
              compilation,
            },
            _methods,
          );
          // The saved dependencies may not be the ones derived in the hash. This is
          // alright, in such a case the dependencies were altered before the source
          // was rendered. The dependencies should be modified a second time, if
          // they are in the same way they'll match. If they are not modified in the
          // same way, then it'll correctly rerender.
          if (module._dependencyBlock) {
            f.dependencyBlock = module._dependencyBlock;
          }
          return f;
        }

        return frozen;
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceThawModule',
      'TransformNormalModulePlugin thaw',
      (module, frozen, { compilation, normalModuleFactory }) => {
        if (frozen.type === 'NormalModule') {
          let m;
          if (module === null) {
            let serialModule = serialNormalModule;
            if (!frozen.build || !frozen.build.built) {
              serialModule = serialNormalModule4PreBuild;
            }
            m = serialModule.thaw(
              null,
              frozen,
              {
                state: { imports: {} },
                compilation: compilation,
                normalModuleFactory: normalModuleFactory,
              },
              _methods,
            );
          } else {
            m = serialNormalModule4PostBuild.thaw(
              module,
              frozen,
              {
                state: { imports: {} },
                compilation: compilation,
                normalModuleFactory: normalModuleFactory,
              },
              _methods,
            );
          }

          m.cacheItem = frozen;
          m.__hardSourceFileMd5s = compilation.__hardSourceFileMd5s;
          m.__hardSourceCachedMd5s = compilation.__hardSourceCachedMd5s;
          m.__hardSource_missingCache = compiler.__hardSource_missingCache;
          m.needRebuild = needRebuild;

          // Unbuild if there is no cache. The module will be rebuilt. Not
          // unbuilding will lead to double dependencies.
          if (m.built && schema === 4 && !compilation.cache) {
            m.unbuild();
          }
          // Side load into the cache if something for this identifier isn't already
          // there.
          else if (
            m.built &&
            compilation.cache &&
            !compilation.cache[`m${m.identifier()}`]
          ) {
            compilation.cache[`m${m.identifier()}`] = m;
          }

          return m;
        }
        return module;
      },
    );
  }
}

module.exports = TransformNormalModulePlugin;
