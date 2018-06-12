const WebpackError = require('webpack/lib/WebpackError');
const ModuleError = require('webpack/lib/ModuleError');
const ModuleWarning = require('webpack/lib/ModuleWarning');

const pluginCompat = require('./util/plugin-compat');

class TransformModuleErrorsPlugin {
  apply(compiler) {
    let freeze;
    let thaw;
    let mapFreeze;
    let mapThaw;

    pluginCompat.tap(
      compiler,
      '_hardSourceMethods',
      'TransformModuleErrorsPlugin',
      methods => {
        // store = methods.store;
        // fetch = methods.fetch;
        freeze = methods.freeze;
        thaw = methods.thaw;
        mapFreeze = methods.mapFreeze;
        mapThaw = methods.mapThaw;
      },
    );

    function freezeErrorWarning(
      frozen,
      { message, details, originLoc, dependencies, name, loc, constructor },
      extra,
    ) {
      return {
        constructor: constructor.name,
        message: message,
        details: details,
        originLoc: originLoc,
        dependencies:
          dependencies && mapFreeze('Dependency', null, dependencies, extra),
        name: name,
        loc: loc,
      };
    }

    pluginCompat.tap(
      compiler,
      '_hardSourceFreezeModuleError',
      'TransformModuleErrorsPlugin',
      freezeErrorWarning,
    );
    pluginCompat.tap(
      compiler,
      '_hardSourceFreezeModuleWarning',
      'TransformModuleErrorsPlugin',
      freezeErrorWarning,
    );

    function thawError(
      ErrorClass,
      error,
      { constructor, message, details, originLoc, dependencies, name, loc },
      extra,
    ) {
      const module = extra.module;
      error = new ErrorClass(module, message);
      if (constructor === 'SystemImportDeprecationWarning') {
        error = new WebpackError(message);
        error.module = module;
      }
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
      if (name) {
        error.name = name;
      }
      if (loc) {
        error.loc = loc;
      }
      return error;
    }

    pluginCompat.tap(
      compiler,
      '_hardSourceThawModuleError',
      'TransformModuleErrorsPlugin',
      (error, frozen, extra) => thawError(ModuleError, error, frozen, extra),
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceThawModuleWarning',
      'TransformModuleErrorsPlugin',
      (warning, frozen, extra) =>
        thawError(ModuleWarning, warning, frozen, extra),
    );
  }
}

module.exports = TransformModuleErrorsPlugin;
