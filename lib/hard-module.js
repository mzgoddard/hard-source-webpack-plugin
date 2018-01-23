var path = require('path');

var AsyncDependenciesBlock = require('webpack/lib/AsyncDependenciesBlock');
var DependenciesBlockVariable = require('webpack/lib/DependenciesBlockVariable');
var RawModule = require('webpack/lib/RawModule');

var ModuleError = require('webpack-core/lib/ModuleError');
var ModuleWarning = require('webpack-core/lib/ModuleWarning');

var RawSource = require('webpack-sources').RawSource;

var NormalModule = require('webpack/lib/NormalModule');

var relateContext = require('./util/relate-context');

module.exports = HardModule;

function HardModule(cacheItem, compilation, fileMd5s, cachedMd5s) {
  var identifier = relateContext.contextNormalRequest(compilation.compiler, cacheItem.identifier);
  var userRequest = relateContext.contextNormalRequest(compilation.compiler, cacheItem.userRequest);

  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new RawModule(cacheItem.source, identifier, userRequest),
      HardModule.prototype
    )
  );

  this.cacheItem = cacheItem;

  this.cacheable = true;
  this.request = relateContext.contextNormalRequest(compilation.compiler, cacheItem.request);
  this.userRequest = relateContext.contextNormalRequest(compilation.compiler, cacheItem.userRequest);
  this.rawRequest = relateContext.contextNormalRequest(compilation.compiler, cacheItem.rawRequest);
  this.resource = relateContext.contextNormalPath(compilation.compiler, cacheItem.resource);
  this.context = relateContext.contextNormalPath(compilation.compiler, cacheItem.context);
  this.loaders = relateContext.contextNormalLoaders(compilation.compiler, cacheItem.loaders);

  this.strict = cacheItem.strict;
  this.exportsArgument = cacheItem.exportsArgument;
  this.meta = cacheItem.meta;
  this.buildTimestamp = cacheItem.buildTimestamp;
  this.fileDependencies = relateContext.contextNormalPathArray(compilation.compiler, cacheItem.fileDependencies);
  this.contextDependencies = relateContext.contextNormalPathArray(compilation.compiler, cacheItem.contextDependencies);

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

HardModule.prototype.sourceDependency = NormalModule.prototype.sourceDependency;

HardModule.prototype.sourceVariables = NormalModule.prototype.sourceVariables;
HardModule.prototype.splitVariablesInUniqueNamedChunks = NormalModule.prototype.splitVariablesInUniqueNamedChunks;
HardModule.prototype.variableInjectionFunctionWrapperStartCode = NormalModule.prototype.variableInjectionFunctionWrapperStartCode;
HardModule.prototype.variableInjectionFunctionWrapperEndCode = NormalModule.prototype.variableInjectionFunctionWrapperEndCode;
HardModule.prototype.contextArgument = NormalModule.prototype.contextArgument;

HardModule.prototype.sourceBlock = NormalModule.prototype.sourceBlock;

HardModule.prototype.getHashDigest = NormalModule.prototype.getHashDigest;

HardModule.prototype.size = NormalModule.prototype.size;

HardModule.prototype.source = function(dependencyTemplates, outputOptions, requestShortener) {
  // const hash = require('crypto').createHash('md5');
  // updateHash.call(this, hash);
  // const _digest = hash.digest('hex');
  // if (this.getHashDigest(dependencyTemplates) === this.cacheItem.hashContentDigest) {
  //   // console.log('_renderedSource', this.cacheItem.identifier)
  //   return this._renderedSource;
  // }
  // console.log(this.getHashDigest(dependencyTemplates), _digest);
  // console.log('built source', this.cacheItem.identifier)
  return NormalModule.prototype.source.call(this, dependencyTemplates, outputOptions, requestShortener);
};

HardModule.prototype.updateHashWithSource = NormalModule.prototype.updateHashWithSource;
HardModule.prototype.updateHashWithMeta = NormalModule.prototype.updateHashWithMeta;
HardModule.prototype.updateHash = NormalModule.prototype.updateHash;
const updateHash = function(hash) {
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
  var thaw = compilation.__hardSourceMethods.thaw;
  var mapThaw = compilation.__hardSourceMethods.mapThaw;

  // Original file source or output from loaders.
  this._source = thaw('source', null, this.cacheItem._source, {
    compilation: compilation,
  });

  // Rendered source used in built output.
  this._cachedSource = {
    source: thaw('source', null, this.cacheItem._cachedSource.source, {
      compilation: compilation,
      source: this._source,
    }),
    hash: this.cacheItem._cachedSource.hash,
  };

  var extra = {
    state: {imports: {}},
    module: this,
    parent: this,
    compilation: compilation,
  };
  this.assets = thaw('module-assets', null, this.cacheItem.assets, extra);
  thaw('dependency-block', this, this.cacheItem.dependencyBlock, extra);
  this.errors = mapThaw('module-error', null, this.cacheItem.errors, extra);
  this.warnings = mapThaw('module-warning', null, this.cacheItem.warnings, extra);

  this.error = this.errors[0] || null;

  callback();
};
