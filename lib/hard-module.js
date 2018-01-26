const path = require('path');

const RawModule = require('webpack/lib/RawModule');
const NormalModule = require('webpack/lib/NormalModule');

const relateContext = require('./util/relate-context');

class HardModule extends RawModule {
  constructor(cacheItem, compilation, fileMd5s, cachedMd5s) {
    const identifier = relateContext.contextNormalRequest(compilation.compiler, cacheItem.identifier);
    const userRequest = relateContext.contextNormalRequest(compilation.compiler, cacheItem.userRequest);

    super(cacheItem.source, identifier, userRequest);

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

  isHard() {return true;}

  needRebuild(fileTimestamps, contextTimestamps) {
    return this.error || this.cacheItem.invalid || needRebuild(this.cacheItem, this.fileDependencies, this.contextDependencies, fileTimestamps, contextTimestamps, this.fileMd5s, this.cachedMd5s);
  }

  source(dependencyTemplates, outputOptions, requestShortener) {
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
  }

  libIdent(options) {
    return contextify(options, this.userRequest);
  }

  // HardModule.prototype.isUsed = function(exportName) {
  //   return exportName ? exportName : false;
  // };

  build(options, compilation, resolver, fs, callback) {
    const thaw = compilation.__hardSourceMethods.thaw;
    const mapThaw = compilation.__hardSourceMethods.mapThaw;

    // Original file source or output from loaders.
    this._source = thaw('source', null, this.cacheItem._source, {
      compilation,
    });

    // Rendered source used in built output.
    this._cachedSource = {
      source: thaw('source', null, this.cacheItem._cachedSource.source, {
        compilation,
        source: this._source,
      }),
      hash: this.cacheItem._cachedSource.hash,
    };

    const extra = {
      state: {imports: {}},
      module: this,
      parent: this,
      compilation,
    };
    this.assets = thaw('module-assets', null, this.cacheItem.assets, extra);
    thaw('dependency-block', this, this.cacheItem.dependencyBlock, extra);
    this.errors = mapThaw('module-error', null, this.cacheItem.errors, extra);
    this.warnings = mapThaw('module-warning', null, this.cacheItem.warnings, extra);

    this.error = this.errors[0] || null;

    callback();
  }
}

function needRebuild(cacheItem, fileDependencies, contextDependencies, fileTimestamps, contextTimestamps, fileMd5s, cachedMd5s) {
  let timestamp = 0;
  const buildTimestamp = cacheItem.buildTimestamp;
  let needsMd5Rebuild = !(fileMd5s && cachedMd5s);

  if (fileDependencies) {
    fileDependencies.forEach(file => {
      if (!needsMd5Rebuild) {
        needsMd5Rebuild = cachedMd5s[file] !== fileMd5s[file] || !cachedMd5s[file];
      }
      const ts = fileTimestamps[file];
      if(!ts) timestamp = Infinity;
      if(ts > timestamp) timestamp = ts;
    });
  }
  if (contextDependencies) {
    contextDependencies.forEach(context => {
      if (!needsMd5Rebuild) {
        needsMd5Rebuild = cachedMd5s[context] !== fileMd5s[context] || !cachedMd5s[context];
      }
      const ts = contextTimestamps[context];
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

HardModule.prototype.sourceDependency = NormalModule.prototype.sourceDependency;

HardModule.prototype.sourceVariables = NormalModule.prototype.sourceVariables;
HardModule.prototype.splitVariablesInUniqueNamedChunks = NormalModule.prototype.splitVariablesInUniqueNamedChunks;
HardModule.prototype.variableInjectionFunctionWrapperStartCode = NormalModule.prototype.variableInjectionFunctionWrapperStartCode;
HardModule.prototype.variableInjectionFunctionWrapperEndCode = NormalModule.prototype.variableInjectionFunctionWrapperEndCode;
HardModule.prototype.contextArgument = NormalModule.prototype.contextArgument;

HardModule.prototype.sourceBlock = NormalModule.prototype.sourceBlock;

HardModule.prototype.getHashDigest = NormalModule.prototype.getHashDigest;

HardModule.prototype.size = NormalModule.prototype.size;

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
  return request.split("!").map(r => {
    let rp = path.relative(options.context, r);
    if(path.sep === "\\")
      rp = rp.replace(/\\/g, "/");
    if(rp.indexOf("../") !== 0)
      rp = "./" + rp;
    return rp;
  }).join("!");
}

module.exports = HardModule;
