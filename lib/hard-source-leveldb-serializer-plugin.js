var join = require('path').join;

var pluginCompat = require('./util/plugin-compat');

var LevelDbSerializer;
var AppendSerializerPlugin;

module.exports = HardSourceLevelDbSerializerPlugin;

function HardSourceLevelDbSerializerPlugin() {}

HardSourceLevelDbSerializerPlugin.prototype.apply = function(compiler) {
  pluginCompat.tap(compiler, 'hardSourceCacheFactory', 'LevelDbSerializer', function(factory) {    return function(info) {
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
