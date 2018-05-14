const ContextModule = require('webpack/lib/ContextModule');

const logMessages = require('./util/log-messages');

const pluginCompat = require('./util/plugin-compat');
const relateContext = require('./util/relate-context');
const serial = require('./util/serial');

const serialContextModule4 = serial.serial('ContextModule', {
  constructor: serial.constructed(ContextModule, {
    resolveDependencies: serial.null,
    options: serial.created({
      context: serial.path,
      request: serial.request,
      addon: serial.request,
      resource: serial.pipe({
        freeze: (arg, {options}) => options.resourceQuery ?
          `${options.resource}?${options.resourceQuery}` :
          options.resource,
        thaw: arg => arg, 
      }, serial.path),
      regExp: serial.regExp,
      mode: serial.identity,
      include: serial.regExp,
      exclude: serial.regExp,
      recursive: serial.identity,
      chunkName: serial.identity,
      namespaceObject: serial.identity,
      resolveOptions: serial.identity,
      resolveDependencies: serial.null,
    }),
  }),

  setModuleExtra: ({
    freeze() {},
    thaw(arg, frozen, extra, methods) {
      extra.module = arg;
      return arg;
    },
  }),

  context: ({
    freeze(arg, {context}, extra, methods) {
      return serial.path.freeze(context, null, extra, methods);
    },
    thaw(arg) {return arg;},
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
        freeze(arg, {issuer}) {
          return issuer && typeof issuer === 'object' ?
            issuer.identifier() :
            issuer;
        },
        thaw(arg, frozen, extra) {return arg;},
      }),
      serial.request,
      ({
        freeze(arg) {return arg;},
        thaw(arg, frozen, {compilation}) {
          if (compilation.modules) {
            for (const module of compilation.modules) {
              if (module && typeof module.identifier === 'function' && module.identifier() === arg) {
                return module;
              }
            }
            for (const cacheId in compilation.cache) {
              const module = compilation.cache[cacheId];
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
    buildMeta: serial.identity,
    buildInfo: serial.created({
      builtTime: serial.identity,
      fileDependencies: serial.pathSet,
      contextDependencies: serial.pathSet,
    }),
    warnings: serial.moduleWarning,
    errors: serial.moduleError,
    hash: serial.identity,
  }),

  dependencyBlock: serial.dependencyBlock,
});

const build4 = function(options, compilation, resolver, fs, callback) {
  const contextModuleFactory = this.__hardSource_contextModuleFactory;
  contextModuleFactory.hooks.afterResolve.callAsync(Object.assign({
    resolveDependencies: contextModuleFactory.resolveDependencies.bind(contextModuleFactory),
  }, this.cacheItem.constructor.options), (err, {resolveDependencies}) => {
    if (err) {return callback(err);}
    this.resolveDependencies = resolveDependencies;
    ContextModule.prototype.build.call(this, options, compilation, resolver, fs, callback);
  });
};

const needRebuild4 = function() {
  const fileHashes = this.__hardSourceFileMd5s;
  const cachedHashes = this.__hardSourceCachedMd5s;
  if (
    !cachedHashes[this.context] ||
    fileHashes[this.context] !== cachedHashes[this.context]
  ) {
    this.cacheItem.invalid = true;
    this.cacheItem.invalidReason = 'md5 mismatch';
    return true;
  }
  return false;
};

const builtTime4 = ({buildInfo, build}) => buildInfo ?
  buildInfo.builtTime :
  build.buildInfo.builtTime;

const serialContextModule3 = serial.serial('ContextModule', {
  constructor: serial.constructed(ContextModule, {
    resolveDependencies: serial.null,
    context: serial.path,
    recursive: serial.identity,
    regExp: serial.regExp,
    addon: serial.request,
    async: serial.identity,
    chunkName: serial.identity,
  }),

  setModuleExtra: ({
    freeze() {},
    thaw(arg, frozen, extra, methods) {
      extra.module = arg;
      return arg;
    },
  }),

  context: ({
    freeze(arg, {context}, extra, methods) {
      return serial.path.freeze(context, null, extra, methods);
    },
    thaw(arg) {return arg;},
  }),
  identifier: ({
    freeze(arg, module, extra, methods) {
      return serial.request.freeze(module.identifier(), null, extra, methods);
    },
    thaw(arg) {return arg;},
  }),

  assigned: serial.assigned({
    issuer: serial.pipe(
      ({
        freeze(arg, {issuer}) {
          return issuer && typeof issuer === 'object' ?
            issuer.identifier() :
            issuer;
        },
        thaw(arg, frozen, extra) {return arg;},
      }),
      serial.request,
      ({
        freeze(arg) {return arg;},
        thaw(arg, frozen, {compilation}) {
          if (compilation.modules) {
            for (const module of compilation.modules) {
              if (module && typeof module.identifier === 'function' && module.identifier() === arg) {
                return module;
              }
            }
            for (const cacheId in compilation.cache) {
              const module = compilation.cache[cacheId];
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
    builtTime: serial.identity,
    fileDependencies: serial.pathArray,
    contextDependencies: serial.pathArray,
    meta: serial.identity,
    warnings: serial.moduleWarning,
    errors: serial.moduleError,
  }),

  dependencyBlock: serial.dependencyBlock,
});


const build3 = function(options, compilation, resolver, fs, callback) {
  const contextModuleFactory = this.__hardSource_contextModuleFactory;
  contextModuleFactory.applyPluginsWaterfallAsync('after-resolve', Object.assign({
    loaders: this.cacheItem.constructor.addon,
    resource: this.cacheItem.constructor.context,
    resolveDependencies: contextModuleFactory.resolveDependencies.bind(contextModuleFactory),
  }, this.cacheItem.constructor), (err, {resolveDependencies}) => {
    if (err) {return callback(err);}
    this.resolveDependencies = resolveDependencies;
    ContextModule.prototype.build.call(this, options, compilation, resolver, fs, callback);
  });
};

const needRebuild3 = function() {
  const fileHashes = this.__hardSourceFileMd5s;
  const cachedHashes = this.__hardSourceCachedMd5s;
  if (
    !cachedHashes[this.context] ||
    fileHashes[this.context] !== cachedHashes[this.context]
  ) {
    this.cacheItem.invalid = true;
    this.cacheItem.invalidReason = 'md5 mismatch';
    return true;
  }
  return false;
};

const builtTime3 = ({builtTime, build}) => builtTime ?
  builtTime :
  build.builtTime;

function freezeHashContent(module) {
  const content = [];
  module.updateHash({
    update(str) {
      content.push(str);
    },
  });
  return content.join('');
}

class HardModuleContextPlugin {
  constructor(options) {
    this.options = options || {};
  }

  apply(compiler) {
    const schema = this.options.schema;
    let serialContextModule = serialContextModule4;
    let build = build4;
    let needRebuild = needRebuild4;
    let builtTime = builtTime4;

    if (schema < 4) {
      serialContextModule = serialContextModule3;
      build = build3;
      needRebuild = needRebuild3;
      builtTime = builtTime3;
    }

    let methods;

    let freeze;

    pluginCompat.tap(compiler, '_hardSourceMethods', 'HardModuleContextPlugin copy methods', _methods => {
      methods = _methods;

      // store = _methods.store;
      // fetch = _methods.fetch;
      freeze = _methods.freeze;
      // thaw = _methods.thaw;
      // mapFreeze = _methods.mapFreeze;
      // mapThaw = _methods.mapThaw;
    });

    pluginCompat.tap(compiler, 'compilation', 'HardContextModulePlugin', compilation => {
      pluginCompat.tap(compilation, 'succeedModule', 'HardContextModulePlugin', module => {
        if (module instanceof ContextModule) {
          try {
            module._dependencyBlock = freeze('DependencyBlock', null, module, {
              module,
              parent: module,
              compilation,
            });
          }
          catch (e) {
            logMessages.moduleFreezeError(compilation, module, e);
          }
        }
      });
    });

    pluginCompat.tap(compiler, '_hardSourceFreezeModule', 'HardModuleContextPlugin freeze', (frozen, module, {compilation}) => {
      // module instanceof ContextModule && console.log(module.context, !frozen)
      if (
        module.context &&
        (module instanceof ContextModule) &&
        (
          frozen &&
          builtTime(module) >= builtTime(frozen) ||
          !frozen
        )
      ) {
        if (module.cacheItem) {
          module.cacheItem.invalid = false;
          module.cacheItem.invalidReason = null;
        }

        const m = serialContextModule.freeze(null, module, {
          module,
          compilation: compilation,
        }, methods);

        // The saved dependencies may not be the ones derived in the hash. This is
        // alright, in such a case the dependencies were altered before the source
        // was rendered. The dependencies should be modified a second time, if
        // they are in the same way they'll match. If they are not modified in the
        // same way, then it'll correctly rerender.
        if (module._dependencyBlock) {
          m.dependencyBlock = module._dependencyBlock;
        }

        return m;
      }

      return frozen;
    });

    pluginCompat.tap(compiler, '_hardSourceThawModule', 'HardModuleContextPlugin thaw', (module, frozen, {compilation, contextModuleFactory}) => {
      if (frozen.type === 'ContextModule') {
        const m = serialContextModule.thaw(null, frozen, {
          state: {imports: {}},
          compilation: compilation,
          contextModuleFactory: contextModuleFactory,
        }, methods);
        // console.log(frozen.type, [[m]]);

        m.cacheItem = frozen;
        m.__hardSourceFileMd5s = compilation.__hardSourceFileMd5s;
        m.__hardSourceCachedMd5s = compilation.__hardSourceCachedMd5s;
        m.__hardSource_contextModuleFactory = contextModuleFactory;
        m.build = build;
        m.needRebuild = needRebuild;

        // Unbuild if there is no cache. The module will be rebuilt. Not
        // unbuilding will lead to double dependencies.
        if (schema === 4 && !compilation.cache) {
          m.unbuild();
        }
        // Side load into the cache if something for this identifier isn't already
        // there.
        else if (compilation.cache && !compilation.cache[`m${m.identifier()}`]) {
          compilation.cache[`m${m.identifier()}`] = m;
        }

        return m;
      }
      return module;
    });
  }
}

module.exports = HardModuleContextPlugin;
