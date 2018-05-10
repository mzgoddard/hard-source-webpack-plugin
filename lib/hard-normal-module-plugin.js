const NormalModule = require('webpack/lib/NormalModule');
const Module = require('webpack/lib/Module');

const logMessages = require('./util/log-messages');
const {
  relateNormalPath,
  relateNormalRequest,
  relateNormalPathSet,
  relateNormalLoaders
} = require('./util/relate-context');
const pluginCompat = require('./util/plugin-compat');
const serial = require('./util/serial');

const serialNormalModule4 = serial.serial('NormalModule', {
  constructor: serial.constructed(NormalModule, {
    data: serial.pipe(
      ({freeze: (arg, module) => module, thaw: arg => arg}),
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
      })
    ),
  }),

  setModuleExtra: ({
    freeze() {},
    thaw(arg, frozen, extra, methods) {
      extra.module = arg;
      return arg;
    },
  }),

  identifier: ({
    freeze(arg, module, extra, methods) {
      return serial.request.freeze(module.identifier(), null, extra, methods);
    },
    thaw(arg) {return arg;},
  }),

  assigned: serial.assigned({
    factoryMeta: serial.identity,
    issuer: serial.pipe(
      ({
        freeze(arg, module) {
          return module.issuer && typeof module.issuer === 'object' ?
            module.issuer.identifier() :
            module.issuer;
        },
        thaw(arg, frozen, extra) {return arg;},
      }),
      serial.request,
      ({
        freeze(arg) {return arg;},
        thaw(arg, frozen, extra) {
          if (extra.compilation.modules) {
            for (const module of extra.compilation.modules) {
              if (module && typeof module.identifier === 'function' && module.identifier() === arg) {
                return module;
              }
            }
            for (const cacheId in extra.compilation.cache) {
              const module = extra.compilation.cache[cacheId];
              if (module && typeof module.identifier === 'function' && module.identifier() === arg) {
                return module;
              }
            }
          }
          return arg;
        },
      })
    ),
    useSourceMap: serial.identity,
    lineToLine: serial.identity,
  }),

  setOriginExtra: ({
    freeze() {},
    thaw(arg, frozen, extra) {
      if (typeof arg.issuer === 'object') {
        extra.origin = arg.issuer;
      }
      return arg;
    },
  }),

  build: serial.assigned({
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
  }),

  dependencyBlock: serial.dependencyBlock,

  setError: ({
    freeze() {},
    thaw(arg, module, extra) {
      arg.error = arg.errors[0] || null;
      return arg;
    },
  }),

  setSourceExtra: ({
    freeze() {},
    thaw(arg, module, extra) {
      extra.source = arg._source;
      return arg;
    },
  }),

  source: serial.assigned({
    _cachedSource: serial.source,
    _cachedSourceHash: serial.identity,
    renderedHash: serial.identity,
  }),
});

const needRebuild4 = function() {
  if (this.error) {
    this.cacheItem.invalid = true;
    this.cacheItem.invalidReason = 'error building';
    return true;
  }
  const fileHashes = this.__hardSourceFileMd5s;
  const cachedHashes = this.__hardSourceCachedMd5s;
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
  return false;
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

  setModuleExtra: ({
    freeze() {},
    thaw(arg, frozen, extra, methods) {
      extra.module = arg;
      return arg;
    },
  }),

  // Used internally by HardSource
  identifier: ({
    freeze(arg, module, extra, methods) {
      return serial.request.freeze(module.identifier(), null, extra, methods);
    },
    thaw(arg) {return arg;},
  }),

  assigned: serial.assigned({
    issuer: serial.pipe(
      ({
        freeze(arg, module) {
          return module.issuer && typeof module.issuer === 'object' ?
            module.issuer.identifier() :
            module.issuer;
        },
        thaw(arg, frozen, extra) {return arg;},
      }),
      serial.request,
      ({
        freeze(arg) {return arg;},
        thaw(arg, frozen, extra) {
          if (extra.compilation.modules) {
            for (const module of extra.compilation.modules) {
              if (module && typeof module.identifier === 'function' && module.identifier() === arg) {
                return module;
              }
            }
            for (const cacheId in extra.compilation.cache) {
              const module = extra.compilation.cache[cacheId];
              if (module && typeof module.identifier === 'function' && module.identifier() === arg) {
                return module;
              }
            }
          }
          return arg;
        },
      })
    ),
    useSourceMap: serial.identity,
    lineToLine: serial.identity,
  }),

  setOriginExtra: ({
    freeze() {},
    thaw(arg, frozen, extra) {
      if (typeof arg.issuer === 'object') {
        extra.origin = arg.issuer;
      }
      return arg;
    },
  }),

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
  }),

  hash: ({
    freeze(arg, module, extra, methods) {
      return module.getHashDigest(extra.compilation.dependencyTemplates);
    },
    thaw(arg) {return arg;},
  }),

  dependencyBlock: serial.dependencyBlock,

  setError: ({
    freeze() {},
    thaw(arg, module, extra) {
      arg.error = arg.errors[0] || null;
      return arg;
    },
  }),

  setSourceExtra: ({
    freeze() {},
    thaw(arg, module, extra) {
      extra.source = arg._source;
      return arg;
    },
  }),

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
  return false;
}

