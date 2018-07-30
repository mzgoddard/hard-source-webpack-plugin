const cachePrefix = require('.').cachePrefix;
const LoggerFactory = require('../loggerFactory');

exports.moduleFreezeError = (compilation, module, e) => {
  const loggerSerial = LoggerFactory.getLogger(compilation).from('serial');
  const compilerName = compilation.compiler.name;
  const compilerContext = compilation.compiler.options.context;
  const identifierPrefix = cachePrefix(compilation);
  const moduleIdentifier = module.identifier();
  const shortener = new (require('webpack/lib/RequestShortener'))(
    compilerContext,
  );
  const moduleReadable = module.readableIdentifier(shortener);

  loggerSerial.error(
    {
      id: 'serialization--error-freezing-module',
      identifierPrefix,
      compilerName,
      moduleIdentifier,
      moduleReadable,
      error: e,
      errorMessage: e.message,
      errorStack: e.stack,
    },
    `Unable to freeze module "${moduleReadable}${
      compilerName ? `" in compilation "${compilerName}` : ''
    }". An error occured serializing it into a string: ${e.message}`,
  );
};

exports.cacheNoParity = (compiler, { parityRoot }) => {
  const loggerSerial = new LoggerFactory(compiler).create().from('serial');
  loggerSerial.error(
    {
      id: 'serialzation--cache-incomplete',
      parityRoot,
    },
    [
      `Previous cache did not complete parity check. ${parityRoot.reason}`,
      'Resetting cache.',
    ].join('\n'),
  );
};

exports.serialBadCache = (compiler, error) => {
  const loggerSerial = new LoggerFactory(compiler).create().from('serial');
  loggerSerial.error(
    {
      id: 'serialzation--bad-cache',
    },
    ['Cache is corrupted.', error.stack || error.message || error].join('\n'),
  );
};

const logCore = compiler => new LoggerFactory(compiler).create().from('core');

exports.configHashSetButNotUsed = (compiler, { cacheDirectory }) => {
  const loggerCore = logCore(compiler);
  loggerCore.error(
    {
      id: 'confighash--directory-no-confighash',
      cacheDirectory: cacheDirectory,
    },
    'HardSourceWebpackPlugin cannot use [confighash] in cacheDirectory ' +
      'without configHash option being set and returning a non-falsy value.',
  );
};

exports.configHashFirstBuild = (compiler, { cacheDirPath, configHash }) => {
  const loggerCore = logCore(compiler);
  loggerCore.log(
    {
      id: 'confighash--new',
      cacheDirPath,
      configHash,
    },
    `HardSourceWebpackPlugin is writing to a new confighash path for the first time: ${cacheDirPath}`,
  );
};

exports.configHashBuildWith = (compiler, { cacheDirPath, configHash }) => {
  const loggerCore = logCore(compiler);
  loggerCore.log(
    {
      id: 'confighash--reused',
      cacheDirPath,
      configHash,
    },
    `HardSourceWebpackPlugin is reading from and writing to a confighash path: ${cacheDirPath}`,
  );
};

exports.deleteOldCaches = (compiler, { newTotalSize, oldTotalSize }) => {
  const loggerCore = logCore(compiler);
  const sizeMB = Math.ceil(newTotalSize / 1024 / 1024);
  const deletedSizeMB = Math.ceil(oldTotalSize / 1024 / 1024);
  loggerCore.log(
    {
      id: 'caches--delete-old',
      size: newTotalSize,
      sizeMB,
      deletedSize: oldTotalSize,
      deletedSizeMB,
    },
    `HardSourceWebpackPlugin is using ${sizeMB} MB of disk space after deleting ${deletedSizeMB} MB.`,
  );
};

exports.keepCaches = (compiler, { totalSize }) => {
  const loggerCore = logCore(compiler);
  const sizeMB = Math.ceil(totalSize / 1024 / 1024);
  loggerCore.log(
    {
      id: 'caches--keep',
      size: totalSize,
      sizeMB,
    },
    `HardSourceWebpackPlugin is using ${sizeMB} MB of disk space.`,
  );
};

exports.environmentInputs = (compiler, { inputs }) => {
  const loggerCore = logCore(compiler);
  loggerCore.log(
    {
      id: 'environment--inputs',
      inputs,
    },
    `Tracking environment changes with ${inputs.join(', ')}.`,
  );
};

exports.configHashChanged = compiler => {
  const loggerCore = logCore(compiler);
  loggerCore.warn(
    {
      id: 'environment--config-changed',
    },
    'Environment has changed (configuration was changed).\n' +
      'HardSourceWebpackPlugin will reset the cache and store a fresh one.',
  );
};

exports.environmentHashChanged = compiler => {
  const loggerCore = logCore(compiler);
  loggerCore.warn(
    {
      id: 'environment--changed',
    },
    'Environment has changed (node_modules was updated).\n' +
      'HardSourceWebpackPlugin will reset the cache and store a fresh one.',
  );
};

exports.hardSourceVersionChanged = compiler => {
  const loggerCore = logCore(compiler);
  loggerCore.warn(
    {
      id: 'environment--hardsource-changed',
    },
    'Installed HardSource version does not match the saved ' +
      'cache.\nHardSourceWebpackPlugin will reset the cache and store ' +
      'a fresh one.',
  );
};

exports.childCompilerWithoutCache = compilation => {
  var loggerUtil = LoggerFactory.getLogger(compilation).from('util');
  loggerUtil.error(
    {
      id: 'childcompiler--no-cache',
      compilerName: compilation.compiler.name,
    },
    [
      `A child compiler (${compilation.compiler.name}) does not`,
      "have a memory cache. Enable a memory cache with webpack's",
      '`cache` configuration option. HardSourceWebpackPlugin will be',
      'disabled for this child compiler until then.',
    ].join('\n'),
  );
};

exports.childCompilerUnnamedCache = compilation => {
  var loggerUtil = LoggerFactory.getLogger(compilation).from('util');
  loggerUtil.error(
    {
      id: 'childcompiler--unnamed-cache',
      compilerName: compilation.compiler.name,
    },
    [
      `A child compiler (${compilation.compiler.name}) has a`,
      'memory cache but its cache name is unknown.',
      'HardSourceWebpackPlugin will be disabled for this child',
      'compiler.',
    ].join('\n'),
  );
};

const logParallel = compiler =>
  new LoggerFactory(compiler).create().from('parallel');

exports.parallelStartWorkers = (compiler, options) => {
  const loggerParallel = logParallel(compiler);
  loggerParallel.log(
    {
      id: 'parallel--start-workers',
      numWorkers: options.numWorkers,
    },
    [`Start ${options.numWorkers} module workers.`].join('\n'),
  );
};

exports.parallelConfigMismatch = (compiler, options) => {
  const loggerParallel = logParallel(compiler);
  loggerParallel.error(
    {
      id: 'parallel--config-mismatch',
      ourHash: options.ourHash,
      theirHash: options.theirHash,
    },
    [
      `Child process's configuration does not match parent `,
      `configuration. Unable to parallelize webpack.`,
    ].join('\n'),
  );
};

exports.parallelErrorSendingJob = (compiler, error) => {
  const loggerParallel = logParallel(compiler);
  loggerParallel.error(
    {
      id: 'parallel--error-sending-job',
      error,
    },
    `Failed to send parallel module work. ${error.stack}`,
  );
};

exports.parallelRequireWebpack4 = compiler => {
  const loggerParallel = logParallel(compiler);
  loggerParallel.error(
    {
      id: 'parallel--webpack-4',
    },
    `Parallel Module Plugin requires webpack 4.`,
  );
};
