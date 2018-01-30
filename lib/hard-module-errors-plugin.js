var ModuleError = require('webpack-core/lib/ModuleError');
var ModuleWarning = require('webpack-core/lib/ModuleWarning');

var pluginCompat = require('./util/plugin-compat');

function HardModuleErrorsPlugin() {}

HardModuleErrorsPlugin.prototype.apply = function(compiler) {
  var freeze, thaw, mapFreeze, mapThaw;

  pluginCompat.tap(compiler, '_hardSourceMethods', 'HardModuleErrorsPlugin', function(methods) {
    // store = methods.store;
    // fetch = methods.fetch;
    freeze = methods.freeze;
    thaw = methods.thaw;
    mapFreeze = methods.mapFreeze;
    mapThaw = methods.mapThaw;
  });

  function freezeErrorWarning(frozen, error, extra) {
    return {
      message: error.message,
      details: error.details,
      originLoc: error.originLoc,
      dependencies: error.dependencies && mapFreeze('Dependency', null, error.dependencies, extra),
    };
  }

  pluginCompat.tap(compiler, '_hardSourceFreezeModuleError', 'HardModuleErrorsPlugin', freezeErrorWarning);
  pluginCompat.tap(compiler, '_hardSourceFreezeModuleWarning', 'HardModuleErrorsPlugin', freezeErrorWarning);

  function thawError(ErrorClass, error, frozen, extra) {
    var module = extra.module;
    error = new ErrorClass(module, frozen.message);
    if (frozen.details) {
      error.details = frozen.details;
    }

    if (extra.origin) {
      error.origin = extra.origin;
    }
    if (frozen.originLoc) {
      error.originLoc = frozen.originLoc;
    }
    if (frozen.dependencies) {
      error.dependencies = mapThaw('Dependency', null, frozen.dependencies, extra);
    }
    return error;
  }

  pluginCompat.tap(compiler, '_hardSourceThawModuleError', 'HardModuleErrorsPlugin', function(error, frozen, extra) {
    return thawError(ModuleError, error, frozen, extra);
  });

  pluginCompat.tap(compiler, '_hardSourceThawModuleWarning', 'HardModuleErrorsPlugin', function(warning, frozen, extra) {
    return thawError(ModuleWarning, warning, frozen, extra);
  });
};

module.exports = HardModuleErrorsPlugin;
