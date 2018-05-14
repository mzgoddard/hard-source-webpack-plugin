const cachePrefix = require('./util').cachePrefix;
const HardContextModule = require('./hard-context-module');
const relateContext = require('./util/relate-context');

module.exports = HardContextModuleFactory;

class HardContextModuleFactory {
  constructor(options) {
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

  _create(context, dependency, callback) {
    const compilation = this.compilation;
    const factory = this.factory;
    const resolveCache = this.resolveCache;
    const resolveCacheChange = this.resolveCacheChange;
    const moduleCache = this.moduleCache;
    const fileTimestamps = this.fileTimestamps;
    const contextTimestamps = this.fileTimestamps;
    const fileMd5s = this.fileMd5s;
    const cachedMd5s = this.cachedMd5s;

    // Webpack 2 Factory API
    let data;
    if (!callback) {
      data = context;
      callback = dependency;
      dependency = context.dependencies[0];
      context = context.context;
    }

    let resolveIdentifier;
    let absResolveIdentifier;
    if (dependency.options) {
      resolveIdentifier = JSON.stringify({
        context,
        userRequest: dependency.userRequest,
        options: Object.assign({}, dependency.options, {
          regExp: dependency.options.regExp ? dependency.options.regExp.source : null,
        }),
      });
      absResolveIdentifier = JSON.stringify({
        context,
        userRequest: relateContext.relateAbsoluteRequest(context, dependency.userRequest),
        options: Object.assign({}, dependency.options, {
          request: relateContext.relateAbsoluteRequest(context, dependency.options.request),
          regExp: dependency.options.regExp ? dependency.options.regExp.source : null,
        }),
      });
    }
    else {
      resolveIdentifier = JSON.stringify({
        context,
        request: dependency.request,
        recursive: dependency.recursive,
        regExp: dependency.regExp ? dependency.regExp.source : null,
        async: dependency.async,
      });
      absResolveIdentifier = JSON.stringify({
        context,
        request: relateContext.relateAbsoluteRequest(context, dependency.request),
        recursive: dependency.recursive,
        regExp: dependency.regExp ? dependency.regExp.source : null,
        async: dependency.async,
      });
    }

    const resolved = resolveCache[resolveIdentifier] || resolveCache[absResolveIdentifier];
    if (resolved && !resolved.invalid) {
      // console.log('maybe use', resolved.identifier);
      const cacheItem = moduleCache[resolved.identifier];
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
          const fetch = this.compilation.__hardSourceMethods.fetch;
          return callback(null, fetch('Module', resolved.identifier, {
            compilation,
            contextModuleFactory: factory,
          }));
        }
      }
    }

    const next = fn => {
      if (data) {
        factory.create(data, fn);
      }
      else {
        factory.create(context, dependency, fn);
      }
    };

    next((error, module) => {
      if (error) {
        return callback(error);
      }
      // IgnorePlugin and other plugins can call this callback without an error or
      // module.
      if (!module) {
        return callback();
      }

      const identifierPrefix = cachePrefix(compilation);
      if (identifierPrefix === null) {
        return callback(error, module);
      }
      const identifier = identifierPrefix + module.identifier();
      // console.log('cache resolved', identifier);
      resolveCache[resolveIdentifier] = {
        type: 'context',
        identifier,
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
  }
}
