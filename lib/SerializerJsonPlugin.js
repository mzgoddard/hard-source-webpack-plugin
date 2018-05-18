const join = require('path').join;

const pluginCompat = require('./util/plugin-compat');

let JsonSerializer;

class SerializerJsonPlugin {
  apply(compiler) {
    pluginCompat.tap(
      compiler,
      'hardSourceCacheFactory',
      'JsonSerializer',
      factory => info => {
        if (info.type === 'data') {
          return SerializerJsonPlugin.createSerializer(info);
        }
        return factory(info);
      },
    );
  }
}

SerializerJsonPlugin.createSerializer = ({ cacheDirPath, name }) => {
  if (!JsonSerializer) {
    JsonSerializer = require('./SerializerJson');
  }

  return new JsonSerializer({
    cacheDirPath: join(cacheDirPath, name),
  });
};

module.exports = SerializerJsonPlugin;
