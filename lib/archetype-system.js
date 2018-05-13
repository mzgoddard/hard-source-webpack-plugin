var pluginCompat = require('./util/plugin-compat');

class ArchetypeSystem {
  apply(compiler) {
    var compilerHooks = pluginCompat.hooks(compiler);

    var archetypeCaches = {
      // asset: assetArchetypeCache,
      // Asset: assetArchetypeCache,
      // module: moduleArchetypeCache,
      // Module: moduleArchetypeCache,
    };

    pluginCompat.register(compiler, '_hardSourceArchetypeRegister', 'sync', ['name', 'archetypeCache']);

    compilerHooks._hardSourceArchetypeRegister.tap('HardSource - ArchetypeSystem', (name, cache) => {
      archetypeCaches[name] = cache;
      archetypeCaches[name.toLowerCase()] = cache;
    });

    var freeze, thaw, mapMap, mapFreeze, mapThaw, store, fetch;

    pluginCompat.register(compiler, '_hardSourceMethods', 'sync', ['methods']);

    [
      'Asset',
      'Compilation',
      'Dependency',
      'DependencyBlock',
      'DependencyVariable',
      'Module',
      'ModuleAssets',
      'ModuleError',
      'ModuleWarning',
      'Source',
    ].forEach(function(archetype) {
      pluginCompat.register(compiler, '_hardSourceBeforeFreeze' + archetype, 'syncWaterfall', ['frozen', 'item', 'extra']);
      pluginCompat.register(compiler, '_hardSourceFreeze' + archetype, 'syncWaterfall', ['frozen', 'item', 'extra']);
      pluginCompat.register(compiler, '_hardSourceAfterFreeze' + archetype, 'syncWaterfall', ['frozen', 'item', 'extra']);

      pluginCompat.register(compiler, '_hardSourceBeforeThaw' + archetype, 'syncWaterfall', ['item', 'frozen', 'extra']);
      pluginCompat.register(compiler, '_hardSourceThaw' + archetype, 'syncWaterfall', ['item', 'frozen', 'extra']);
      pluginCompat.register(compiler, '_hardSourceAfterThaw' + archetype, 'syncWaterfall', ['item', 'frozen', 'extra']);
    });

    function run(_compiler) {
      var compiler = _compiler;
      if (_compiler.compiler) {
        compiler = _compiler.compiler;
      }
      freeze = function(archetype, frozen, item, extra) {
        if (!item) {
          return item;
        }

        frozen = pluginCompat.call(compiler, '_hardSourceBeforeFreeze' + archetype, [frozen, item, extra]);
        frozen = pluginCompat.call(compiler, '_hardSourceFreeze' + archetype, [frozen, item, extra]);
        frozen = pluginCompat.call(compiler, '_hardSourceAfterFreeze' + archetype, [frozen, item, extra]);

        return frozen;
      };
      thaw = function(archetype, item, frozen, extra) {
        if (!frozen) {
          return frozen;
        }

        item = pluginCompat.call(compiler, '_hardSourceBeforeThaw' + archetype, [item, frozen, extra]);
        item = pluginCompat.call(compiler, '_hardSourceThaw' + archetype, [item, frozen, extra]);
        item = pluginCompat.call(compiler, '_hardSourceAfterThaw' + archetype, [item, frozen, extra]);

        return item;
      };
      mapMap = function(fn, name, output, input, extra) {
        if (output) {
          return input.map(function(item, index) {
            return fn(name, output[index], item, extra);
          })
          .filter(Boolean);
        }
        else {
          return input.map(function(item) {
            return fn(name, null, item, extra);
          })
          .filter(Boolean);
        }
      };
      mapFreeze = function(name, frozen, items, extra) {
        return mapMap(freeze, name, frozen, items, extra);
      };
      mapThaw = function(name, items, frozen, extra) {
        return mapMap(thaw, name, items, frozen, extra);
      };
      store = function(archetype, id, item, extra) {
        var cache = archetypeCaches[archetype];
        if (item) {
          var frozen = cache.get(id);
          var newFrozen = freeze(archetype, frozen, item, extra);
          if (
            (frozen && newFrozen && newFrozen !== frozen) ||
            (!frozen && newFrozen)
          ) {
            cache.set(id, newFrozen);
            return newFrozen;
          }
          else if (frozen) {
            return frozen;
          }
        }
        else {
          cache.set(id, null);
        }
      };
      fetch = function(archetype, id, extra) {
        var cache = archetypeCaches[archetype];
        var frozen = cache.get(id);
        return thaw(archetype, null, frozen, extra);
      };

      var methods = {
        freeze,
        thaw,
        mapFreeze,
        mapThaw,
        store,
        fetch,
      };
      pluginCompat.call(compiler, '_hardSourceMethods', [methods]);
    }

    compilerHooks.watchRun.tap('HardSource - ArchetypeSystem', run);
    compilerHooks.run.tap('HardSource - ArchetypeSystem', run);

    compilerHooks.compilation.tap('HardSource - ArchetypeSystem', function(compilation) {
      compilation.__hardSourceMethods = {
        freeze,
        thaw,
        mapFreeze,
        mapThaw,
        store,
        fetch,
      };
    });
  }
}

module.exports = ArchetypeSystem;
