const path = require('path');

const RawModule = require('webpack/lib/RawModule');
const NormalModule = require('webpack/lib/NormalModule');

const {
  contextNormalPath,
  contextNormalPathArray,
  contextNormalRequest,
  contextNormalLoaders,
} = require('./util/relate-context');

class HardModule extends RawModule {
  constructor(cacheItem, compilation, fileMd5s, cachedMd5s) {
    const compiler = compilation.compiler;
    const identifier = contextNormalRequest(compiler, cacheItem.identifier);
    const userRequest = contextNormalRequest(compiler, cacheItem.userRequest);

    super(cacheItem.source, identifier, userRequest);

    this.cacheItem = cacheItem;

    this.cacheable = true;
    this.request = contextNormalRequest(compiler, cacheItem.request);
    this.userRequest = contextNormalRequest(compiler, cacheItem.userRequest);
    this.rawRequest = contextNormalRequest(compiler, cacheItem.rawRequest);
    this.resource = contextNormalPath(compiler, cacheItem.resource);
    this.context = contextNormalPath(compiler, cacheItem.context);
    this.loaders = contextNormalLoaders(compiler, cacheItem.loaders);

    this.strict = cacheItem.strict;
    this.buildTimestamp = cacheItem.buildTimestamp;

    if (!this.factoryMeta) {
      this.meta = cacheItem.meta;
      this.fileDependencies = contextNormalPathArray(compiler, cacheItem.fileDependencies);
      this.contextDependencies = contextNormalPathArray(compiler, cacheItem.contextDependencies);
      this.exportsArgument = cacheItem.exportsArgument;
    }
    
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
    this._source = thaw('Source', null, this.cacheItem._source, {
      compilation,
    });

    // Rendered source used in built output.
    if (this.buildInfo) {
      this._cachedSource = thaw('Source', null, this.cacheItem._cachedSource, {
        module: this,
        source: this._source,
        compilation,
      });
      this._cachedSourceHash = this.cacheItem._cachedSourceHash;
    }
    else {
      this._cachedSource = {
        source: thaw('Source', null, this.cacheItem._cachedSource.source, {
          source: this._source,
          compilation,
        }),
        hash: this.cacheItem._cachedSource.hash,
      };
    }

    const extra = {
      state: {imports: {}},
      module: this,
      parent: this,
      compilation,
    };
    if (this.cacheItem.buildInfo) {
      this.buildInfo.assets = thaw('ModuleAssets', null, this.cacheItem.buildInfo.assets, extra);
    }
    else {
      this.assets = thaw('ModuleAssets', null, this.cacheItem.assets, extra);
    }
    thaw('DependencyBlock', this, this.cacheItem.dependencyBlock, extra);
    this.errors = mapThaw('ModuleError', null, this.cacheItem.errors, extra);
    this.warnings = mapThaw('ModuleWarning', null, this.cacheItem.warnings, extra);

    this.error = this.errors[0] || null;

    callback();
  }
}

function needRebuild(cacheItem, fileDependencies, contextDependencies, fileTimestamps, contextTimestamps, fileMd5s, cachedMd5s) {
  let timestamp = 0;
  const buildTimestamp = cacheItem.buildTimestamp;
  let needsMd5Rebuild = !(fileMd5s && cachedMd5s);

  if (fileDependencies) {
    Array.from(fileDependencies).forEach(file => {
      if (!needsMd5Rebuild) {
        // console.log(!cachedMd5s[file], cachedMd5s[file] !== fileMd5s[file]);
        needsMd5Rebuild = !cachedMd5s[file] || cachedMd5s[file] !== fileMd5s[file];
      }
      // const ts = fileTimestamps[file];
      // if(!ts) timestamp = Infinity;
      // if(ts > timestamp) timestamp = ts;
    });
  }
  if (contextDependencies) {
    Array.from(contextDependencies).forEach(context => {
      if (!needsMd5Rebuild) {
        // console.log(!cachedMd5s[context], cachedMd5s[context] !== fileMd5s[context]);
        needsMd5Rebuild = !cachedMd5s[context] || cachedMd5s[context] !== fileMd5s[context];
      }
      // const ts = contextTimestamps[context];
      // if(!ts) timestamp = Infinity;
      // if(ts > timestamp) timestamp = ts;
    });
  }
  if (needsMd5Rebuild && fileMd5s && cachedMd5s) {
    cacheItem.invalid = true;
    cacheItem.invalidReason = 'md5 mismatch';
  }
  return (
    cacheItem.errors && cacheItem.errors.length > 0 ||
    cacheItem.invalid ||
    // timestamp >= buildTimestamp && needsMd5Rebuild ||
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
