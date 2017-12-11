var join = require('path').join;

var FileSerializer;

module.exports = HardSourceFileSerializerPlugin;

function HardSourceFileSerializerPlugin() {}

HardSourceFileSerializerPlugin.prototype.apply = function(compiler) {
  compiler.plugin('hard-source-cache-factory', function(factory) {
    return function(info) {
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
