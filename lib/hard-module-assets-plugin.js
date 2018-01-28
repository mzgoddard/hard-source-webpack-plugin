var pluginCompat = require('./util/plugin-compat');

function HardModuleAssetsPlugin() {}

HardModuleAssetsPlugin.prototype.apply = function(compiler) {
  var store, fetch;

  pluginCompat.tap(compiler, '_hardSourceMethods', 'HardModuleAssetsPlugin copy methods', function(methods) {
    store = methods.store;
    fetch = methods.fetch;
    // freeze = methods.freeze;
    // thaw = methods.thaw;
    // mapFreeze = methods.mapFreeze;
    // mapThaw = methods.mapThaw;
  });

  pluginCompat.tap(compiler, '_hardSourceFreezeModuleAssets', 'HardModuleAssetsPlugin freeze', function(frozen, assets, extra) {
    if (!frozen && assets) {
      Object.keys(assets).forEach(function(key) {
        store('Asset', key, assets[key], extra);
      });
      frozen = Object.keys(assets);
    }

    return frozen;
  });

  pluginCompat.tap(compiler, '_hardSourceThawModuleAssets', 'HardModuleAssetsPlugin thaw', function(assets, frozen, extra) {
    if (!assets && frozen) {
      assets = {};
      frozen.forEach(function(key) {
        assets[key] = fetch('Asset', key, extra);
      });
    }

    return assets;
  });
};

module.exports = HardModuleAssetsPlugin;
