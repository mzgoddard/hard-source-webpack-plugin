const join = require('path').join;

const pluginCompat = require('./util/plugin-compat');

let LevelDbSerializer;
let AppendSerializerPlugin;

class HardSourceLevelDbSerializerPlugin {
  apply(compiler) {
    pluginCompat.tap(
      compiler,
      'hardSourceCacheFactory',
      'LevelDbSerializer',
      factory => info => {
        if (info.type === 'data') {
          return HardSourceLevelDbSerializerPlugin.createSerializer(info);
        }
        return factory(info);
      },
    );
  }
}

HardSourceLevelDbSerializerPlugin.createSerializer = info => {
  if (!LevelDbSerializer) {
    try {
      LevelDbSerializer = require('./SerializerLeveldb');
    } catch (e) {}
  }

  if (LevelDbSerializer) {
    return new LevelDbSerializer({
      cacheDirPath: join(info.cacheDirPath, info.name),
    });
  } else {
    if (!AppendSerializerPlugin) {
      AppendSerializerPlugin = require('./SerializerAppendPlugin');
    }

    return AppendSerializerPlugin.createSerializer(info);
  }
};

module.exports = HardSourceLevelDbSerializerPlugin;
