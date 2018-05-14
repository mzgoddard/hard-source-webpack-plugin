const DependenciesBlockVariable = require('webpack/lib/DependenciesBlockVariable');
const RawModule = require('webpack/lib/RawModule');
const ContextModule = require('webpack/lib/ContextModule');

const relateContext = require('./util/relate-context');

module.exports = HardContextModule;

class HardContextModule {
  constructor(cacheItem, {compiler}) {
    Object.setPrototypeOf(this,
      Object.setPrototypeOf(
        new ContextModule(),
        HardContextModule.prototype
      )
    );
    this.cacheItem = cacheItem;

    const context = relateContext.contextNormalPath(compiler, cacheItem.context);
    this.context = context;
    this.recursive = cacheItem.recursive;
    this.regExp = cacheItem.regExp ? new RegExp(cacheItem.regExp) : cacheItem.regExp;
    this.addon = relateContext.contextNormalRequest(compiler, cacheItem.addon);
    this.async = cacheItem.async;
    this.cacheable = true;
    this.contextDependencies = [context];
    this.built = false;
    this.chunkName = cacheItem.chunkName;
    this.useSourceMap = cacheItem.useSourceMap;

    this._identifier = relateContext.contextNormalRequest(compiler, cacheItem.identifier);
  }

  isHard() {
    return true;
  }

  needRebuild(fileTimestamps, contextTimestamps) {
    return this.cacheItem.invalid || HardContextModule.needRebuild(this.cacheItem, this.context, fileTimestamps, contextTimestamps);
  }

  build(options, compilation, resolver, fs, callback) {
    this.builtTime = this.cacheItem.builtTime;
    const cacheItem = this.cacheItem;

    const thaw = compilation.__hardSourceMethods.thaw;

    const extra = {
      state: {imports: {}},
      module: this,
      parent: this,
      compilation,
    };
    this.assets = thaw('ModuleAssets', null, cacheItem.assets, extra);
    thaw('DependencyBlock', this, cacheItem.dependencyBlock, extra);

    callback();
  }
}

Object.setPrototypeOf(HardContextModule.prototype, ContextModule.prototype);
Object.setPrototypeOf(HardContextModule, ContextModule);

HardContextModule.needRebuild = (
  cacheItem,
  context,
  fileTimestamps,
  contextTimestamps,
  fileMd5s,
  cachedMd5s
) => {
  let needMd5Rebuild = !(fileMd5s && cachedMd5s);
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
