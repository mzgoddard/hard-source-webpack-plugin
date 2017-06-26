var cachePrefix = require('./util').cachePrefix;

function HardModuleConcatenationPlugin() {}

HardModuleConcatenationPlugin.prototype.apply = function(compiler) {
  var store;

  compiler.plugin('--hard-source-methods', function(methods) {
    store = methods.store;
    // fetch = methods.fetch;
    // freeze = methods.freeze;
    // thaw = methods.thaw;
    // mapFreeze = methods.mapFreeze;
    // mapThaw = methods.mapThaw;
  });

  compiler.plugin('--hard-source-freeze-module', function(frozen, module, extra) {
    if (module.modules) {
      var compilation = extra.compilation;

      module.modules.forEach(function(module) {
        var identifierPrefix = cachePrefix(compilation);
        if (identifierPrefix === null) {
          return;
        }
        var identifier = identifierPrefix + module.identifier();

        // store('module', identifier, module, {
        //   id: identifier,
        //   compilation: compilation,
        // });
      });
    }

    return frozen;
  });
};

module.exports = HardModuleConcatenationPlugin;
