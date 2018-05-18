const join = require('path').join;

const pluginCompat = require('./util/plugin-compat');

let Append2Serializer;

const _blockSizeByName = {
  data: 4 * 1024,
  md5: 128,
  'missing-resolve': 256,
  module: 4 * 1024,
  'module-resolve': 1024,
  resolver: 256,
};

class SerializerAppend2Plugin {
  apply(compiler) {
    pluginCompat.tap(
      compiler,
      'hardSourceCacheFactory',
      'Append2Serializer',
      factory => info => {
        if (info.type === 'data') {
          return SerializerAppend2Plugin.createSerializer(info);
        }
        return factory(info);
      },
    );
  }
}

SerializerAppend2Plugin.createSerializer = ({
  cacheDirPath,
  name,
  autoParse,
}) => {
  if (!Append2Serializer) {
    Append2Serializer = require('./SerializerAppend2');
  }

  return new Append2Serializer({
    cacheDirPath: join(cacheDirPath, name),
    blockSize: _blockSizeByName[name],
    autoParse: autoParse,
  });
};

module.exports = SerializerAppend2Plugin;
