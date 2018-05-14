const RawSource = require('webpack-sources').RawSource;

const pluginCompat = require('./util/plugin-compat');

class HardAssetPlugin {
  apply(compiler) {
    pluginCompat.tap(
      compiler,
      '_hardSourceFreezeAsset',
      'HardAssetPlugin freeze',
      (frozen, asset, extra) => asset.source(),
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceThawAsset',
      'HardAssetPlugin thaw',
      (thawed, asset, extra) => {
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
      },
    );
  }
}

module.exports = HardAssetPlugin;
