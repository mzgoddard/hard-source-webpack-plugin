const cachePrefix = require('./util').cachePrefix;
const logMessages = require('./util/log-messages');
const pluginCompat = require('./util/plugin-compat');

function HardCompilationPlugin() {}

HardCompilationPlugin.prototype.apply = function(compiler) {
  var store;

  pluginCompat.tap(compiler, '_hardSourceMethods', 'HardCompilationPlugin copy methods', function(methods) {
    store = methods.store;
    // fetch = methods.fetch;
    // freeze = methods.freeze;
    // thaw = methods.thaw;
  });

  pluginCompat.tap(compiler, '_hardSourceFreezeCompilation', 'HardCompilationPlugin freeze', function(_, compilation) {
    compilation.modules.forEach(function(module) {
      var identifierPrefix = cachePrefix(compilation);
      if (identifierPrefix === null) {
        return;
      }
      var identifier = identifierPrefix + module.identifier();

      try {
        store('Module', identifier, module, {
          id: identifier,
          compilation: compilation,
        });
      }
      catch (e) {
        logMessages.moduleFreezeError(compilation, module, e);
      }
    });
  });
};

module.exports = HardCompilationPlugin;
