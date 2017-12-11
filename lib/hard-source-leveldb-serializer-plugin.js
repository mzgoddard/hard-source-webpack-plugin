var join = require('path').join;

var LevelDbSerializer;
var AppendSerializerPlugin;

module.exports = HardSourceLevelDbSerializerPlugin;

function HardSourceLevelDbSerializerPlugin() {}

HardSourceLevelDbSerializerPlugin.prototype.apply = function(compiler) {
  compiler.plugin('hard-source-cache-factory', function(factory) {
    return function(info) {
      if (info.type === 'data') {
        return HardSourceLevelDbSerializerPlugin.createSerializer(info);
      }
      return factory(info);
    };
  });
};

HardSourceLevelDbSerializerPlugin.createSerializer = function(info) {
  if (!LevelDbSerializer) {
    try {
      LevelDbSerializer = require('./hard-source-leveldb-serializer');
    }
    catch (e) {}
  }

  if (LevelDbSerializer) {
    return new LevelDbSerializer({
      cacheDirPath: join(info.cacheDirPath, info.name),
    });
  }
  else {
    if (!AppendSerializerPlugin) {
      AppendSerializerPlugin = require('./hard-source-append-serializer-plugin');
    }

    return AppendSerializerPlugin.createSerializer(info);
  }
};
