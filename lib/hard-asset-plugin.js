var RawSource = require('webpack-sources').RawSource;

function HardAssetPlugin() {}

HardAssetPlugin.prototype.apply = function(compiler) {
  compiler.plugin('--hard-source-freeze-asset', function(frozen, asset, extra) {
    return asset.source();
  });

  compiler.plugin('--hard-source-thaw-asset', function(thawed, asset, extra) {
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
