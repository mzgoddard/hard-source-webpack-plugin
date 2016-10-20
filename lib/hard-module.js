var path = require('path');

var AsyncDependenciesBlock = require('webpack/lib/AsyncDependenciesBlock');
var DependenciesBlockVariable = require('webpack/lib/DependenciesBlockVariable');
var RawModule = require('webpack/lib/RawModule');

var ModuleError = require('webpack-core/lib/ModuleError');
var ModuleWarning = require('webpack-core/lib/ModuleWarning');

var RawSource = require('webpack-sources').RawSource;

var HardModuleDependency = require('./dependencies').HardModuleDependency;
var HardContextDependency = require('./dependencies').HardContextDependency;
var HardNullDependency = require('./dependencies').HardNullDependency;
var HardHarmonyExportDependency = require('./dependencies').HardHarmonyExportDependency;
var HardHarmonyImportDependency =
require('./dependencies').HardHarmonyImportDependency;
var HardHarmonyImportSpecifierDependency =
require('./dependencies').HardHarmonyImportSpecifierDependency;
var HardHarmonyExportImportedSpecifierDependency = require('./dependencies').HardHarmonyExportImportedSpecifierDependency;

var HardSource = require('./hard-source');

module.exports = HardModule;

function HardModule(cacheItem) {
  RawModule.call(this, cacheItem.source, cacheItem.identifier, cacheItem.userRequest);

  this.cacheItem = cacheItem;

  this.request = cacheItem.request;
  this.userRequest = cacheItem.userRequest;
  this.rawRequest = cacheItem.rawRequest;
  this.resource = cacheItem.resource;
  this.context = cacheItem.context;
  this.loaders = cacheItem.loaders;

  this.strict = cacheItem.strict;
  this.meta = cacheItem.meta;
  this.buildTimestamp = cacheItem.buildTimestamp;
  this.fileDependencies = cacheItem.fileDependencies;
  this.contextDependencies = cacheItem.contextDependencies;
}
HardModule.prototype = Object.create(RawModule.prototype);
HardModule.prototype.constructor = HardModule;

function needRebuild(buildTimestamp, fileDependencies, contextDependencies, fileTimestamps, contextTimestamps, fileMd5s, cachedMd5s) {
  var timestamp = 0;
  var needsMd5Rebuild = false;

  fileDependencies.forEach(function(file) {
    if (!needsMd5Rebuild) {
      needsMd5Rebuild = cachedMd5s[file] !== fileMd5s[file];
    }
    var ts = fileTimestamps[file];
    if(!ts) timestamp = Infinity;
    if(ts > timestamp) timestamp = ts;
  });
  contextDependencies.forEach(function(context) {
    var ts = contextTimestamps[context];
    if(!ts) timestamp = Infinity;
    if(ts > timestamp) timestamp = ts;
  });
  return timestamp >= buildTimestamp && needsMd5Rebuild;
}

HardModule.needRebuild = needRebuild;
HardModule.prototype.needRebuild = function(fileTimestamps, contextTimestamps) {
  return this.cacheItem.invalid || needRebuild(this.buildTimestamp, this.fileDependencies, this.contextDependencies, fileTimestamps, contextTimestamps);
};

HardModule.prototype.source = function() {
  return this._renderedSource;
};

HardModule.prototype.updateHash = function(hash) {
  hash.update(this.cacheItem.hashContent);
};

// HardModule.prototype.libIdent = function(options) {
//   return this.cacheItem.libIdent;
// };

// From webpack/lib/NormalModule.js
function contextify(options, request) {
  return request.split("!").map(function(r) {
    var rp = path.relative(options.context, r);
    if(path.sep === "\\")
      rp = rp.replace(/\\/g, "/");
    if(rp.indexOf("../") !== 0)
      rp = "./" + rp;
    return rp;
  }).join("!");
}

HardModule.prototype.libIdent = function(options) {
  return contextify(options, this.userRequest);
};

// HardModule.prototype.isUsed = function(exportName) {
//   return exportName ? exportName : false;
// };

function deserializeDependencies(deps, parent) {
  return deps.map(function(req) {
    if (req.contextDependency) {
      var dep = new HardContextDependency(req.request, req.recursive, req.regExp ? new RegExp(req.regExp) : null);
      dep.critical = req.contextCritical;
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
  .forEach(function(block) {
    parent.addBlock(block);
  });
}

function deserializeError(ErrorClass, state) {
  return function(serialized) {
    var err = new ErrorClass(this, serialized.message);
    if (serialized.origin) {
      err.origin = deserializeDependencies.call(state, [serialized.origin], this)[0];
    }
    if (serialized.dependencies) {
      err.dependencies = deserializeDependencies.call(state, serialized.dependencies, this);
    }
    return err;
  };
}

HardModule.prototype.build = function build(options, compilation, resolver, fs, callback) {
  // Non-rendered source used by Stats.
  if (this.cacheItem.rawSource) {
    this._source = new RawSource(this.cacheItem.rawSource);
  }
  // Rendered source used in built output.
  this._renderedSource = new HardSource(this.cacheItem);

  var state = {state: {imports: {}}};
  this.dependencies = deserializeDependencies.call(state, this.cacheItem.dependencies, this);
  this.variables = deserializeVariables.call(state, this.cacheItem.variables, this);
  this.warnings = this.cacheItem.warnings.map(deserializeError(ModuleWarning, state), this);
  this.errors = this.cacheItem.errors.map(deserializeError(ModuleError, state), this);
  deserializeBlocks.call(state, this.cacheItem.blocks, this);

  var cacheItem = this.cacheItem;
  this.assets = Object.keys(cacheItem.assets).reduce(function(carry, key) {
    var source = cacheItem.assets[key];
    if (source.type === 'Buffer') {
      source = new Buffer(source);
    }
    carry[key] = new RawSource(source);
    return carry;
  }, {});

  callback();
};
