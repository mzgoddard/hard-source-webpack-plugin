var AsyncDependenciesBlock = require('webpack/lib/AsyncDependenciesBlock');
var DependenciesBlockVariable = require('webpack/lib/DependenciesBlockVariable');

var HardModuleDependency = require('./dependencies').HardModuleDependency;
var HardContextDependency = require('./dependencies').HardContextDependency;
var HardNullDependency = require('./dependencies').HardNullDependency;
var HardHarmonyExportDependency = require('./dependencies').HardHarmonyExportDependency;
var HardHarmonyImportDependency =
require('./dependencies').HardHarmonyImportDependency;
var HardHarmonyImportSpecifierDependency =
require('./dependencies').HardHarmonyImportSpecifierDependency;
var HardHarmonyExportImportedSpecifierDependency = require('./dependencies').HardHarmonyExportImportedSpecifierDependency;
var HardHarmonyCompatibilityDependency = require('./dependencies').HardHarmonyCompatibilityDependency;

exports.dependencies = deserializeDependencies;
exports.variables = deserializeVariables;
exports.blocks = deserializeBlocks;

function deserializeDependencies(deps, parent) {
  return deps.map(function(req) {
    if (req.contextDependency) {
      var dep = new HardContextDependency(req.request, req.recursive, req.regExp ? new RegExp(req.regExp) : null);
      dep.critical = req.contextCritical;
      dep.async = req.async;
      dep.loc = req.loc;
      if (req.optional) {
        dep.optional = true;
      }
      return dep;
    }
    if (req.constDependency) {
      return new HardNullDependency();
    }
    if (req.harmonyExport) {
      return new HardHarmonyExportDependency(parent, req.harmonyId, req.harmonyName, req.harmonyPrecedence);
    }
    if (req.harmonyImport) {
      if (this.state.imports[req.request]) {
        return this.state.imports[req.request];
      }
      return this.state.imports[req.request] = new HardHarmonyImportDependency(req.request);
    }
    if (req.harmonyImportSpecifier) {
      if (!this.state.imports[req.harmonyRequest]) {
        this.state.imports[req.harmonyRequest] = new HardHarmonyImportDependency(req.harmonyRequest);
      }
      var dep = new HardHarmonyImportSpecifierDependency(this.state.imports[req.harmonyRequest], req.harmonyId, req.harmonyName);
      dep.loc = req.loc;
      return dep;
    }
    if (req.harmonyExportImportedSpecifier) {
      if (!this.state.imports[req.harmonyRequest]) {
        this.state.imports[req.harmonyRequest] = new HardHarmonyImportDependency(req.harmonyRequest);
      }
      return new HardHarmonyExportImportedSpecifierDependency(parent, this.state.imports[req.harmonyRequest], req.harmonyId, req.harmonyName);
    }
    if (req.harmonyCompatibility) {
      return new HardHarmonyCompatibilityDependency(parent);
    }
    var dep = new HardModuleDependency(req.request);
    dep.loc = req.loc;
    if (req.optional) {
      dep.optional = true;
    }
    return dep;
  }, this);
}
function deserializeVariables(vars, parent) {
  return vars.map(function(req) {
    return new DependenciesBlockVariable(req.name, req.expression, deserializeDependencies.call(this, req.dependencies, parent));
  }, this);
}
function deserializeBlocks(blocks, parent) {
  blocks.map(function(req) {
    if (req.async) {
      var block = new AsyncDependenciesBlock(req.name, parent);
      block.dependencies = deserializeDependencies.call(this, req.dependencies, parent);
      block.variables = deserializeVariables.call(this, req.variables, parent);
      deserializeBlocks(req.blocks, block);
      return block;
    }
  }, this)
  .filter(Boolean)
  .forEach(function(block) {
    parent.addBlock(block);
  });
}
