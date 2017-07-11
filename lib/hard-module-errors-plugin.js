var ModuleError = require('webpack-core/lib/ModuleError');
var ModuleWarning = require('webpack-core/lib/ModuleWarning');

function HardModuleErrorsPlugin() {}

HardModuleErrorsPlugin.prototype.apply = function(compiler) {
  var freeze, thaw, mapFreeze, mapThaw;

  compiler.plugin('--hard-source-methods', function(methods) {
    // store = methods.store;
    // fetch = methods.fetch;
    freeze = methods.freeze;
    thaw = methods.thaw;
    mapFreeze = methods.mapFreeze;
    mapThaw = methods.mapThaw;
  });

  compiler.plugin(['--hard-source-freeze-module-error', '--hard-source-freeze-module-warning'], function(frozen, error, extra) {
    return {
      message: error.message,
      details: error.details,
      origin: error.origin && freeze('dependency', null, error.origin, extra),
      dependencies: error.dependencies && mapFreeze('dependency', null, error.dependencies, extra),
    };
  });

  function thawError(ErrorClass, error, frozen, extra) {
    var module = extra.module;
    error = new ErrorClass(module, frozen.message);
    if (frozen.details) {
      error.details = frozen.details;
    }

    if (frozen.origin) {
      error.origin = thaw('dependency', null, frozen.origin, extra);
    }
    if (frozen.dependencies) {
      error.origin = mapThaw('dependency', null, frozen.dependencies, extra);
    }
    return error;
  }

  compiler.plugin('--hard-source-thaw-module-error', function(error, frozen, extra) {
    return thawError(ModuleError, error, frozen, extra);
  });

  compiler.plugin('--hard-source-thaw-module-warning', function(warning, frozen, extra) {
    return thawError(ModuleWarning, warning, frozen, extra);
  });
};

module.exports = HardModuleErrorsPlugin;
