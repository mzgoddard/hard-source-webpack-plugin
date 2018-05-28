const pluginCompat = require('./util/plugin-compat');
const relateContext = require('./util/relate-context');
const { parityCacheFromCache, pushParityWriteOps } = require('./util/parity');

const relateNormalPath = relateContext.relateNormalPath;

function relateNormalRequest(compiler, key) {
  return key
    .split('!')
    .map(subkey => relateNormalPath(compiler, subkey))
    .join('!');
}

function relateNormalModuleId(compiler, id) {
  return id.substring(0, 24) + relateNormalRequest(compiler, id.substring(24));
}

class ModuleCache {
  apply(compiler) {
    const compilerHooks = pluginCompat.hooks(compiler);

    let moduleCache = {};
    let parityCache = {};

    const moduleArchetypeCache = {
      _ops: [],

      get(id) {
        if (moduleCache[id] && !moduleCache[id].invalid) {
          if (typeof moduleCache[id] === 'string') {
            moduleCache[id] = JSON.parse(moduleCache[id]);
          }
          return moduleCache[id];
        }
      },

      set(id, item) {
        moduleCache[id] = item;
        if (item) {
          this._ops.push(id);
        } else if (moduleCache[id]) {
          if (typeof moduleCache[id] === 'string') {
            moduleCache[id] = JSON.parse(moduleCache[id]);
          }
          moduleCache[id].invalid = true;
          moduleCache[id].invalidReason = 'overwritten';

          this._ops.push(id);
        }
      },

      operations() {
        const _this = this;
        const ops = this._ops.map(id => ({
          key: relateNormalModuleId(compiler, id),
          value: _this.get(id) || null,
        }));
        this._ops.length = 0;
        return ops;
      },
    };

    compilerHooks._hardSourceArchetypeRegister.call(
      'Module',
      moduleArchetypeCache,
    );

    let moduleCacheSerializer;

    compilerHooks._hardSourceCreateSerializer.tap(
      'HardSource - ModuleCache',
      (cacheSerializerFactory, cacheDirPath) => {
        moduleCacheSerializer = cacheSerializerFactory.create({
          name: 'module',
          type: 'data',
          cacheDirPath,
          autoParse: true,
        });
      },
    );

    compilerHooks._hardSourceResetCache.tap('HardSource - ModuleCache', () => {
      moduleCache = {};
    });

    compilerHooks._hardSourceReadCache.tapPromise(
      'HardSource - ModuleCache',
      ({ contextKeys, contextNormalModuleId, copyWithDeser }) =>
        moduleCacheSerializer
          .read()
          .then(_moduleCache => {
            Object.keys(_moduleCache).forEach(key => {
              if (key.startsWith('__hardSource_parityToken')) {
                parityCache[key] = _moduleCache[key];
                delete _moduleCache[key];
              }
            });
            return _moduleCache;
          })
          .then(contextKeys(compiler, contextNormalModuleId))
          .then(copyWithDeser.bind(null, moduleCache)),
    );

    compilerHooks._hardSourceParityCache.tap(
      'HardSource - ModuleCache',
      parityRoot => {
        parityCacheFromCache('Module', parityRoot, parityCache);
      },
    );

    compilerHooks.compilation.tap('HardSource - ModuleCache', compilation => {
      compilation.__hardSourceModuleCache = moduleCache;
    });

    compilerHooks._hardSourceWriteCache.tapPromise(
      'HardSource - ModuleCache',
      compilation => {
        const moduleOps = moduleArchetypeCache.operations();

        if (!compilation.compiler.parentCompilation) {
          // Add ops to remove no longer valid modules. If they were replaced with a
          // up to date module, they will already have replaced this item so we
          // won't accidentally delete up to date modules.
          Object.keys(moduleCache).forEach(key => {
            const cacheItem = moduleCache[key];
            if (cacheItem && cacheItem.invalid) {
              // console.log('invalid', cacheItem.invalidReason);
              moduleCache[key] = null;
              moduleOps.push({
                key,
                value: null,
              });
            }
          });
        }

        pushParityWriteOps(compilation, moduleOps);

        return moduleCacheSerializer.write(moduleOps);
      },
    );
  }
}

module.exports = ModuleCache;
