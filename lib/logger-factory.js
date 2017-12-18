/**
 * The LoggerFactory wraps a hard source plugin exposed on the webpack Compiler.
 *
 * The plugin handle, `'hard-source-log'` takes one object as input and should
 * log it to the console, disk, or somewhere. Or not if it the message should
 * be ignored. The object has a few arguments that generally follows this
 * structure. The `data` key will generally have an `id` value.
 *
 * ```js
 * {
 *   from: 'core',
 *   level: 'error',
 *   message: 'HardSourceWebpackPlugin requires a cacheDirectory setting.',
 *   data: {
 *     id: 'need-cache-directory-option'
 *   }
 * }
 * ```
 *
 * So a simple plugin handle may be
 *
 * ```js
 * compiler.plugin('hard-source-log', function(message) {
 *   console[message.level].call(
 *     console,
 *     'hard-source:' + message.from, message.message
 *   );
 * });
 * ```
 *
 * @module hard-source-webpack-plugin/logger-factory
 * @author Michael "Z" Goddard <mzgoddard@gmail.com>
 */

var LOGGER_SEPARATOR = ':';
var DEFAULT_LOGGER_PREFIX = 'hard-source';
var LOGGER_FACTORY_COMPILER_KEY = __dirname +
  '/hard-source-logger-factory-compiler-key';

/**
 * @constructor Logger
 * @memberof module:hard-source-webpack-plugin/logger-factory
 */
function Logger(compiler) {
  this.compiler = compiler;
  this._lock = null;
}

/**
 * @method lock
 * @memberof module:hard-source-webpack-plugin/logger-factory~Logger#
 */
Logger.prototype.lock = function() {
  this._lock = [];
};

/**
 * @method unlock
 * @memberof module:hard-source-webpack-plugin/logger-factory~Logger#
 */
Logger.prototype.unlock = function() {
  var _this = this;
  if (_this._lock) {
    var lock = _this._lock;
    _this._lock = null;
    lock.forEach(function(value) {_this.write(value);});
  }
};

/**
 * @method write
 * @memberof module:hard-source-webpack-plugin/logger-factory~Logger#
 */
Logger.prototype.write = function(value) {
  if (this._lock) {
    return this._lock.push(value);
  }

  if (
    this.compiler._plugins['hard-source-log'] &&
    this.compiler._plugins['hard-source-log'].length
  ) {
    (
      this.compiler.applyPlugins1 ||
      this.compiler.applyPlugins
    ).call(this.compiler, 'hard-source-log', value);
  }
  else {
    (console[value.level] || console.error).call(
      console,
      '[' + DEFAULT_LOGGER_PREFIX + LOGGER_SEPARATOR + value.from + ']',
      value.message
    );
  }
};

/**
 * @method from
 * @memberof module:hard-source-webpack-plugin/logger-factory~Logger#
 */
Logger.prototype.from = function(name) {
  return new LoggerFrom(this, name);
};

/**
 * @constructor LoggerFrom
 * @memberof module:hard-source-webpack-plugin/logger-factory
 */
function LoggerFrom(logger, from) {
  this._logger = logger;
  this._from = from;
}

/**
 * @method from
 * @memberof module:hard-source-webpack-plugin/logger-factory~LoggerFrom#
 */
LoggerFrom.prototype.from = function(name) {
  return new LoggerFrom(this._logger, this._from + LOGGER_SEPARATOR + name);
};

/**
 * @method _write
 * @memberof module:hard-source-webpack-plugin/logger-factory~LoggerFrom#
 */
LoggerFrom.prototype._write = function(level, data, message) {
  this._logger.write({
    from: this._from,
    level: level,
    message: message,
    data: data,
  });
};

/**
 * @method error
 * @memberof module:hard-source-webpack-plugin/logger-factory~LoggerFrom#
 */
LoggerFrom.prototype.error = function(data, message) {
  this._write('error', data, message);
};

/**
 * @method warn
 * @memberof module:hard-source-webpack-plugin/logger-factory~LoggerFrom#
 */
LoggerFrom.prototype.warn = function(data, message) {
  this._write('warn', data, message);
};

/**
 * @method info
 * @memberof module:hard-source-webpack-plugin/logger-factory~LoggerFrom#
 */
LoggerFrom.prototype.info = function(data, message) {
  this._write('info', data, message);
};

/**
 * @method log
 * @memberof module:hard-source-webpack-plugin/logger-factory~LoggerFrom#
 */
LoggerFrom.prototype.log = function(data, message) {
  this._write('log', data, message);
};

/**
 * @method debug
 * @memberof module:hard-source-webpack-plugin/logger-factory~LoggerFrom#
 */
LoggerFrom.prototype.debug = function(data, message) {
  this._write('debug', data, message);
};

/**
 * @constructor LoggerFactory
 * @memberof module:hard-source-webpack-plugin/logger-factory
 */
function LoggerFactory(compiler) {
  this.compiler = compiler;
}

/**
 * @method create
 * @memberof module:hard-source-webpack-plugin/logger-factory~LoggerFactory#
 */
LoggerFactory.prototype.create = function() {
  var compiler = this.compiler;
  if (!compiler[LOGGER_FACTORY_COMPILER_KEY]) {
    compiler[LOGGER_FACTORY_COMPILER_KEY] = new Logger(this.compiler);
  }
  return compiler[LOGGER_FACTORY_COMPILER_KEY];
};

/**
 * @function getLogger
 * @memberof module:hard-source-webpack-plugin/logger-factory~LoggerFactory.
 */
LoggerFactory.getLogger = function(compilation) {
  while (compilation.compiler.parentCompilation) {
    compilation = compilation.compiler.parentCompilation;
  }
  return new LoggerFactory(compilation.compiler).create();
};

module.exports = LoggerFactory;