const cacheable = module => module.buildInfo ? module.buildInfo.cacheable : module.cacheable;

function HardNormalModulePlugin(options) {
  this.options = options || {};
}

HardNormalModulePlugin.prototype.apply = function(compiler) {
  const schema = this.options.schema;

  let serialNormalModule = serialNormalModule4;
  let needRebuild = needRebuild4;
  if (schema < 4) {
    serialNormalModule = serialNormalModule3;
    needRebuild = needRebuild3;
  }

  let createHash;
  if (schema >= 4) {
    createHash = require("webpack/lib/util/createHash");
  }

  var freeze, mapFreeze;
  var _methods;

  pluginCompat.tap(compiler, '_hardSourceMethods', 'HardNormalModulePlugin', function(methods) {
    _methods = methods;

    // store = methods.store;
    // fetch = methods.fetch;
    freeze = methods.freeze;
    // thaw = methods.thaw;
    mapFreeze = methods.mapFreeze;
    // mapThaw = methods.mapThaw;
  });

  pluginCompat.tap(compiler, 'compilation', 'HardNormalModulePlugin', compilation => {
    pluginCompat.tap(compilation, 'succeedModule', 'HardNormalModulePlugin', module => {
      if (module instanceof NormalModule) {
        try {
          module._dependencyBlock = freeze('DependencyBlock', null, module, {
            module: module,
            parent: module,
            compilation: compilation,
          });
        }
        catch (e) {
          logMessages.moduleFreezeError(compilation, module, e);
        }
      }
    });
  });

  pluginCompat.tap(compiler, '_hardSourceFreezeModule', 'HardNormalModulePlugin', function(frozen, module, extra) {
    // Set hash if it was not set.
    if (schema === 4 && module instanceof NormalModule && !module.hash) {
      const outputOptions = extra.compilation.outputOptions;
      const hashFunction = outputOptions.hashFunction;
      const hashDigest = outputOptions.hashDigest;
      const hashDigestLength = outputOptions.hashDigestLength;

      if (module._initBuildHash) {
        module._initBuildHash(extra.compilation);
      }

      const moduleHash = createHash(hashFunction);
      module.updateHash(moduleHash);
      module.hash = moduleHash.digest(hashDigest);
      module.renderedHash = module.hash.substr(0, hashDigestLength);
      if (module._cachedSource) {
        module._cachedSourceHash = module.getHashDigest(extra.compilation.dependencyTemplates);
      }
    }

    if (
      module.request &&
      cacheable(module) &&
      module instanceof NormalModule &&
      (
        !frozen ||
        schema >= 4 &&
        module.hash !== frozen.build.hash ||
        schema < 4 &&
        module.getHashDigest(extra.compilation.dependencyTemplates) !== frozen.hash
      )
    ) {
      var compilation = extra.compilation;

      if (module.cacheItem) {
        module.cacheItem.invalid = false;
        module.cacheItem.invalidReason = null;
      }
      const f = serialNormalModule.freeze(null, module, {
        module: module,
        compilation: compilation,
      }, _methods);
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
  });

  pluginCompat.tap(compiler, '_hardSourceThawModule', 'HardNormalModulePlugin thaw', function(module, frozen, _extra) {
    if (frozen.type === 'NormalModule') {
      const m = serialNormalModule.thaw(null, frozen, {
        state: {imports: {}},
        compilation: _extra.compilation,
        normalModuleFactory: _extra.normalModuleFactory,
      }, _methods);

      m.cacheItem = frozen;
      m.__hardSourceFileMd5s = _extra.compilation.__hardSourceFileMd5s;
      m.__hardSourceCachedMd5s = _extra.compilation.__hardSourceCachedMd5s;
      m.needRebuild = needRebuild;

      // Unbuild if there is no cache. The module will be rebuilt. Not
      // unbuilding will lead to double dependencies.
      if (schema === 4 && !_extra.compilation.cache) {
        m.unbuild();
      }
      // Side load into the cache if something for this identifier isn't already
      // there.
      else if (_extra.compilation.cache && !_extra.compilation.cache['m' + m.identifier()]) {
        _extra.compilation.cache['m' + m.identifier()] = m;
      }

      return m;
    }
    return module;
  });
};

module.exports = HardNormalModulePlugin;
