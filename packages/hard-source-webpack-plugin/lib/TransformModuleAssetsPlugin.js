const pluginCompat = require('./util/plugin-compat');

class TransformModuleAssetsPlugin {
  apply(compiler) {
    let store;
    let fetch;

    pluginCompat.tap(
      compiler,
      '_hardSourceMethods',
      'TransformModuleAssetsPlugin copy methods',
      methods => {
        store = methods.store;
        fetch = methods.fetch;
        // freeze = methods.freeze;
        // thaw = methods.thaw;
        // mapFreeze = methods.mapFreeze;
        // mapThaw = methods.mapThaw;
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceFreezeModuleAssets',
      'TransformModuleAssetsPlugin freeze',
      (frozen, assets, extra) => {
        if (!frozen && assets) {
          Object.keys(assets).forEach(key => {
            store('Asset', key, assets[key], extra);
          });
          frozen = Object.keys(assets);
        }

        return frozen;
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceThawModuleAssets',
      'TransformModuleAssetsPlugin thaw',
      (assets, frozen, extra) => {
        if (!assets && frozen) {
          assets = {};
          frozen.forEach(key => {
            assets[key] = fetch('Asset', key, extra);
          });
        }

        return assets;
      },
    );
  }
}

module.exports = TransformModuleAssetsPlugin;
