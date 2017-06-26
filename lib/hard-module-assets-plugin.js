function HardModuleAssetsPlugin() {}

HardModuleAssetsPlugin.prototype.apply = function(compiler) {
  var store, fetch;

  compiler.plugin('--hard-source-methods', function(methods) {
    store = methods.store;
    fetch = methods.fetch;
    // freeze = methods.freeze;
    // thaw = methods.thaw;
    // mapFreeze = methods.mapFreeze;
    // mapThaw = methods.mapThaw;
  });

  compiler.plugin('--hard-source-freeze-module-assets', function(frozen, assets, extra) {
    if (!frozen && assets) {
      Object.keys(assets).forEach(function(key) {
        store('asset', key, assets[key], extra);
      });
      frozen = Object.keys(assets);
    }

    return frozen;
  });

  compiler.plugin('--hard-source-thaw-module-assets', function(assets, frozen, extra) {
    if (!assets && frozen) {
      assets = {};
      frozen.forEach(function(key) {
        assets[key] = fetch('asset', key, extra);
      });
    }

    return assets;
  });
};

module.exports = HardModuleAssetsPlugin;
