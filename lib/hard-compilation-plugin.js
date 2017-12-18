var cachePrefix = require('./util').cachePrefix;
var LoggerFactory = require('./logger-factory');

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

      try {
        store('module', identifier, module, {
          id: identifier,
          compilation: compilation,
        });
      }
      catch (e) {
        var loggerSerial = LoggerFactory.getLogger(compilation).from('serial');
        var compilerName = compilation.compiler.name;
        var compilerContext = compilation.compiler.options.context;
        var moduleIdentifier = module.identifier();
        var shortener = new (require('webpack/lib/RequestShortener'))(compilerContext);
        var moduleReadable = module.readableIdentifier(shortener);

        loggerSerial.error(
          {
            id: 'serialization--error-freezing-module',
            identifierPrefix: identifierPrefix,
            compilerName: compilerName,
            moduleIdentifier: moduleIdentifier,
            error: e,
            errorMessage: e.message,
            errorStack: e.stack,
          },
          'Unable to freeze module "' + moduleReadable +
          (compilerName ? '" in compilation "' + compilerName : '') + '". An ' +
          'error occured serializing it into a string: ' + e.message
        );
      }
    });
  });
};

module.exports = HardCompilationPlugin;
