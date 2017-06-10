var join = require('path').join;

var JsonSerializer = require('./cache-serializers').JsonSerializer;

module.exports = HardSourceJsonSerializerPlugin;

function HardSourceJsonSerializerPlugin() {}

HardSourceJsonSerializerPlugin.prototype.apply = function(compiler) {
  compiler.plugin('hard-source-cache-factory', function(factory) {
    return function(info) {
      if (info.type === 'data') {
        return new JsonSerializer({
          cacheDirPath: join(info.cacheDirPath, info.name)
        });
      }
      return factory(info);
    };
  });
};
