var join = require('path').join;

var JsonSerializer;

module.exports = HardSourceJsonSerializerPlugin;

function HardSourceJsonSerializerPlugin() {}

HardSourceJsonSerializerPlugin.prototype.apply = function(compiler) {
  compiler.plugin('hard-source-cache-factory', function(factory) {
    return function(info) {
      if (info.type === 'data') {
        return HardSourceJsonSerializerPlugin.createSerializer(info);
      }
      return factory(info);
    };
  });
};

HardSourceJsonSerializerPlugin.createSerializer = function(info) {
  if (!JsonSerializer) {
    JsonSerializer = require('./hard-source-json-serializer');
  }

  return new JsonSerializer({
    cacheDirPath: join(info.cacheDirPath, info.name),
  });
};
