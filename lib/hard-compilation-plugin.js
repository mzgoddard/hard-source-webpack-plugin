const cachePrefix = require('./util').cachePrefix;
const logMessages = require('./util/log-messages');
const pluginCompat = require('./util/plugin-compat');

class HardCompilationPlugin {
  apply(compiler) {
    let store;

    pluginCompat.tap(compiler, '_hardSourceMethods', 'HardCompilationPlugin copy methods', methods => {
      store = methods.store;
      // fetch = methods.fetch;
      // freeze = methods.freeze;
      // thaw = methods.thaw;
    });

    pluginCompat.tap(compiler, '_hardSourceFreezeCompilation', 'HardCompilationPlugin freeze', (_, compilation) => {
      compilation.modules.forEach(module => {
        const identifierPrefix = cachePrefix(compilation);
        if (identifierPrefix === null) {
          return;
        }
        const identifier = identifierPrefix + module.identifier();

        try {
          store('Module', identifier, module, {
            id: identifier,
            compilation,
          });
        }
        catch (e) {
          logMessages.moduleFreezeError(compilation, module, e);
        }
      });
    });
  }
}

module.exports = HardCompilationPlugin;
