var DependenciesBlockVariable = require('webpack/lib/DependenciesBlockVariable');
var RawModule = require('webpack/lib/RawModule');
var ContextModule = require('webpack/lib/ContextModule');

var OldHardContextModule = require('./hard-context-module');
var relateContext = require('./util/relate-context');

module.exports = HardContextModule;

function HardContextModule(cacheItem, compilation) {
  var compiler = compilation.compiler;
  var options = Object.assign({}, cacheItem.options, {
    regExp: cacheItem.options.regExp ?
      new RegExp(cacheItem.options.regExp) :
      cacheItem.options.regExp,
    include: cacheItem.options.include ?
      new RegExp(cacheItem.options.include) :
      cacheItem.options.include,
    exclude: cacheItem.options.exclude ?
      new RegExp(cacheItem.options.exclude) :
      cacheItem.options.exclude,
    resource: relateContext.contextNormalPath(compiler, cacheItem.options.resource),
    request: relateContext.contextNormalRequest(compiler, cacheItem.options.request),
    addon: relateContext.contextNormalRequest(compiler, cacheItem.options.addon),
  });

  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new ContextModule(null, options),
      HardContextModule.prototype
    )
  );
  this.cacheItem = cacheItem;
  this.options = options;
  this.context = relateContext.contextNormalPath(compiler, cacheItem.context);
  this.buildMeta = cacheItem.buildMeta;
  this.buildInfo = Object.assign({}, cacheItem.buildInfo, {
    contextDependencies: relateContext.contextNormalPathSet(compiler, cacheItem.buildInfo.contextDependencies),
  });
  this.built = false;
}

Object.setPrototypeOf(HardContextModule.prototype, OldHardContextModule.prototype);
Object.setPrototypeOf(HardContextModule, OldHardContextModule);

HardContextModule.prototype.isHard = function() {return true;};

Object.defineProperty(HardContextModule.prototype, 'contextDependencies', {
  get: function() {
    return this.buildInfo.contextDependencies;
  },
  set: function(value) {
    this.buildInfo.contextDependencies = value;
  },
});

HardContextModule.prototype.build = function(options, compilation, resolver, fs, callback) {
  this.builtTime = this.cacheItem.builtTime;
  var cacheItem = this.cacheItem;

  var thaw = compilation.__hardSourceMethods.thaw;

  var extra = {
    state: {imports: {}},
    module: this,
    parent: this,
  };
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
