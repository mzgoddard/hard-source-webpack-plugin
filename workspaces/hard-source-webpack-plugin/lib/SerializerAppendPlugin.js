const join = require('path').join;

const pluginCompat = require('./util/plugin-compat');

let AppendSerializer;

const _blockSizeByName = {
  data: 4 * 1024,
  md5: 128,
  'missing-resolve': 256,
  module: 4 * 1024,
  'module-resolve': 1024,
  resolver: 256,
};

class SerializerAppendPlugin {
  apply(compiler) {
    pluginCompat.tap(
      compiler,
      'hardSourceCacheFactory',
      'AppendSerializer',
      factory => info => {
        if (info.type === 'data') {
          return SerializerAppendPlugin.createSerializer(info);
        }
        return factory(info);
      },
    );
  }
}

SerializerAppendPlugin.createSerializer = ({
  cacheDirPath,
  name,
  autoParse,
}) => {
  if (!AppendSerializer) {
    AppendSerializer = require('./SerializerAppend');
  }

  return new AppendSerializer({
    cacheDirPath: join(cacheDirPath, name),
    blockSize: _blockSizeByName[name],
    autoParse: autoParse,
  });
};

module.exports = SerializerAppendPlugin;
