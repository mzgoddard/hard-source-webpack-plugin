var cachePrefix = require('./util').cachePrefix;
var HardContextModule = require('./hard-context-module');
var relateContext = require('./util/relate-context');

module.exports = HardContextModuleFactory;

function HardContextModuleFactory(options) {
  this.compilation = options.compilation;
  this.factory = options.factory;
  this.resolveCache = options.resolveCache;
  this.resolveCacheChange = options.resolveCacheChange;
  this.moduleCache = options.moduleCache;
  this.fileTimestamps = options.fileTimestamps;
  this.fileMd5s = options.fileMd5s;
  this.cachedMd5s = options.cachedMd5s;

  if (this.factory.create.length === 2) {
    this.create = function(data, cb) {
      return this._create(data, cb);
    };
  }
  else {
    this.create = function(context, dependency, cb) {
      return this._create(context, dependency, cb);
    };
  }
}

HardContextModuleFactory.prototype._create = function(context, dependency, callback) {
  var compilation = this.compilation;
  var factory = this.factory;
  var resolveCache = this.resolveCache;
  var resolveCacheChange = this.resolveCacheChange;
  var moduleCache = this.moduleCache;
  var fileTimestamps = this.fileTimestamps;
  var contextTimestamps = this.fileTimestamps;
  var fileMd5s = this.fileMd5s;
  var cachedMd5s = this.cachedMd5s;

  // Webpack 2 Factory API
  var data;
  if (!callback) {
    data = context;
    callback = dependency;
    dependency = context.dependencies[0];
    context = context.context;
  }

  var resolveIdentifier;
  var absResolveIdentifier;
  if (dependency.options) {
    resolveIdentifier = JSON.stringify({
      context: context,
      userRequest: dependency.userRequest,
      options: Object.assign({}, dependency.options, {
        regExp: dependency.options.regExp ? dependency.options.regExp.source : null,
      }),
    });
    absResolveIdentifier = JSON.stringify({
      context: context,
      userRequest: relateContext.relateAbsoluteRequest(context, dependency.userRequest),
      options: Object.assign({}, dependency.options, {
        request: relateContext.relateAbsoluteRequest(context, dependency.options.request),
        regExp: dependency.options.regExp ? dependency.options.regExp.source : null,
      }),
    });
  }
  else {
    resolveIdentifier = JSON.stringify({
      context: context,
      request: dependency.request,
      recursive: dependency.recursive,
      regExp: dependency.regExp ? dependency.regExp.source : null,
      async: dependency.async,
    });
    absResolveIdentifier = JSON.stringify({
      context: context,
      request: relateContext.relateAbsoluteRequest(context, dependency.request),
      recursive: dependency.recursive,
      regExp: dependency.regExp ? dependency.regExp.source : null,
      async: dependency.async,
    });
  }

  var resolved = resolveCache[resolveIdentifier] || resolveCache[absResolveIdentifier];
  if (resolved && !resolved.invalid) {
    // console.log('maybe use', resolved.identifier);
    var cacheItem = moduleCache[resolved.identifier];
    // console.log(!!cacheItem);
    if (cacheItem && !cacheItem.invalid) {
      // console.log(cacheItem);
      if (!HardContextModule.needRebuild(
        cacheItem,
        relateContext.contextNormalPath(compilation.compiler, cacheItem.context),
        fileTimestamps,
        contextTimestamps,
        fileMd5s,
        cachedMd5s
      )) {
        // console.log(true);
        var fetch = this.compilation.__hardSourceMethods.fetch;
        return callback(null, fetch('Module', resolved.identifier, {
          compilation: compilation,
          contextModuleFactory: factory,
        }));
      }
    }
  }

  var next = function(fn) {
    if (data) {
      factory.create(data, fn);
    }
    else {
      factory.create(context, dependency, fn);
    }
  };

  next(function(error, module) {
    if (error) {
      return callback(error);
    }
    // IgnorePlugin and other plugins can call this callback without an error or
    // module.
    if (!module) {
      return callback();
    }

    var identifierPrefix = cachePrefix(compilation);
    if (identifierPrefix === null) {
      return callback(error, module);
    }
    var identifier = identifierPrefix + module.identifier();
    // console.log('cache resolved', identifier);
    resolveCache[resolveIdentifier] = {
      type: 'context',
      identifier: identifier,
      resource: module.context,
    };
    resolveCacheChange.push(resolveIdentifier);

    module.needRebuild = function(fileTimestamps, contextTimestamps) {
      return HardContextModule.needRebuild({
        context: this.context,
        builtTime: this.builtTime
      }, this.context, fileTimestamps, contextTimestamps, fileMd5s, cachedMd5s);
    };

    callback(error, module);
  });
};
