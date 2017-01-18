import AsyncDependenciesBlock from 'webpack/lib/AsyncDependenciesBlock';
import DependenciesBlockVariable from 'webpack/lib/DependenciesBlockVariable';
import {HardModuleDependency} from './dependencies';
import {HardContextDependency} from './dependencies';
import {HardNullDependency} from './dependencies';
import {HardHarmonyExportDependency} from './dependencies';
import {HardHarmonyImportDependency} from './dependencies';
import {HardHarmonyImportSpecifierDependency} from './dependencies';
import {HardHarmonyExportImportedSpecifierDependency} from './dependencies';
export {deserializeDependencies as dependencies};
export {deserializeVariables as variables};
export {deserializeBlocks as blocks};

function deserializeDependencies(deps, parent) {
  return deps.map(function(req) {
    if (req.contextDependency) {
      var dep = new HardContextDependency(req.request, req.recursive, req.regExp ? new RegExp(req.regExp) : null);
      dep.critical = req.contextCritical;
      dep.async = req.async;
      dep.loc = req.loc;
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
    var dep = new HardModuleDependency(req.request);
    dep.loc = req.loc;
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
  .forEach(block => {
    parent.addBlock(block);
  });
}
