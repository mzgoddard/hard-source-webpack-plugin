var ContextDependency = require('webpack/lib/dependencies/ContextDependency');
var ModuleDependency = require('webpack/lib/dependencies/ModuleDependency');
var NullDependency = require('webpack/lib/dependencies/NullDependency');

var HarmonyModulesHelpers, HarmonyImportSpecifierDependency, HarmonyExportImportedSpecifierDependency;
try {
  HarmonyModulesHelpers = require("webpack/lib/dependencies/HarmonyModulesHelpers");
  HarmonyImportSpecifierDependency = require('webpack/lib/dependencies/HarmonyImportSpecifierDependency');
  HarmonyExportImportedSpecifierDependency = require('webpack/lib/dependencies/HarmonyExportImportedSpecifierDependency');
}
catch (_) {}

module.exports = {
  HardModuleDependency: HardModuleDependency,
  HardContextDependency: HardContextDependency,
  HardNullDependency: HardNullDependency,
  HardHarmonyExportDependency: HardHarmonyExportDependency,
  HardHarmonyImportDependency: HardHarmonyImportDependency,
  HardHarmonyImportSpecifierDependency: HardHarmonyImportSpecifierDependency,
  HardHarmonyExportImportedSpecifierDependency: HardHarmonyExportImportedSpecifierDependency,
};

function HardModuleDependency(request) {
  ModuleDependency.call(this, request);
}
HardModuleDependency.prototype = Object.create(ModuleDependency.prototype);
HardModuleDependency.prototype.constructor = HardModuleDependency;

function HardContextDependency(request, recursive, regExp) {
  ContextDependency.call(this, request, recursive, regExp);
}
HardContextDependency.prototype = Object.create(ContextDependency.prototype);
HardContextDependency.prototype.constructor = HardContextDependency;

function HardNullDependency() {
  NullDependency.call(this);
}
HardNullDependency.prototype = Object.create(NullDependency.prototype);
HardNullDependency.prototype.constructor = HardNullDependency;

function HardModuleDependencyTemplate() {
}
HardModuleDependencyTemplate.prototype.apply = function() {};
HardModuleDependencyTemplate.prototype.applyAsTemplateArgument = function() {};

function HardHarmonyExportDependency(originModule, id, name, precedence) {
  NullDependency.call(this);
  this.originModule = originModule;
  this.id = id;
  this.name = name;
  this.precedence = precedence;
}
HardHarmonyExportDependency.prototype = Object.create(NullDependency.prototype);
HardHarmonyExportDependency.prototype.constructor = HardHarmonyExportDependency;
HardHarmonyExportDependency.prototype.describeHarmonyExport = function() {
  return {
    exportedName: this.name,
    precedence: this.precedence,
  }
};

function HardHarmonyImportDependency(request) {
  ModuleDependency.call(this, request);
}
HardHarmonyImportDependency.prototype = Object.create(ModuleDependency.prototype);
HardHarmonyImportDependency.prototype.constructor = HardHarmonyImportDependency;
HardHarmonyImportDependency.prototype.getReference = function() {
  if(!this.module) return null;
  return {
    module: this.module,
    importedNames: false
  };
};

function HardHarmonyImportSpecifierDependency(importDependency, id, name) {
  HarmonyImportSpecifierDependency.call(this, importDependency, null, id, name, null);
}

if (typeof HarmonyImportSpecifierDependency !== 'undefined') {
  HardHarmonyImportSpecifierDependency.prototype = Object.create(HarmonyImportSpecifierDependency.prototype);
  HardHarmonyImportSpecifierDependency.prototype.constructor = HardHarmonyImportSpecifierDependency;
}

function HardHarmonyExportImportedSpecifierDependency(originModule, importDependency, id, name) {
  HarmonyExportImportedSpecifierDependency.call(this, originModule, importDependency, null, id, name, null);
}

if (typeof HarmonyExportImportedSpecifierDependency !== 'undefined') {
  HardHarmonyExportImportedSpecifierDependency.prototype = Object.create(HarmonyExportImportedSpecifierDependency.prototype);
  HardHarmonyExportImportedSpecifierDependency.prototype.constructor = HardHarmonyExportImportedSpecifierDependency;
}
