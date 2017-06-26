var HarmonyImportDependency = require('webpack/lib/dependencies/HarmonyImportDependency');
var HarmonyExportImportedSpecifierDependency = require('webpack/lib/dependencies/HarmonyExportImportedSpecifierDependency');
var HarmonyImportSpecifierDependency = require('webpack/lib/dependencies/HarmonyImportSpecifierDependency');
var HarmonyCompatibilityDependency = require('webpack/lib/dependencies/HarmonyCompatibilityDependency');

var HardHarmonyExportDependency = require('./dependencies').HardHarmonyExportDependency;
var HardHarmonyImportDependency = require('./dependencies').HardHarmonyImportDependency;
var HardHarmonyImportSpecifierDependency = require('./dependencies').HardHarmonyImportSpecifierDependency;
var HardHarmonyExportImportedSpecifierDependency = require('./dependencies').HardHarmonyExportImportedSpecifierDependency;
var HardHarmonyCompatibilityDependency = require('./dependencies').HardHarmonyCompatibilityDependency;

function HardHarmonyDependencyPlugin() {}

HardHarmonyDependencyPlugin.prototype.apply = function(compiler) {
  var freeze, thaw;

  compiler.plugin('--hard-source-methods', function(methods) {
    // store = methods.store;
    // fetch = methods.fetch;
    freeze = methods.freeze;
    thaw = methods.thaw;
    // mapFreeze = methods.mapFreeze;
    // mapThaw = methods.mapThaw;
  });

  compiler.plugin('--hard-source-freeze-dependency', function(frozen, dependency, extra) {
    if (dependency instanceof HarmonyImportDependency) {
      return {
        type: 'HarmonyImportDependency',
        request: dependency.request,
        importedVar: dependency.importedVar,
        range: dependency.range,
      };
    }
    else if (dependency instanceof HarmonyExportImportedSpecifierDependency) {
      return {
        type: 'HarmonyExportImportedSpecifierDependency',
        importDependency: freeze('dependency', null, dependency.importDependency, extra),
        id: dependency.id,
        name: dependency.name,
      };
    }
    else if (dependency instanceof HarmonyImportSpecifierDependency) {
      return {
        type: 'HarmonyImportSpecifierDependency',
        importDependency: freeze('dependency', null, dependency.importDependency, extra),
        id: dependency.id,
        name: dependency.name,
      };
    }
    else if (dependency instanceof HarmonyCompatibilityDependency) {
      return {
        type: 'HarmonyCompatibilityDependency',
      };
    }
    else if (dependency.originModule && dependency.describeHarmonyExport) {
      return {
        type: 'HarmonyExportDependency',
        id: dependency.id,
        name: dependency.describeHarmonyExport().exportedName,
        precedence: dependency.describeHarmonyExport().precedence,
      };
    }

    return frozen;
  });

  compiler.plugin('--hard-source-thaw-dependency', function(dependency, frozen, extra) {
    var parent = extra.parent;
    var state = extra.state;

    if (frozen.type === 'HarmonyExportDependency') {
      return new HardHarmonyExportDependency(
        parent,
        frozen.id,
        frozen.name,
        frozen.precedence
      );
    }
    else if (frozen.type === 'HarmonyImportDependency') {
      if (state.imports[frozen.request]) {
        return state.imports[frozen.request];
      }
      return state.imports[frozen.request] =
        new HardHarmonyImportDependency(
          frozen.request,
          frozen.importedVar,
          frozen.range
        );
    }
    else if (frozen.type === 'HarmonyImportSpecifierDependency') {
      return new HardHarmonyImportSpecifierDependency(
        thaw('dependency', null, frozen.importDependency, extra),
        frozen.id,
        frozen.name
      );
    }
    else if (frozen.type === 'HarmonyExportImportedSpecifierDependency') {
      return new HardHarmonyExportImportedSpecifierDependency(
        parent,
        thaw('dependency', null, frozen.importDependency, extra),
        frozen.id,
        frozen.name
      );
    }
    else if (frozen.type === 'HarmonyCompatibilityDependency') {
      return new HardHarmonyCompatibilityDependency(parent);
    }

    return dependency;
  });
};

module.exports = HardHarmonyDependencyPlugin;
