var ContextDependency = require('webpack/lib/dependencies/ContextDependency');
var ModuleDependency = require('webpack/lib/dependencies/ModuleDependency');
var NullDependency = require('webpack/lib/dependencies/NullDependency');

module.exports = {
  HardModuleDependency: HardModuleDependency,
  HardContextDependency: HardContextDependency,
  HardNullDependency: HardNullDependency,
  HardHarmonyExportDependency: HardHarmonyExportDependency,
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
HardHarmonyExportDependency.prototype = Object.create(ModuleDependency.prototype);
HardHarmonyExportDependency.prototype.constructor = HardHarmonyExportDependency;
HardHarmonyExportDependency.prototype.describeHarmonyExport = function() {
  return {
    exportedName: this.name,
    precedence: this.precedence,
  }
};
