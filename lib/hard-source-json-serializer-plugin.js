var join = require('path').join;

var JsonSerializer = require('./hard-source-json-serializer');

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
  return new JsonSerializer({
    cacheDirPath: join(info.cacheDirPath, info.name),
  });
};
