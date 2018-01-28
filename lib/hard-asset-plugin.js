var RawSource = require('webpack-sources').RawSource;

var pluginCompat = require('./util/plugin-compat');

function HardAssetPlugin() {}

HardAssetPlugin.prototype.apply = function(compiler) {
  pluginCompat.tap(compiler, '_hardSourceFreezeAsset', 'HardAssetPlugin freeze', function(frozen, asset, extra) {
    return asset.source();
  });

  pluginCompat.tap(compiler, '_hardSourceThawAsset', 'HardAssetPlugin thaw', function(thawed, asset, extra) {
    if (!thawed) {
      thawed = asset;
      if (thawed.type === 'buffer') {
        thawed = new Buffer(thawed);
      }
      if (!(thawed instanceof RawSource)) {
        thawed = new RawSource(thawed);
      }
    }

    return thawed;
  });
};

module.exports = HardAssetPlugin;
