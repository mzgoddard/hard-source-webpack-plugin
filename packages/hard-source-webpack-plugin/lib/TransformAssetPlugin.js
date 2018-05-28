const RawSource = require('webpack-sources').RawSource;

const pluginCompat = require('./util/plugin-compat');

class TransformAssetPlugin {
  apply(compiler) {
    pluginCompat.tap(
      compiler,
      '_hardSourceFreezeAsset',
      'TransformAssetPlugin freeze',
      (frozen, asset, extra) => asset.source(),
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceThawAsset',
      'TransformAssetPlugin thaw',
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

module.exports = TransformAssetPlugin;
