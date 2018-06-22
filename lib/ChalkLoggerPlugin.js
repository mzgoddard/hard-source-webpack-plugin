const chalk = require('chalk');

const pluginCompat = require('./util/plugin-compat');

const LOGGER_SEPARATOR = ':';
const DEFAULT_LOGGER_PREFIX = 'hardsource';

const messages = {
  'serialization--error-freezing-module': {
    short: value =>
      `Could not freeze ${value.data.moduleReadable}: ${
        value.data.errorMessage
      }`,
  },
  'serialzation--cache-incomplete': {
    short: value =>
      `Last compilation did not finish saving. Building new cache.`,
  },
  'confighash--directory-no-confighash': {
    short: value => `Config hash skipped in cache directory.`,
  },
  'confighash--new': {
    short: value =>
      `Writing new cache ${value.data.configHash.substring(0, 8)}...`,
  },
  'confighash--reused': {
    short: value =>
      `Reading from cache ${value.data.configHash.substring(0, 8)}...`,
  },
  'caches--delete-old': {
    short: value =>
      `Deleted ${value.data.deletedSizeMB} MB. Using ${
        value.data.sizeMB
      } MB of disk space.`,
  },
  'caches--keep': {
    short: value => `Using ${value.data.sizeMB} MB of disk space.`,
  },
  'environment--inputs': {
    short: value =>
      `Tracking node dependencies with: ${value.data.inputs.join(', ')}.`,
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
    once: value =>
      `A child compiler has its cache disabled. Skipping child in hard-source.`,
  },
  'childcompiler--unnamed-cache': {
    once: value =>
      `A child compiler has unnamed cache. Skipping child in hard-source.`,
  },
  unrecognized: {
    short: value => value.message,
  },
};

const logLevels = ['error', 'warn', 'info', 'log', 'debug'];

const levelId = level => logLevels.indexOf(level.toLowerCase());

const compareLevel = (a, b) => levelId(a) - levelId(b);

class ChalkLoggerPlugin {
  constructor(options = {}) {
    this.options = options;
    this.once = {};

    // mode: 'test' or 'none'
    this.options.mode =
      this.options.mode || (process.env.NODE_ENV === 'test' ? 'test' : 'none');
    // level: 'error', 'warn', 'info', 'log', 'debug'
    this.options.level =
      this.options.level || (this.options.mode === 'test' ? 'warn' : 'debug');
  }

  apply(compiler) {
    const compilerHooks = pluginCompat.hooks(compiler);

    compilerHooks.hardSourceLog.tap('HardSource - ChalkLoggerPlugin', value => {
      if (compareLevel(this.options.level, value.level) < 0) {
        return;
      }

      let headerColor = chalk.white;
      let color = chalk.white;
      if (value.level === 'error') {
        headerColor = chalk.red;
      } else if (value.level === 'warn') {
        headerColor = chalk.yellow;
      } else if (value.level === 'info') {
        headerColor = chalk.white;
      } else {
        headerColor = color = chalk.gray;
      }

      const header = headerColor(
        `[${DEFAULT_LOGGER_PREFIX}${LOGGER_SEPARATOR}${compiler.__hardSource_shortConfigHash ||
          value.from}]`,
      );

      // Always use warn or error so that output goes to stderr.
      const consoleFn = value.level === 'error' ? console.error : console.warn;

      let handle = messages[value.data.id];
      if (!handle) {
        handle = messages.unrecognized;
      }

      if (handle) {
        if (handle.once) {
          if (!this.once[value.data.id]) {
            this.once[value.data.id] = true;
            consoleFn.call(console, header, color(handle.once(value)));
          }
        } else if (handle.short) {
          consoleFn.call(console, header, color(handle.short(value)));
        }
      } else {
        consoleFn.call(console, header, color(value.message));
      }
    });
  }
}

module.exports = ChalkLoggerPlugin;
