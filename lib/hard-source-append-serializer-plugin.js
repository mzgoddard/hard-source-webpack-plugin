var join = require('path').join;

var AppendSerializer;

module.exports = HardSourceAppendSerializerPlugin;

const _blockSizeByName = {
  data: 4 * 1024,
  md5: 128,
  'missing-resolve': 256,
  module: 4 * 1024,
  'module-resolve': 1024,
  resolver: 256,
};

function HardSourceAppendSerializerPlugin() {}

HardSourceAppendSerializerPlugin.prototype.apply = function(compiler) {
  compiler.plugin('hard-source-cache-factory', function(factory) {
    return function(info) {
      if (info.type === 'data') {
        return HardSourceAppendSerializerPlugin.createSerializer(info);
      }
      return factory(info);
    };
  });
};

HardSourceAppendSerializerPlugin.createSerializer = function(info) {
  if (!AppendSerializer) {
    AppendSerializer = require('./hard-source-append-serializer');
  }

  return new AppendSerializer({
    cacheDirPath: join(info.cacheDirPath, info.name),
    blockSize: _blockSizeByName[info.name],
    autoParse: info.autoParse,
  });
};
