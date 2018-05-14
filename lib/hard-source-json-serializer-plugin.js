const join = require('path').join;

const pluginCompat = require('./util/plugin-compat');

let JsonSerializer;

class HardSourceJsonSerializerPlugin {
  apply(compiler) {
    pluginCompat.tap(compiler, 'hardSourceCacheFactory', 'JsonSerializer', factory => info => {
      if (info.type === 'data') {
        return HardSourceJsonSerializerPlugin.createSerializer(info);
      }
      return factory(info);
    });
  }
}

HardSourceJsonSerializerPlugin.createSerializer = ({cacheDirPath, name}) => {
  if (!JsonSerializer) {
    JsonSerializer = require('./hard-source-json-serializer');
  }

  return new JsonSerializer({
    cacheDirPath: join(cacheDirPath, name),
  });
};

module.exports = HardSourceJsonSerializerPlugin;
