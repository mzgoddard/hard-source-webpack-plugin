const chalk = require('chalk');

const pluginCompat = require('./util/plugin-compat');

const LOGGER_SEPARATOR = ':';
const DEFAULT_LOGGER_PREFIX = 'hardsource';

const messages = {
  'serialization--error-freezing-module': {
    short: value => `Could not freeze ${value.data.moduleReadable}: ${value.data.errorMessage}`,
  },
  'confighash--directory-no-confighash': {
    short: value => `Config hash skipped in cache directory.`,
  },
  'confighash--new': {
    short: value => `Writing new cache ${value.data.configHash.substring(0, 8)}...`,
  },
  'confighash--reused': {
    short: value => `Reading from cache ${value.data.configHash.substring(0, 8)}...`,
  },
  'environment--inputs': {
    short: value => `Tracking node dependencies with: ${value.data.inputs.join(', ')}.`,
  },
  'environment--config-changed': {
    short: value => 'Configuration changed. Building new cache.',
  },
  'environment--changed': {
    short: value => `Node dependencies changed. Building new cache.`,
  },
  'environment--hardsource-changed': {
    short: value => `hard-source version changed. Building new cache.`,
  },
  'childcompiler--no-cache': {
    once: value => `A child compiler has its cache disabled. Skipping child in hard-source.`,
  },
  'childcompiler--unnamed-cache': {
    once: value => `A child compiler has unnamed cache. Skipping child in hard-source.`,
  },
  'unrecognized': {
    short: value => value.message,
  },
};

class ChalkLoggerPlugin {
  constructor(options) {
    this.once = {};
  }

  apply(compiler) {
    const compilerHooks = pluginCompat.hooks(compiler);

    compilerHooks.hardSourceLog.tap('HardSource - ChalkLoggerPlugin', value => {
      if (process.env.NODE_ENV === 'test' && (value.level !== 'error' || value.level !== 'warn')) {
        return;
      }

      let color = chalk.white;
      if (value.level === 'error') {
        color = chalk.red;
      }
      else if (value.level === 'warn') {
        color = chalk.yellow;
      }

      const header = color(`[${DEFAULT_LOGGER_PREFIX}${LOGGER_SEPARATOR}${compiler.__hardSource_shortConfigHash || value.from}]`);

      let handle = messages[value.data.id];
      if (!handle) {
        handle = messages.unrecognized;
      }
      if (handle) {
        if (handle.short) {
          (console[value.level] || console.error).call(
            console, header, handle.short(value),
          );
        }
        else if (handle.once) {
          if (!this.once[value.data.id]) {
            this.once[value.data.id] = true;
            (console[value.level] || console.error).call(
              console, header, handle.once(value),
            );
          }
        }
      }
      else {
        (console[value.level] || console.error).call(
          console, header, value.message,
        );
      }
    });
  }
}

module.exports = ChalkLoggerPlugin;
