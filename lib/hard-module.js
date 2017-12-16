var path = require('path');

var AsyncDependenciesBlock = require('webpack/lib/AsyncDependenciesBlock');
var DependenciesBlockVariable = require('webpack/lib/DependenciesBlockVariable');
var RawModule = require('webpack/lib/RawModule');

var ModuleError = require('webpack-core/lib/ModuleError');
var ModuleWarning = require('webpack-core/lib/ModuleWarning');

var RawSource = require('webpack-sources').RawSource;

var HardSource = require('./hard-source');

module.exports = HardModule;

function HardModule(cacheItem, fileMd5s, cachedMd5s) {
  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new RawModule(cacheItem.source, cacheItem.identifier, cacheItem.userRequest),
      HardModule.prototype
    )
  );

  this.cacheItem = cacheItem;

  this.cacheable = true;
  this.request = cacheItem.request;
  this.userRequest = cacheItem.userRequest;
  this.rawRequest = cacheItem.rawRequest;
  this.resource = cacheItem.resource;
  this.context = cacheItem.context;
  this.loaders = cacheItem.loaders;

  this.strict = cacheItem.strict;
  this.exportsArgument = cacheItem.exportsArgument;
  this.meta = cacheItem.meta;
  this.buildTimestamp = cacheItem.buildTimestamp;
  this.fileDependencies = cacheItem.fileDependencies;
  this.contextDependencies = cacheItem.contextDependencies;

  this.fileMd5s = fileMd5s;
  this.cachedMd5s = cachedMd5s;
}
Object.setPrototypeOf(HardModule.prototype, RawModule.prototype);
Object.setPrototypeOf(HardModule, RawModule);

HardModule.prototype.isHard = function() {return true;};

function needRebuild(cacheItem, fileDependencies, contextDependencies, fileTimestamps, contextTimestamps, fileMd5s, cachedMd5s) {
  var timestamp = 0;
  var buildTimestamp = cacheItem.buildTimestamp;
  var needsMd5Rebuild = !(fileMd5s && cachedMd5s);

  if (fileDependencies) {
    fileDependencies.forEach(function(file) {
      if (!needsMd5Rebuild) {
        needsMd5Rebuild = cachedMd5s[file] !== fileMd5s[file] || !cachedMd5s[file];
      }
      var ts = fileTimestamps[file];
      if(!ts) timestamp = Infinity;
      if(ts > timestamp) timestamp = ts;
    });
  }
  if (contextDependencies) {
    contextDependencies.forEach(function(context) {
      if (!needsMd5Rebuild) {
        needsMd5Rebuild = cachedMd5s[context] !== fileMd5s[context] || !cachedMd5s[context];
      }
      var ts = contextTimestamps[context];
      if(!ts) timestamp = Infinity;
      if(ts > timestamp) timestamp = ts;
    });
  }
  if (needsMd5Rebuild && fileMd5s && cachedMd5s) {
    cacheItem.invalid = true;
    cacheItem.invalidReason = 'md5 mismatch';
  }
  return (
    cacheItem.errors && cacheItem.errors.length > 0 ||
    cacheItem.invalid ||
    timestamp >= buildTimestamp && needsMd5Rebuild ||
    needsMd5Rebuild && fileMd5s && cachedMd5s
  );
}

HardModule.needRebuild = needRebuild;
HardModule.prototype.needRebuild = function(fileTimestamps, contextTimestamps) {
  return this.error || this.cacheItem.invalid || needRebuild(this.cacheItem, this.fileDependencies, this.contextDependencies, fileTimestamps, contextTimestamps, this.fileMd5s, this.cachedMd5s);
};

HardModule.prototype.source = function() {
  return this._renderedSource;
};

HardModule.prototype.updateHash = function(hash) {
  if (!this.cacheItem.rawSource) {
    hash.update('null');
    return;
  }
  hash.update('source');
  hash.update(this.cacheItem.rawSource);
  if (this.cacheItem.sourceMap.originalSource) {
    hash.update(this.cacheItem.sourceMap.originalSource);
  }

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

HardModule.prototype.build = function build(options, compilation, resolver, fs, callback) {
  // Non-rendered source used by Stats.
  if (this.cacheItem.rawSource) {
    this._source = new RawSource(this.cacheItem.rawSource);
  }
  // Rendered source used in built output.
  this._renderedSource = new HardSource(this.cacheItem);

  var thaw = compilation.__hardSourceMethods.thaw;
  var mapThaw = compilation.__hardSourceMethods.mapThaw;

  var extra = {
    state: {imports: {}},
    module: this,
    parent: this,
  };
  this.assets = thaw('module-assets', null, this.cacheItem.assets, extra);
  // console.log(this.assets);
  thaw('dependency-block', this, this.cacheItem.dependencyBlock, extra);
  // console.log(this.identifier(), this.dependencies.map(function(dep) {
  //   return dep.constructor.name;
  // }))
  this.errors = mapThaw('module-error', null, this.cacheItem.errors, extra);
  this.warnings = mapThaw('module-warning', null, this.cacheItem.warnings, extra);

  this.error = this.errors[0] || null;

  callback();
};
