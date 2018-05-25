const pluginCompat = require('./util/plugin-compat');

class ArchetypeSystem {
  apply(compiler) {
    const compilerHooks = pluginCompat.hooks(compiler);

    const archetypeCaches = {
      // asset: assetArchetypeCache,
      // Asset: assetArchetypeCache,
      // module: moduleArchetypeCache,
      // Module: moduleArchetypeCache,
    };

    pluginCompat.register(compiler, '_hardSourceArchetypeRegister', 'sync', [
      'name',
      'archetypeCache',
    ]);

    compilerHooks._hardSourceArchetypeRegister.tap(
      'HardSource - ArchetypeSystem',
      (name, cache) => {
        archetypeCaches[name] = cache;
        archetypeCaches[name.toLowerCase()] = cache;
      },
    );

    let freeze;
    let thaw;
    let mapMap;
    let mapFreeze;
    let mapThaw;
    let store;
    let fetch;

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
    ].forEach(archetype => {
      pluginCompat.register(
        compiler,
        `_hardSourceBeforeFreeze${archetype}`,
        'syncWaterfall',
        ['frozen', 'item', 'extra'],
      );
      pluginCompat.register(
        compiler,
        `_hardSourceFreeze${archetype}`,
        'syncWaterfall',
        ['frozen', 'item', 'extra'],
      );
      pluginCompat.register(
        compiler,
        `_hardSourceAfterFreeze${archetype}`,
        'syncWaterfall',
        ['frozen', 'item', 'extra'],
      );

      pluginCompat.register(
        compiler,
        `_hardSourceBeforeThaw${archetype}`,
        'syncWaterfall',
        ['item', 'frozen', 'extra'],
      );
      pluginCompat.register(
        compiler,
        `_hardSourceThaw${archetype}`,
        'syncWaterfall',
        ['item', 'frozen', 'extra'],
      );
      pluginCompat.register(
        compiler,
        `_hardSourceAfterThaw${archetype}`,
        'syncWaterfall',
        ['item', 'frozen', 'extra'],
      );
    });

    function run(_compiler) {
      let compiler = _compiler;
      if (_compiler.compiler) {
        compiler = _compiler.compiler;
      }
      freeze = (archetype, frozen, item, extra) => {
        if (!item) {
          return item;
        }

        frozen = pluginCompat.call(
          compiler,
          `_hardSourceBeforeFreeze${archetype}`,
          [frozen, item, extra],
        );
        frozen = pluginCompat.call(compiler, `_hardSourceFreeze${archetype}`, [
          frozen,
          item,
          extra,
        ]);
        frozen = pluginCompat.call(
          compiler,
          `_hardSourceAfterFreeze${archetype}`,
          [frozen, item, extra],
        );

        return frozen;
      };
      thaw = (archetype, item, frozen, extra) => {
        if (!frozen) {
          return frozen;
        }

        item = pluginCompat.call(
          compiler,
          `_hardSourceBeforeThaw${archetype}`,
          [item, frozen, extra],
        );
        item = pluginCompat.call(compiler, `_hardSourceThaw${archetype}`, [
          item,
          frozen,
          extra,
        ]);
        item = pluginCompat.call(compiler, `_hardSourceAfterThaw${archetype}`, [
          item,
          frozen,
          extra,
        ]);

        return item;
      };
      mapMap = (fn, name, output, input, extra) => {
        if (output) {
          return input
            .map((item, index) => fn(name, output[index], item, extra))
            .filter(Boolean);
        } else {
          return input.map(item => fn(name, null, item, extra)).filter(Boolean);
        }
      };
      mapFreeze = (name, frozen, items, extra) =>
        mapMap(freeze, name, frozen, items, extra);
      mapThaw = (name, items, frozen, extra) =>
        mapMap(thaw, name, items, frozen, extra);
      store = (archetype, id, item, extra) => {
        const cache = archetypeCaches[archetype];
        if (item) {
          const frozen = cache.get(id);
          const newFrozen = freeze(archetype, frozen, item, extra);
          if (
            (frozen && newFrozen && newFrozen !== frozen) ||
            (!frozen && newFrozen)
          ) {
            cache.set(id, newFrozen);
            return newFrozen;
          } else if (frozen) {
            return frozen;
          }
        } else {
          cache.set(id, null);
        }
      };
      fetch = (archetype, id, extra) => {
        const cache = archetypeCaches[archetype];
        const frozen = cache.get(id);
        return thaw(archetype, null, frozen, extra);
      };

      const methods = {
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

    compilerHooks.compilation.tap(
      'HardSource - ArchetypeSystem',
      compilation => {
        compilation.__hardSourceMethods = {
          freeze,
          thaw,
          mapFreeze,
          mapThaw,
          store,
          fetch,
        };
      },
    );
  }
}

module.exports = ArchetypeSystem;
