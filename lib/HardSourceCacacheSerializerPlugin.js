const join = require('path').join;

const pluginCompat = require('./util/plugin-compat');

let CacacheSerializer;

class HardSourceCacacheSerializerPlugin {
  apply(compiler) {
    pluginCompat.tap(
      compiler,
      'hardSourceCacheFactory',
      'CacacheSerializer',
      factory => info => {
        if (info.type === 'data') {
          return HardSourceCacacheSerializerPlugin.createSerializer(info);
        }
        return factory(info);
      },
    );
  }
}

HardSourceCacacheSerializerPlugin.createSerializer = ({
  cacheDirPath,
  name,
}) => {
  if (!CacacheSerializer) {
    CacacheSerializer = require('./HardSourceCacacheSerializer');
  }

  return new CacacheSerializer({
    cacheDirPath: join(cacheDirPath, name),
  });
};

module.exports = HardSourceCacacheSerializerPlugin;
