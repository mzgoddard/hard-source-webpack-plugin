var DependenciesBlockVariable = require('webpack/lib/DependenciesBlockVariable');
var RawModule = require('webpack/lib/RawModule');
var ContextModule = require('webpack/lib/ContextModule');

var relateContext = require('./util/relate-context');

module.exports = HardContextModule;

function HardContextModule(cacheItem, compilation) {
  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new ContextModule(),
      HardContextModule.prototype
    )
  );
  this.cacheItem = cacheItem;

  var context = relateContext.contextNormalPath(compilation.compiler, cacheItem.context);
  this.context = context;
  this.recursive = cacheItem.recursive;
  this.regExp = cacheItem.regExp ? new RegExp(cacheItem.regExp) : cacheItem.regExp;
  this.addon = relateContext.contextNormalRequest(compilation.compiler, cacheItem.addon);
  this.async = cacheItem.async;
  this.cacheable = true;
  this.contextDependencies = [context];
  this.built = false;
  this.chunkName = cacheItem.chunkName;
  this.useSourceMap = cacheItem.useSourceMap;

  this._identifier = relateContext.contextNormalRequest(compilation.compiler, cacheItem.identifier);
}

Object.setPrototypeOf(HardContextModule.prototype, ContextModule.prototype);
Object.setPrototypeOf(HardContextModule, ContextModule);

HardContextModule.prototype.isHard = function() {return true;};

HardContextModule.needRebuild = function(cacheItem, context, fileTimestamps, contextTimestamps, fileMd5s, cachedMd5s) {
  var needMd5Rebuild = !(fileMd5s && cachedMd5s);
  if (!needMd5Rebuild) {
    needMd5Rebuild = cachedMd5s[context] !== fileMd5s[context] || !cachedMd5s[context];
  }
  // var ts = contextTimestamps[context];
  // if(!ts) ts = Infinity;
  if (needMd5Rebuild && fileMd5s && cachedMd5s) {
    cacheItem.invalid = true;
    cacheItem.invalidReason = 'md5 mismatch';
  }
  // try {
  //   throw new Error
  // } catch (e) {console.error(e.stack)}
  // console.log('needMd5Rebuild', context, cacheItem.invalid, ts >= cacheItem.builtTime && needMd5Rebuild, needMd5Rebuild && fileMd5s && cachedMd5s);
  return cacheItem.invalid ||
    // ts >= cacheItem.builtTime && needMd5Rebuild ||
    needMd5Rebuild && fileMd5s && cachedMd5s;
};

HardContextModule.prototype.needRebuild = function(fileTimestamps, contextTimestamps) {
  return this.cacheItem.invalid || HardContextModule.needRebuild(this.cacheItem, this.context, fileTimestamps, contextTimestamps);
};

HardContextModule.prototype.build = function(options, compilation, resolver, fs, callback) {
  this.builtTime = this.cacheItem.builtTime;
  var cacheItem = this.cacheItem;

  var thaw = compilation.__hardSourceMethods.thaw;

  var extra = {
    state: {imports: {}},
    module: this,
    parent: this,
    compilation: compilation,
  };
  this.assets = thaw('ModuleAssets', null, cacheItem.assets, extra);
  thaw('DependencyBlock', this, cacheItem.dependencyBlock, extra);

  callback();
};

HardContextModule.prototype.getUserRequestMap = ContextModule.prototype.getUserRequestMap;
HardContextModule.prototype.getSyncSource = ContextModule.prototype.getSyncSource;
HardContextModule.prototype.getWeakSyncSource = ContextModule.prototype.getWeakSyncSource;
HardContextModule.prototype.getAsyncWeakSource = ContextModule.prototype.getAsyncWeakSource;
HardContextModule.prototype.getEagerSource = ContextModule.prototype.getEagerSource;
HardContextModule.prototype.getLazyOnceSource = ContextModule.prototype.getLazyOnceSource;
HardContextModule.prototype.getLazySource = ContextModule.prototype.getLazySource;
HardContextModule.prototype.getSourceForEmptyContext = ContextModule.prototype.getSourceForEmptyContext;
HardContextModule.prototype.getSourceForEmptyAsyncContext = ContextModule.prototype.getSourceForEmptyAsyncContext;
HardContextModule.prototype.getSourceString = ContextModule.prototype.getSourceString;
HardContextModule.prototype.getSource = ContextModule.prototype.getSource;
HardContextModule.prototype.source = ContextModule.prototype.source;
HardContextModule.prototype.size = ContextModule.prototype.size;

// HardContextModule.prototype.source = function() {
//   return this._renderedSource;
// };

// HardContextModule.prototype.updateHash = function(hash) {
//   hash.update(this.cacheItem.hashContent);
// };
