import {cachePrefix} from './util';
import HardContextModule from './hard-context-module';
export default HardContextModuleFactory;

class HardContextModuleFactory {
  constructor(options) {
    this.compilation = options.compilation;
    this.factory = options.factory;
    this.resolveCache = options.resolveCache;
    this.moduleCache = options.moduleCache;
    this.fileTimestamps = options.fileTimestamps;
    this.fileMd5s = options.fileMd5s;
    this.cachedMd5s = options.cachedMd5s;
  }

  create(context, dependency, callback) {
    var compilation = this.compilation;
    var factory = this.factory;
    var resolveCache = this.resolveCache;
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

    var resolveIdentifier = JSON.stringify({
      context: context,
      request: dependency.request,
      recursive: dependency.recursive,
      regExp: dependency.regExp ? dependency.regExp.source : null,
      async: dependency.async,
    });
    if (resolveCache[resolveIdentifier]) {
      var cacheItem = moduleCache[resolveCache[resolveIdentifier].identifier];
      if (cacheItem) {
        if (!HardContextModule.needRebuild(
          cacheItem,
          fileTimestamps,
          contextTimestamps,
          fileMd5s,
          cachedMd5s
        )) {
          return callback(null, new HardContextModule(cacheItem));
        }
      }
    }

    var next = fn => {
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
      var identifierPrefix = cachePrefix(compilation);
      if (identifierPrefix === null) {
        return callback(error, module);
      }
      var identifier = identifierPrefix + module.identifier();
      resolveCache[resolveIdentifier] = {
        identifier: identifier,
        resource: module.context,
      };

      module.needRebuild = function(fileTimestamps, contextTimestamps) {
        return HardContextModule.needRebuild({context: this.context, builtTime: this.builtTime}, fileTimestamps, contextTimestamps, fileMd5s, cachedMd5s);
      };

      callback(error, module);
    });
  }
}
