const cachePrefix = require('.').cachePrefix;
const LoggerFactory = require('../logger-factory');

exports.moduleFreezeError = (compilation, module, e) => {
  const loggerSerial = LoggerFactory.getLogger(compilation).from('serial');
  const compilerName = compilation.compiler.name;
  const compilerContext = compilation.compiler.options.context;
  const identifierPrefix = cachePrefix(compilation);
  const moduleIdentifier = module.identifier();
  const shortener = new (require('webpack/lib/RequestShortener'))(compilerContext);
  const moduleReadable = module.readableIdentifier(shortener);

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
};
