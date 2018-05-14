var fs = require('fs');

var cachePrefix = require('./util').cachePrefix;
var pluginCompat = require('./util/plugin-compat');
var relateContext = require('./util/relate-context');

var NS;

NS = fs.realpathSync(__dirname);

class NormalModuleFactoryPlugin {
  apply(compiler) {
    var fetch;

    pluginCompat.tap(compiler, '_hardSourceMethods', 'HardSource - index', function(methods) {
      fetch = methods.fetch;
    });

    compiler.plugin('compilation', function(compilation, params) {
      // if (!active) {return;}

      // compilation.fileTimestamps = fileTimestamps;
      // compilation.contextTimestamps = contextTimestamps;

      // compilation.__hardSourceFileMd5s = fileMd5s;
      // compilation.__hardSourceCachedMd5s = cachedMd5s;

      // Webpack 2 can use different parsers based on config rule sets.
      params.normalModuleFactory.plugin('parser', function(parser, options) {
        // Store the options somewhere that can not conflict with another plugin
        // on the parser so we can look it up and store those options with a
        // cached module resolution.
        parser[NS + '/parser-options'] = options;
      });

      params.normalModuleFactory.plugin('resolver', function(fn) {
        return function(request, cb) {
          var identifierPrefix = cachePrefix(compilation);
          if (identifierPrefix === null) {return fn.call(null, request, cb);}

          var cacheId = JSON.stringify([identifierPrefix, request.context, request.request]);
          var absCacheId = JSON.stringify([identifierPrefix, request.context, relateContext.relateAbsoluteRequest(request.context, request.request)]);

          request.contextInfo.resolveOptions = request.resolveOptions;

          var next = function() {
            var originalRequest = request;
            return fn.call(null, request, function(err, request) {
              if (err) {
                return cb(err);
              }
              if (!request.source) {
                compilation.__hardSourceModuleResolveCacheChange.push(cacheId);
                compilation.__hardSourceModuleResolveCache[cacheId] = Object.assign({}, request, {
                  parser: null,
                  generator: null,
                  parserOptions: request.parser[NS + '/parser-options'],
                  type: request.settings && request.settings.type,
                  settings: request.settings,
                  dependencies: null,
                });
              }
              cb.apply(null, arguments);
            });
          };

          var fromCache = function() {
            var result = Object.assign({}, compilation.__hardSourceModuleResolveCache[cacheId] || compilation.__hardSourceModuleResolveCache[absCacheId]);
            result.dependencies = request.dependencies;

            if (!result.parser || !result.parser.parse) {
              result.parser = result.settings ?
                params.normalModuleFactory.getParser(result.type, result.settings.parser) :
                params.normalModuleFactory.getParser(result.parserOptions);
            }
            if (!result.generator && params.normalModuleFactory.getGenerator) {
              result.generator = params.normalModuleFactory.getGenerator(result.type, result.settings.generator);
            }

            result.loaders = result.loaders.map(function(loader) {
              if (typeof loader === 'object' && loader.ident) {
                var ruleSet = params.normalModuleFactory.ruleSet;
                return {
                  loader: loader.loader,
                  ident: loader.ident,
                  options: ruleSet.references[loader.ident],
                };
              }
              return loader;
            });
            return cb(null, result);
          };

          if (
            compilation.__hardSourceModuleResolveCache[cacheId] &&
            !compilation.__hardSourceModuleResolveCache[cacheId].invalid ||
            compilation.__hardSourceModuleResolveCache[absCacheId] &&
            !compilation.__hardSourceModuleResolveCache[absCacheId].invalid
          ) {
            return fromCache();
          }

          next();
        };
      });

      pluginCompat.tap(params.normalModuleFactory, 'createModule', 'HardSourceWebpackPlugin', result => {
        if (
          compilation.cache &&
          compilation.cache['m' + result.request] &&
          compilation.cache['m' + result.request].cacheItem &&
          !compilation.cache['m' + result.request].cacheItem.invalid
        ) {
          return compilation.cache['m' + result.request];
        }

        var identifierPrefix = cachePrefix(compilation);
        if (identifierPrefix === null) {
          return;
        }

        var identifier = identifierPrefix + result.request;

        var module = fetch('Module', identifier, {
          compilation: compilation,
          normalModuleFactory: params.normalModuleFactory,
          contextModuleFactory: params.contextModuleFactory,
        });

        if (module) {
          return module;
        }
      });
    });
  }
}

module.exports = NormalModuleFactoryPlugin;
