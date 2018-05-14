var join = require('path').join;

var pluginCompat = require('./util/plugin-compat');

var FileSerializer;

module.exports = HardSourceFileSerializerPlugin;

function HardSourceFileSerializerPlugin() {}

HardSourceFileSerializerPlugin.prototype.apply = function(compiler) {
  pluginCompat.tap(compiler, 'hardSourceCacheFactory', 'FileSerializer', function(factory) {    return function(info) {
      if (info.type === 'file') {
        return HardSourceFileSerializerPlugin.createSerializer(info);
      }
      return factory(info);
    };
  });
};

HardSourceFileSerializerPlugin.createSerializer = function(info) {
  if (!FileSerializer) {
    FileSerializer = require('./hard-source-file-serializer');
  }

  return new FileSerializer({
    cacheDirPath: join(info.cacheDirPath, info.name),
  });
};
