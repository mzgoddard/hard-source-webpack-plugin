var ContextDependency = require('webpack/lib/dependencies/ContextDependency');
var ModuleDependency = require('webpack/lib/dependencies/ModuleDependency');
var NullDependency = require('webpack/lib/dependencies/NullDependency');

var CriticalDependencyWarning;
try {
  CriticalDependencyWarning = require("webpack/lib/dependencies/CriticalDependencyWarning");
}
catch (_) {}

var HarmonyModulesHelpers, HarmonyImportSpecifierDependency, HarmonyExportImportedSpecifierDependency, HarmonyCompatibilityDependency;
try {
  HarmonyModulesHelpers = require("webpack/lib/dependencies/HarmonyModulesHelpers");
  HarmonyImportSpecifierDependency = require('webpack/lib/dependencies/HarmonyImportSpecifierDependency');
  HarmonyExportImportedSpecifierDependency = require('webpack/lib/dependencies/HarmonyExportImportedSpecifierDependency');
  try {
    HarmonyCompatibilityDependency = require('webpack/lib/dependencies/HarmonyCompatibilityDependency');
  }
  catch (_) {
    HarmonyCompatibilityDependency = require('webpack/lib/dependencies/HarmonyCompatiblilityDependency');
  }
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
  HardHarmonyCompatibilityDependency: HardHarmonyCompatibilityDependency,
};

function HardModuleDependency(request) {
  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new ModuleDependency(request),
      HardModuleDependency.prototype
    )
  );
}
Object.setPrototypeOf(HardModuleDependency.prototype, ModuleDependency.prototype);
Object.setPrototypeOf(HardModuleDependency, ModuleDependency);

function HardContextDependency(request, recursive, regExp) {
  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new ContextDependency(request, recursive, regExp),
      HardContextDependency.prototype
    )
  );
}
Object.setPrototypeOf(HardContextDependency.prototype, ContextDependency.prototype);
Object.setPrototypeOf(HardContextDependency, ContextDependency);

if (CriticalDependencyWarning) {
  HardContextDependency.prototype.getWarnings = function() {
    if(this.critical) {
      return [
        new CriticalDependencyWarning(this.critical)
      ];
    }
  };
}

function HardNullDependency() {
  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new NullDependency(),
      HardNullDependency.prototype
    )
  );
}
Object.setPrototypeOf(HardNullDependency.prototype, NullDependency.prototype);
Object.setPrototypeOf(HardNullDependency, NullDependency);

function HardModuleDependencyTemplate() {
}
HardModuleDependencyTemplate.prototype.apply = function() {};
HardModuleDependencyTemplate.prototype.applyAsTemplateArgument = function() {};

function HardHarmonyExportDependency(originModule, id, name, precedence) {
  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new NullDependency(),
      HardHarmonyExportDependency.prototype
    )
  );
  this.originModule = originModule;
  this.id = id;
  this.name = name;
  this.precedence = precedence;
}
Object.setPrototypeOf(HardHarmonyExportDependency.prototype, NullDependency.prototype);
Object.setPrototypeOf(HardHarmonyExportDependency, NullDependency);

HardHarmonyExportDependency.prototype.getExports = function() {
  return {
    exports: [this.name],
  }
};

HardHarmonyExportDependency.prototype.describeHarmonyExport = function() {
  return {
    exportedName: this.name,
    precedence: this.precedence,
  }
};

function HardHarmonyImportDependency(request) {
  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new ModuleDependency(request),
      HardHarmonyImportDependency.prototype
    )
  );
}
Object.setPrototypeOf(HardHarmonyImportDependency.prototype, ModuleDependency.prototype);
Object.setPrototypeOf(HardHarmonyImportDependency, ModuleDependency);
HardHarmonyImportDependency.prototype.getReference = function() {
  if(!this.module) return null;
  return {
    module: this.module,
    importedNames: false
  };
};

function HardHarmonyImportSpecifierDependency(importDependency, id, name) {
  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new HarmonyImportSpecifierDependency(importDependency, null, id, name, null),
      HardHarmonyImportSpecifierDependency.prototype
    )
  );
}

if (typeof HarmonyImportSpecifierDependency !== 'undefined') {
  Object.setPrototypeOf(HardHarmonyImportSpecifierDependency.prototype, HarmonyImportSpecifierDependency.prototype);
  Object.setPrototypeOf(HardHarmonyImportSpecifierDependency, HarmonyImportSpecifierDependency);
}

function HardHarmonyExportImportedSpecifierDependency(originModule, importDependency, id, name) {
  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new HarmonyExportImportedSpecifierDependency(originModule, importDependency, null, id, name, null),
      HardHarmonyExportImportedSpecifierDependency.prototype
    )
  );
}

if (typeof HarmonyExportImportedSpecifierDependency !== 'undefined') {
  Object.setPrototypeOf(HardHarmonyExportImportedSpecifierDependency.prototype, HarmonyExportImportedSpecifierDependency.prototype);
  Object.setPrototypeOf(HardHarmonyExportImportedSpecifierDependency, HarmonyExportImportedSpecifierDependency);
}

function HardHarmonyCompatibilityDependency(originModule) {
  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new HarmonyCompatibilityDependency(originModule),
      HardHarmonyCompatibilityDependency.prototype
    )
  );
}

if (typeof HarmonyCompatibilityDependency !== 'undefined') {
  Object.setPrototypeOf(HardHarmonyCompatibilityDependency.prototype, HarmonyCompatibilityDependency.prototype);
  Object.setPrototypeOf(HardHarmonyCompatibilityDependency, HarmonyCompatibilityDependency);
}
