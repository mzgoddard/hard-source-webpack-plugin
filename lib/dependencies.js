var ContextDependency = require('webpack/lib/dependencies/ContextDependency');
var ModuleDependency = require('webpack/lib/dependencies/ModuleDependency');
var NullDependency = require('webpack/lib/dependencies/NullDependency');

var CriticalDependencyWarning;
try {
  CriticalDependencyWarning = require("webpack/lib/dependencies/CriticalDependencyWarning");
}
catch (_) {}

var HarmonyModulesHelpers;
var HarmonyImportDependency;
var HarmonyImportSpecifierDependency;
var HarmonyExportImportedSpecifierDependency;
var HarmonyCompatibilityDependency;
try {
  HarmonyModulesHelpers = require("webpack/lib/dependencies/HarmonyModulesHelpers");
  HarmonyImportDependency = require('webpack/lib/dependencies/HarmonyImportDependency');
  HarmonyImportSpecifierDependency = require('webpack/lib/dependencies/HarmonyImportSpecifierDependency');
  HarmonyExportExpressionDependency = require('webpack/lib/dependencies/HarmonyExportExpressionDependency');
  HarmonyExportSpecifierDependency = require('webpack/lib/dependencies/HarmonyExportSpecifierDependency');
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
  HardHarmonyExportExpressionDependency: HardHarmonyExportExpressionDependency,
  HardHarmonyExportHeaderDependency: HardHarmonyExportHeaderDependency,
  HardHarmonyExportSpecifierDependency: HardHarmonyExportSpecifierDependency,
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

function HardHarmonyExportHeaderDependency(range, rangeStatement) {
  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new NullDependency(),
      HardHarmonyExportHeaderDependency.prototype
    )
  );
  this.range = range;
  this.rangeStatement = rangeStatement;
}

Object.setPrototypeOf(HardHarmonyExportHeaderDependency.prototype, NullDependency.prototype);
Object.setPrototypeOf(HardHarmonyExportHeaderDependency, NullDependency);

function HardHarmonyExportExpressionDependency(originModule, range, rangeStatement) {
  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new HarmonyExportExpressionDependency(originModule, range, rangeStatement),
      HardHarmonyExportExpressionDependency.prototype
    )
  );
}

if (typeof HarmonyExportExpressionDependency !== 'undefined') {
  Object.setPrototypeOf(HardHarmonyExportExpressionDependency.prototype, HarmonyExportExpressionDependency.prototype);
  Object.setPrototypeOf(HardHarmonyExportExpressionDependency, HarmonyExportExpressionDependency);
}

function HardHarmonyExportSpecifierDependency(originModule, id, name, position, immutable) {
  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new HarmonyExportSpecifierDependency(originModule, id, name, position, immutable),
      HardHarmonyExportSpecifierDependency.prototype
    )
  );
}

if (typeof HarmonyExportSpecifierDependency !== 'undefined') {
  Object.setPrototypeOf(HardHarmonyExportSpecifierDependency.prototype, HarmonyExportSpecifierDependency.prototype);
  Object.setPrototypeOf(HardHarmonyExportSpecifierDependency, HarmonyExportSpecifierDependency);
}

function HardHarmonyImportDependency(request, importedVar, range) {
  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new HarmonyImportDependency(request, importedVar, range),
      HardHarmonyImportDependency.prototype
    )
  );
  // console.log('HardHarmonyImportDependency', this instanceof HarmonyImportDependency)
}

if (typeof HarmonyImportDependency !== 'undefined') {
  Object.setPrototypeOf(HardHarmonyImportDependency.prototype, HarmonyImportDependency.prototype);
  Object.setPrototypeOf(HardHarmonyImportDependency, HarmonyImportDependency);
}

HardHarmonyImportDependency.prototype.getReference = function() {
  if(!this.module) return null;
  return {
    module: this.module,
    importedNames: false
  };
};

function HardHarmonyImportSpecifierDependency(importDependency, importedVar, id, name, range, strictExportPresence) {
  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new HarmonyImportSpecifierDependency(importDependency, importedVar, id, name, range, strictExportPresence),
      HardHarmonyImportSpecifierDependency.prototype
    )
  );
}

if (typeof HarmonyImportSpecifierDependency !== 'undefined') {
  Object.setPrototypeOf(HardHarmonyImportSpecifierDependency.prototype, HarmonyImportSpecifierDependency.prototype);
  Object.setPrototypeOf(HardHarmonyImportSpecifierDependency, HarmonyImportSpecifierDependency);
}

function HardHarmonyExportImportedSpecifierDependency(originModule, importDependency, importedVar, id, name, activeExports, otherStarExports) {
  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new HarmonyExportImportedSpecifierDependency(originModule, importDependency, importedVar, id, name, activeExports, otherStarExports),
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
