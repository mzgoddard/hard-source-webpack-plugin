const fs = require('graceful-fs');
const path = require('path');

const cachePrefix = require('./util').cachePrefix;
const pluginCompat = require('./util/plugin-compat');
const relateContext = require('./util/relate-context');

let NS;

NS = path.dirname(fs.realpathSync(__dirname));

class NormalModuleFactoryPlugin {
  apply(compiler) {
    const compilerHooks = pluginCompat.hooks(compiler);

    let fetch;

    compilerHooks._hardSourceMethods.tap(
      'HardSource - TransformNormalModuleFactoryPlugin',
      methods => {
        fetch = methods.fetch;
      },
    );

    compilerHooks.compilation.tap(
      'HardSource - TransformNormalModuleFactoryPlugin',
      (compilation, { normalModuleFactory, contextModuleFactory }) => {
        // if (!active) {return;}

        // compilation.fileTimestamps = fileTimestamps;
        // compilation.contextTimestamps = contextTimestamps;

        // compilation.__hardSourceFileMd5s = fileMd5s;
        // compilation.__hardSourceCachedMd5s = cachedMd5s;

        const compilationHooks = pluginCompat.hooks(compilation);
        compilationHooks.buildModule.tap(
          'HardSource - TransformNormalModuleFactoryPlugin',
          module => {
            if (module.constructor.name === 'NormalModule') {
              module.__originalCreateLoaderContext =
                module.__originalCreateLoaderContext ||
                module.createLoaderContext;
              module.__hardSource_resolved = {};
              module.createLoaderContext = (...args) => {
                const loaderContext = module.__originalCreateLoaderContext(
                  ...args,
                );
                const _resolve = loaderContext.resolve;
                loaderContext.resolve = (context, request, callback) => {
                  _resolve.call(
                    loaderContext,
                    context,
                    request,
                    (err, result) => {
                      if (err) {
                        callback(err, result);
                      } else {
                        module.__hardSource_resolved[
                          JSON.stringify({ context, request })
                        ] = {
                          resource: result,
                          resolveOptions: module.resolveOptions,
                        };
                        callback(err, result);
                      }
                    },
                  );
                };
                return loaderContext;
              };
            }
          },
        );

        const normalModuleFactoryHooks = pluginCompat.hooks(
          normalModuleFactory,
        );

        // Webpack 2 can use different parsers based on config rule sets.
        normalModuleFactoryHooks.parser
          .for('javascript/auto')
          .tap(
            'HardSource - TransformNormalModuleFactoryPlugin',
            (parser, options) => {
              // Store the options somewhere that can not conflict with another plugin
              // on the parser so we can look it up and store those options with a
              // cached module resolution.
              parser[`${NS}/parser-options`] = options;
            },
          );

        normalModuleFactoryHooks.resolver.tap(
          'HardSource - TransformNormalModuleFactoryPlugin',
          fn => (request, cb) => {
            const identifierPrefix = cachePrefix(compilation);
            if (identifierPrefix === null) {
              return fn.call(null, request, cb);
            }

            const cacheId = JSON.stringify([
              identifierPrefix,
              request.context,
              request.request,
            ]);
            const absCacheId = JSON.stringify([
              identifierPrefix,
              request.context,
              relateContext.relateAbsoluteRequest(
                request.context,
                request.request,
              ),
            ]);

            request.contextInfo.resolveOptions = request.resolveOptions;

            const next = () => {
              const originalRequest = request;
              return fn.call(null, request, function(err, request) {
                if (err) {
                  return cb(err);
                }
                if (!request.source) {
                  compilation.__hardSourceModuleResolveCacheChange.push(
                    cacheId,
                  );
                  compilation.__hardSourceModuleResolveCache[
                    cacheId
                  ] = Object.assign({}, request, {
                    parser: null,
                    generator: null,
                    parserOptions: request.parser[`${NS}/parser-options`],
                    type: request.settings && request.settings.type,
                    settings: request.settings,
                    resourceResolveData: request.resourceResolveData,
                    dependencies: null,
                  });
                }
                cb(...arguments);
              });
            };

            const fromCache = () => {
              const result = Object.assign(
                {},
                compilation.__hardSourceModuleResolveCache[cacheId] ||
                  compilation.__hardSourceModuleResolveCache[absCacheId],
              );
              result.dependencies = request.dependencies;

              if (!result.parser || !result.parser.parse) {
                result.parser = result.settings
                  ? normalModuleFactory.getParser(
                      result.type,
                      result.settings.parser,
                    )
                  : normalModuleFactory.getParser(result.parserOptions);
              }
              if (!result.generator && normalModuleFactory.getGenerator) {
                result.generator = normalModuleFactory.getGenerator(
                  result.type,
                  result.settings.generator,
                );
              }

              result.loaders = result.loaders.map(loader => {
                if (typeof loader === 'object' && loader.ident) {
                  const ruleSet = normalModuleFactory.ruleSet;
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
              (compilation.__hardSourceModuleResolveCache[cacheId] &&
                !compilation.__hardSourceModuleResolveCache[cacheId].invalid) ||
              (compilation.__hardSourceModuleResolveCache[absCacheId] &&
                !compilation.__hardSourceModuleResolveCache[absCacheId].invalid)
            ) {
              return fromCache();
            }

            next();
          },
        );

        normalModuleFactoryHooks.createModule.tap(
          'HardSourceWebpackPlugin',
          ({ request }) => {
            if (
              compilation.cache &&
              compilation.cache[`m${request}`] &&
              compilation.cache[`m${request}`].cacheItem &&
              !compilation.cache[`m${request}`].cacheItem.invalid
            ) {
              return compilation.cache[`m${request}`];
            }

            const identifierPrefix = cachePrefix(compilation);
            if (identifierPrefix === null) {
              return;
            }

            const identifier = identifierPrefix + request;

            const module = fetch('Module', identifier, {
              compilation,
              normalModuleFactory: normalModuleFactory,
              contextModuleFactory: contextModuleFactory,
            });

            if (module) {
              return module;
            }
          },
        );
      },
    );
  }
}

module.exports = NormalModuleFactoryPlugin;
