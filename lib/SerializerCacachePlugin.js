const join = require('path').join;

const pluginCompat = require('./util/plugin-compat');

let CacacheSerializer;

class SerializerCacachePlugin {
  apply(compiler) {
    pluginCompat.tap(
      compiler,
      'hardSourceCacheFactory',
      'CacacheSerializer',
      factory => info => {
        if (info.type === 'data') {
          return SerializerCacachePlugin.createSerializer(info);
        }
        return factory(info);
      },
    );
  }
}

SerializerCacachePlugin.createSerializer = ({ cacheDirPath, name }) => {
  if (!CacacheSerializer) {
    CacacheSerializer = require('./SerializerCacache');
  }

  return new CacacheSerializer({
    cacheDirPath: join(cacheDirPath, name),
  });
};

module.exports = SerializerCacachePlugin;
