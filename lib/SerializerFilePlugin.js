const join = require('path').join;

const pluginCompat = require('./util/plugin-compat');

let FileSerializer;

class SerializerFilePlugin {
  apply(compiler) {
    pluginCompat.tap(
      compiler,
      'hardSourceCacheFactory',
      'FileSerializer',
      factory => info => {
        if (info.type === 'file') {
          return SerializerFilePlugin.createSerializer(info);
        }
        return factory(info);
      },
    );
  }
}

SerializerFilePlugin.createSerializer = ({ cacheDirPath, name }) => {
  if (!FileSerializer) {
    FileSerializer = require('./SerializerFile');
  }

  return new FileSerializer({
    cacheDirPath: join(cacheDirPath, name),
  });
};

module.exports = SerializerFilePlugin;
