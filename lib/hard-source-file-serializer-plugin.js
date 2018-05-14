const join = require('path').join;

const pluginCompat = require('./util/plugin-compat');

let FileSerializer;

class HardSourceFileSerializerPlugin {
  apply(compiler) {
    pluginCompat.tap(compiler, 'hardSourceCacheFactory', 'FileSerializer', factory => info => {
        if (info.type === 'file') {
          return HardSourceFileSerializerPlugin.createSerializer(info);
        }
        return factory(info);
      });
  }
}

HardSourceFileSerializerPlugin.createSerializer = ({cacheDirPath, name}) => {
  if (!FileSerializer) {
    FileSerializer = require('./hard-source-file-serializer');
  }

  return new FileSerializer({
    cacheDirPath: join(cacheDirPath, name),
  });
};

module.exports = HardSourceFileSerializerPlugin;
