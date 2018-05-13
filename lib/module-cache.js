var pluginCompat = require('./util/plugin-compat');
var relateContext = require('./util/relate-context');

var relateNormalPath = relateContext.relateNormalPath;

function relateNormalRequest(compiler, key) {
  return key
  .split('!')
  .map(function(subkey) {
    return relateNormalPath(compiler, subkey);
  })
  .join('!');
}

function relateNormalModuleId(compiler, id) {
  return id.substring(0, 24) + relateNormalRequest(compiler, id.substring(24));
}

class ModuleCache {
  apply(compiler) {
    var compilerHooks = pluginCompat.hooks(compiler);

    var moduleCache = {};

    var moduleArchetypeCache = {
      _ops: [],

      get: function(id) {
        if (moduleCache[id] && !moduleCache[id].invalid) {
          if (typeof moduleCache[id] === 'string') {
            moduleCache[id] = JSON.parse(moduleCache[id]);
          }
          return moduleCache[id];
        }
      },

      set: function(id, item) {
        moduleCache[id] = item;
        if (item) {
          this._ops.push(id);
        }
        else if (moduleCache[id]) {
          if (typeof moduleCache[id] === 'string') {
            moduleCache[id] = JSON.parse(moduleCache[id]);
          }
          moduleCache[id].invalid = true;
          moduleCache[id].invalidReason = 'overwritten';

          this._ops.push(id);
        }
      },

      operations: function() {
        var _this = this;
        var ops = this._ops.map(function(id) {
          return {
            key: relateNormalModuleId(compiler, id),
            value: _this.get(id) || null,
          };
        });
        this._ops.length = 0;
        return ops;
      },
    };

    compilerHooks._hardSourceArchetypeRegister.call('Module', moduleArchetypeCache);

    var moduleCacheSerializer;

    compilerHooks._hardSourceCreateSerializer.tap('HardSource - ModuleCache', (cacheSerializerFactory, cacheDirPath) => {
      moduleCacheSerializer = cacheSerializerFactory.create({
        name: 'module',
        type: 'data',
        cacheDirPath: cacheDirPath,
        autoParse: true,
      });
    });

    compilerHooks._hardSourceResetCache.tap('HardSource - ModuleCache', () => {
      moduleCache = {};
    });

    compilerHooks._hardSourceReadCache.tapPromise('HardSource - ModuleCache', ({
      contextKeys,
      contextNormalModuleId,
      copyWithDeser,
    }) => (
      moduleCacheSerializer.read()
      .then(contextKeys(compiler, contextNormalModuleId))
      .then(copyWithDeser.bind(null, moduleCache))
    ));

    compilerHooks.compilation.tap('HardSource - ModuleCache', compilation => {
      compilation.__hardSourceModuleCache = moduleCache;
    });

    compilerHooks._hardSourceWriteCache.tapPromise('HardSource - ModuleCache', compilation => {
      var moduleOps = moduleArchetypeCache.operations();

      if (!compilation.compiler.parentCompilation) {
        // Add ops to remove no longer valid modules. If they were replaced with a
        // up to date module, they will already have replaced this item so we
        // won't accidentally delete up to date modules.
        Object.keys(moduleCache).forEach(function(key) {
          var cacheItem = moduleCache[key];
          if (cacheItem && cacheItem.invalid) {
            // console.log('invalid', cacheItem.invalidReason);
            moduleCache[key] = null;
            moduleOps.push({
              key: key,
              value: null,
            });
          }
        });
      }

      return moduleCacheSerializer.write(moduleOps);
    });
  }
}

module.exports = ModuleCache;
