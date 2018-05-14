const ModuleError = require('webpack/lib/ModuleError');
const ModuleWarning = require('webpack/lib/ModuleWarning');

const pluginCompat = require('./util/plugin-compat');

class HardModuleErrorsPlugin {
  apply(compiler) {
    let freeze;
    let thaw;
    let mapFreeze;
    let mapThaw;

    pluginCompat.tap(compiler, '_hardSourceMethods', 'HardModuleErrorsPlugin', methods => {
      // store = methods.store;
      // fetch = methods.fetch;
      freeze = methods.freeze;
      thaw = methods.thaw;
      mapFreeze = methods.mapFreeze;
      mapThaw = methods.mapThaw;
    });

    function freezeErrorWarning(frozen, {message, details, originLoc, dependencies}, extra) {
      return {
        message: message,
        details: details,
        originLoc: originLoc,
        dependencies: dependencies && mapFreeze('Dependency', null, dependencies, extra),
      };
    }

    pluginCompat.tap(compiler, '_hardSourceFreezeModuleError', 'HardModuleErrorsPlugin', freezeErrorWarning);
    pluginCompat.tap(compiler, '_hardSourceFreezeModuleWarning', 'HardModuleErrorsPlugin', freezeErrorWarning);

    function thawError(ErrorClass, error, {message, details, originLoc, dependencies}, extra) {
      const module = extra.module;
      error = new ErrorClass(module, message);
      if (details) {
        error.details = details;
      }

      if (extra.origin) {
        error.origin = extra.origin;
      }
      if (originLoc) {
        error.originLoc = originLoc;
      }
      if (dependencies) {
        error.dependencies = mapThaw('Dependency', null, dependencies, extra);
      }
      return error;
    }

    pluginCompat.tap(compiler, '_hardSourceThawModuleError', 'HardModuleErrorsPlugin', (error, frozen, extra) => thawError(ModuleError, error, frozen, extra));

    pluginCompat.tap(compiler, '_hardSourceThawModuleWarning', 'HardModuleErrorsPlugin', (warning, frozen, extra) => thawError(ModuleWarning, warning, frozen, extra));
  }
}

module.exports = HardModuleErrorsPlugin;
