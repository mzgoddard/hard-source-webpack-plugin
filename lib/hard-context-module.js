var DependenciesBlockVariable = require('webpack/lib/DependenciesBlockVariable');
var RawModule = require('webpack/lib/RawModule');
var ContextModule = require('webpack/lib/ContextModule');

var HardSource = require('./hard-source');

module.exports = HardContextModule;

function HardContextModule(cacheItem) {
  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new ContextModule(),
      HardContextModule.prototype
    )
  );
  this.cacheItem = cacheItem;
  this.context = cacheItem.context;
  this.recursive = cacheItem.recursive;
  this.regExp = cacheItem.regExp ? new RegExp(cacheItem.regExp) : cacheItem.regExp;
  this.addon = cacheItem.addon;
  this.async = cacheItem.async;
  this.cacheable = true;
  this.contextDependencies = [cacheItem.context];
  this.built = false;
}

Object.setPrototypeOf(HardContextModule.prototype, ContextModule.prototype);
Object.setPrototypeOf(HardContextModule, ContextModule);

HardContextModule.prototype.isHard = function() {return true;};

HardContextModule.needRebuild = function(cacheItem, fileTimestamps, contextTimestamps, fileMd5s, cachedMd5s) {
  var needMd5Rebuild = !(fileMd5s && cachedMd5s);
  if (!needMd5Rebuild) {
    needMd5Rebuild = cachedMd5s[cacheItem.context] !== fileMd5s[cacheItem.context] || !cachedMd5s[cacheItem.context];
  }
  var ts = contextTimestamps[cacheItem.context];
  if(!ts) ts = Infinity;
  if (needMd5Rebuild && fileMd5s && cachedMd5s) {
    cacheItem.invalid = true;
  }
  return cacheItem.invalid || ts >= cacheItem.builtTime && needMd5Rebuild || needMd5Rebuild && fileMd5s && cachedMd5s;
};

HardContextModule.prototype.needRebuild = function(fileTimestamps, contextTimestamps) {
  return this.cacheItem.invalid || HardContextModule.needRebuild(this.cacheItem, fileTimestamps, contextTimestamps);
};

function prettyRegExp(str) {
  return str.substring(1, str.length - 1);
}

HardContextModule.prototype.identifier = function() {
  return this.cacheItem.identifier;
};

HardContextModule.prototype.readableIdentifier = function(requestShortener) {
  var identifier = "";
  identifier += requestShortener.shorten(this.context) + " ";
  if(this.async)
    identifier += "async ";
  if(!this.recursive)
    identifier += "nonrecursive ";
  if(this.addon)
    identifier += requestShortener.shorten(this.addon);
  if(this.regExp)
    identifier += prettyRegExp(this.regExp + "");
  return identifier.replace(/ $/, "");
};

HardContextModule.prototype.build = function(options, compilation, resolver, fs, callback) {
  this.builtTime = this.cacheItem.builtTime;
  var cacheItem = this.cacheItem;

  var thaw = compilation.__hardSourceMethods.thaw;

  var extra = {
    state: {imports: {}},
    module: this,
    parent: this,
  };
  this.assets = thaw('module-assets', null, cacheItem.assets, extra);
  thaw('dependency-block', this, cacheItem.dependencyBlock, extra);

  this._renderedSource = new HardSource(cacheItem);

  callback();
};

HardContextModule.prototype.source = function() {
  return this._renderedSource;
};

HardContextModule.prototype.updateHash = function(hash) {
  hash.update(this.cacheItem.hashContent);
};
