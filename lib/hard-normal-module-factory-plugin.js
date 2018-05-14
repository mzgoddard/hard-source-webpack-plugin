const fs = require('fs');
const path = require('path');

const cachePrefix = require('./util').cachePrefix;
const pluginCompat = require('./util/plugin-compat');
const relateContext = require('./util/relate-context');
const bulkFsTask = require('./util/bulk-fs-task');

let NS;

NS = path.dirname(fs.realpathSync(__dirname));

class NormalModuleFactoryPlugin {
  apply(compiler) {
    const compilerHooks = pluginCompat.hooks(compiler);

    let fetch;

    compilerHooks._hardSourceMethods.tap(
      'HardSource - HardNormalModuleFactoryPlugin',
      methods => {
        fetch = methods.fetch;
      },
    );

    compilerHooks.compilation.tap(
      'HardSource - HardNormalModuleFactoryPlugin',
      (compilation, { normalModuleFactory, contextModuleFactory }) => {
        // if (!active) {return;}

        // compilation.fileTimestamps = fileTimestamps;
        // compilation.contextTimestamps = contextTimestamps;

        // compilation.__hardSourceFileMd5s = fileMd5s;
        // compilation.__hardSourceCachedMd5s = cachedMd5s;

        const normalModuleFactoryHooks = pluginCompat.hooks(
          normalModuleFactory,
        );

        // Webpack 2 can use different parsers based on config rule sets.
        normalModuleFactoryHooks.parser
          .for('javascript/auto')
          .tap(
            'HardSource - HardNormalModuleFactoryPlugin',
            (parser, options) => {
              // Store the options somewhere that can not conflict with another plugin
              // on the parser so we can look it up and store those options with a
              // cached module resolution.
              parser[`${NS}/parser-options`] = options;
            },
          );

        normalModuleFactoryHooks.resolver.tap(
          'HardSource - HardNormalModuleFactoryPlugin',
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

              // Fetch a copy of the module, do md5's on its dependencies.
              const module = normalModuleFactoryHooks.createModule.call(result);
              if (module) {
                const buildInfo = module.buildInfo || module;
                compilation
                  .__hardSourceBuildHashes(
                    buildInfo.fileDependencies,
                    buildInfo.contextDependencies,
                  )
                  .then(() => {
                    cb(null, result);
                  });
              } else {
                return cb(null, result);
              }
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
