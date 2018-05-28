const pluginCompat = require('./util/plugin-compat');
const logMessages = require('./util/log-messages');
const { ParityRoot } = require('./util/parity');

class ParitySystem {
  apply(compiler) {
    pluginCompat.register(compiler, '_hardSourceParityCache', 'sync', [
      'parityRoot',
    ]);

    const compilerHooks = pluginCompat.hooks(compiler);

    function runParityOrReset(_compiler) {
      const parityRoot = new ParityRoot();
      compilerHooks._hardSourceParityCache.call(parityRoot);
      if (!parityRoot.verify()) {
        logMessages.cacheNoParity(compiler, { parityRoot });

        // Reset the cache, some part of it is incomplete and using it will lead
        // to errors.
        compilerHooks._hardSourceResetCache.call();
      }

      return Promise.resolve();
    }

    compilerHooks.watchRun.tapPromise(
      'HardSource - index - parityOrReset',
      runParityOrReset,
    );
    compilerHooks.run.tapPromise(
      'HardSource - index - parityOrReset',
      runParityOrReset,
    );
  }
}

module.exports = ParitySystem;
