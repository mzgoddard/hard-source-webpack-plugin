var cachePrefix = require('./util').cachePrefix;

function HardCompilationPlugin() {}

HardCompilationPlugin.prototype.apply = function(compiler) {
  var store;

  compiler.plugin('--hard-source-methods', function(methods) {
    store = methods.store;
    // fetch = methods.fetch;
    // freeze = methods.freeze;
    // thaw = methods.thaw;
  });

  compiler.plugin('--hard-source-freeze-compilation', function(_, compilation) {
    compilation.modules.forEach(function(module) {
      var identifierPrefix = cachePrefix(compilation);
      if (identifierPrefix === null) {
        return;
      }
      var identifier = identifierPrefix + module.identifier();

      store('module', identifier, module, {
        id: identifier,
        compilation: compilation,
      });
    });
  });
};

module.exports = HardCompilationPlugin;
