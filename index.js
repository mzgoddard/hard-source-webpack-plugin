const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const lodash = require('lodash');
const _mkdirp = require('mkdirp');
const _rimraf = require('rimraf');
const nodeObjectHash = require('node-object-hash');

const envHash = require('./lib/env-hash');
const defaultConfigHash = require('./lib/default-config-hash');
const promisify = require('./lib/util/promisify');
const relateContext = require('./lib/util/relate-context');
const pluginCompat = require('./lib/util/plugin-compat');

const LoggerFactory = require('./lib/logger-factory');

const cachePrefix = require('./lib/util').cachePrefix;

const CacheSerializerFactory = require('./lib/cache-serializer-factory');
const HardSourceJsonSerializerPlugin = require('./lib/hard-source-json-serializer-plugin');
const HardSourceAppendSerializerPlugin = require('./lib/hard-source-append-serializer-plugin');
const HardSourceLevelDbSerializerPlugin = require('./lib/hard-source-leveldb-serializer-plugin');

const hardSourceVersion = require('./package.json').version;

function requestHash(request) {
  return crypto
    .createHash('sha1')
    .update(request)
    .digest()
    .hexSlice();
}

const mkdirp = promisify(_mkdirp, { context: _mkdirp });
mkdirp.sync = _mkdirp.sync.bind(_mkdirp);
const rimraf = promisify(_rimraf);
rimraf.sync = _rimraf.sync.bind(_rimraf);
const fsReadFile = promisify(fs.readFile, { context: fs });
const fsWriteFile = promisify(fs.writeFile, { context: fs });

const bulkFsTask = (array, each) =>
  new Promise((resolve, reject) => {
    let ops = 0;
    const out = [];
    array.forEach((item, i) => {
      out[i] = each(item, (back, callback) => {
        ops++;
        return (err, value) => {
          try {
            out[i] = back(err, value, out[i]);
          } catch (e) {
            return reject(e);
          }

          ops--;
          if (ops === 0) {
            resolve(out);
          }
        };
      });
    });
    if (ops === 0) {
      resolve(out);
    }
  });

const compilerContext = relateContext.compilerContext;
const relateNormalPath = relateContext.relateNormalPath;
const contextNormalPath = relateContext.contextNormalPath;
const contextNormalPathSet = relateContext.contextNormalPathSet;

function relateNormalRequest(compiler, key) {
  return key
    .split('!')
    .map(subkey => relateNormalPath(compiler, subkey))
    .join('!');
}

function relateNormalModuleId(compiler, id) {
  return id.substring(0, 24) + relateNormalRequest(compiler, id.substring(24));
}

function contextNormalRequest(compiler, key) {
  return key
    .split('!')
    .map(subkey => contextNormalPath(compiler, subkey))
    .join('!');
}

function contextNormalModuleId(compiler, id) {
  return id.substring(0, 24) + contextNormalRequest(compiler, id.substring(24));
}

function contextNormalLoaders(compiler, loaders) {
  return loaders.map(loader =>
    Object.assign({}, loader, {
      loader: contextNormalPath(compiler, loader.loader),
    }),
  );
}

function contextNormalPathArray(compiler, paths) {
  return paths.map(subpath => contextNormalPath(compiler, subpath));
}

class HardSourceWebpackPlugin {
  constructor(options) {
    this.options = options || {};
  }

  getPath(dirName, suffix) {
    const confighashIndex = dirName.search(/\[confighash\]/);
    if (confighashIndex !== -1) {
      dirName = dirName.replace(/\[confighash\]/, this.configHash);
    }
    let cachePath = path.resolve(
      process.cwd(),
      this.compilerOutputOptions.path,
      dirName,
    );
    if (suffix) {
      cachePath = path.join(cachePath, suffix);
    }
    return cachePath;
  }

  getCachePath(suffix) {
    return this.getPath(this.options.cacheDirectory, suffix);
  }

  apply(compiler) {
    const options = this.options;
    let active = true;

    const logger = new LoggerFactory(compiler).create();

    const loggerCore = logger.from('core');
    logger.lock();

    const compilerHooks = pluginCompat.hooks(compiler);

    if (!compiler.options.cache) {
      compiler.options.cache = true;
    }

    if (!options.cacheDirectory) {
      options.cacheDirectory = path.resolve(
        process.cwd(),
        compiler.options.context,
        'node_modules/.cache/hard-source/[confighash]',
      );
    }

    this.compilerOutputOptions = compiler.options.output;
    if (!options.configHash) {
      options.configHash = defaultConfigHash;
    }
    if (options.configHash) {
      if (typeof options.configHash === 'string') {
        this.configHash = options.configHash;
      } else if (typeof options.configHash === 'function') {
        this.configHash = options.configHash(compiler.options);
      }
    }
    const configHashInDirectory =
      options.cacheDirectory.search(/\[confighash\]/) !== -1;
    if (configHashInDirectory && !this.configHash) {
      loggerCore.error(
        {
          id: 'confighash-directory-no-confighash',
          cacheDirectory: options.cacheDirectory,
        },
        'HardSourceWebpackPlugin cannot use [confighash] in cacheDirectory ' +
          'without configHash option being set and returning a non-falsy value.',
      );
      active = false;

      function unlockLogger() {
        logger.unlock();
      }
      compilerHooks.watchRun.tap('HardSource - index', unlockLogger);
      compilerHooks.run.tap('HardSource - index', unlockLogger);
      return;
    }

    let environmentHasher = null;
    if (typeof options.environmentHash !== 'undefined') {
      if (options.environmentHash === false) {
        environmentHasher = () => Promise.resolve('');
      } else if (typeof options.environmentHash === 'string') {
        environmentHasher = () => Promise.resolve(options.environmentHash);
      } else if (typeof options.environmentHash === 'object') {
        environmentHasher = () => envHash(options.environmentHash);
      } else if (typeof options.environmentHash === 'function') {
        environmentHasher = () => Promise.resolve(options.environmentHash());
      }
    }
    if (!environmentHasher) {
      environmentHasher = envHash;
    }

    if (options.recordsInputPath || options.recordsPath) {
      if (compiler.options.recordsInputPath || compiler.options.recordsPath) {
        loggerCore.error(
          {
            id: 'records-input-path-set-in-root-config',
            webpackRecordsInputPath: compiler.options.recordsInputPath,
            webpackRecordsPath: compiler.options.recordsPath,
            hardSourceRecordsInputPath: options.recordsInputPath,
            hardSourceRecordsPath: options.recordsPath,
          },
          'recordsInputPath option to HardSourceWebpackPlugin is deprecated. ' +
            'You do not need to set it and recordsInputPath in webpack root ' +
            'configuration.',
        );
      } else {
        compiler.options.recordsInputPath = this.getPath(
          options.recordsInputPath || options.recordsPath,
        );
      }
    }
    if (options.recordsOutputPath || options.recordsPath) {
      if (compiler.options.recordsOutputPath || compiler.options.recordsPath) {
        loggerCore.error(
          {
            id: 'records-output-path-set-in-root-config',
            webpackRecordsOutputPath: compiler.options.recordsInputPath,
            webpackRecordsPath: compiler.options.recordsPath,
            hardSourceRecordsOutputPath: options.recordsOutputPath,
            hardSourceRecordsPath: options.recordsPath,
          },
          'recordsOutputPath option to HardSourceWebpackPlugin is deprecated. ' +
            'You do not need to set it and recordsOutputPath in webpack root ' +
            'configuration.',
        );
      } else {
        compiler.options.recordsOutputPath = this.getPath(
          options.recordsOutputPath || options.recordsPath,
        );
      }
    }

    const cacheDirPath = this.getCachePath();
    const cacheAssetDirPath = path.join(cacheDirPath, 'assets');
    const resolveCachePath = path.join(cacheDirPath, 'resolve.json');

    let currentStamp = '';

    const cacheSerializerFactory = new CacheSerializerFactory(compiler);
    let createSerializers = true;
    let cacheRead = false;

    const _this = this;

    pluginCompat.register(compiler, '_hardSourceCreateSerializer', 'sync', [
      'cacheSerializerFactory',
      'cacheDirPath',
    ]);
    pluginCompat.register(compiler, '_hardSourceResetCache', 'sync', []);
    pluginCompat.register(compiler, '_hardSourceReadCache', 'asyncParallel', [
      'relativeHelpers',
    ]);
    pluginCompat.register(
      compiler,
      '_hardSourceVerifyCache',
      'asyncParallel',
      [],
    );
    pluginCompat.register(compiler, '_hardSourceWriteCache', 'asyncParallel', [
      'compilation',
      'relativeHelpers',
    ]);

    function runReadOrReset(compiler) {
      logger.unlock();

      if (!active) {
        return Promise.resolve();
      }

      try {
        fs.statSync(cacheAssetDirPath);
      } catch (_) {
        mkdirp.sync(cacheAssetDirPath);
        if (configHashInDirectory) {
          loggerCore.warn(
            {
              id: 'new-config-hash',
              cacheDirPath,
            },
            `HardSourceWebpackPlugin is writing to a new confighash path for the first time: ${cacheDirPath}`,
          );
        }
        if (
          options.recordsPath ||
          options.recordsOutputPath ||
          options.recordsInputPath
        ) {
          loggerCore.warn(
            {
              id: 'deprecated-recordsPath',
              recordsPath: options.recordsPath,
              recordsOutputPath: options.recordsOutputPath,
              recordsInputPath: options.recordsInputPath,
            },
            [
              'The `recordsPath` option to HardSourceWebpackPlugin is deprecated',
              ' in 0.6 and will be removed in 0.7. 0.6 and later do not need ',
              'recordsPath. If you still need it outside HardSourceWebpackPlugin',
              ' you can set recordsPath on the root of your webpack ',
              'configuration.',
            ].join(''),
          );
        }
      }
      const start = Date.now();

      if (createSerializers) {
        createSerializers = false;
        try {
          compilerHooks._hardSourceCreateSerializer.call(
            cacheSerializerFactory,
            cacheDirPath,
          );
        } catch (err) {
          return Promise.reject(err);
        }
      }

      return Promise.all([
        fsReadFile(path.join(cacheDirPath, 'stamp'), 'utf8').catch(() => ''),

        environmentHasher(),

        fsReadFile(path.join(cacheDirPath, 'version'), 'utf8').catch(() => ''),
      ]).then(stamps => {
        const stamp = stamps[0];
        let hash = stamps[1];
        const versionStamp = stamps[2];

        if (!configHashInDirectory && options.configHash) {
          hash += `_${_this.configHash}`;
        }

        currentStamp = hash;
        if (!hash || hash !== stamp || hardSourceVersion !== versionStamp) {
          if (hash && stamp) {
            loggerCore.error(
              {
                id: 'environment-changed',
              },
              'Environment has changed (node_modules or configuration was ' +
                'updated).\nHardSourceWebpackPlugin will reset the cache and ' +
                'store a fresh one.',
            );
          } else if (versionStamp && hardSourceVersion !== versionStamp) {
            loggerCore.error(
              {
                id: 'hard-source-changed',
              },
              'Installed HardSource version does not match the saved ' +
                'cache.\nHardSourceWebpackPlugin will reset the cache and store ' +
                'a fresh one.',
            );
          }

          // Reset the cache, we can't use it do to an environment change.
          pluginCompat.call(compiler, '_hardSourceResetCache', []);

          return rimraf(cacheDirPath);
        }

        if (cacheRead) {
          return Promise.resolve();
        }
        cacheRead = true;

        function contextKeys(compiler, fn) {
          return source => {
            const dest = {};
            Object.keys(source).forEach(key => {
              dest[fn(compiler, key)] = source[key];
            });
            return dest;
          };
        }

        function contextValues(compiler, fn) {
          return source => {
            const dest = {};
            Object.keys(source).forEach(key => {
              dest[key] = fn(compiler, source[key]);
            });
            return dest;
          };
        }

        function copyWithDeser(dest, source) {
          Object.keys(source).forEach(key => {
            const item = source[key];
            dest[key] = typeof item === 'string' ? JSON.parse(item) : item;
          });
        }

        return Promise.all([
          compilerHooks._hardSourceReadCache.promise({
            contextKeys,
            contextValues,
            contextNormalPath,
            contextNormalRequest,
            contextNormalModuleId,
            copyWithDeser,
          }),
        ]).then(() => {
          // console.log('cache in', Date.now() - start);
        });
      });
    }

    function runVerify(_compiler) {
      if (!active) {
        return Promise.resolve();
      }

      const stats = {};
      return pluginCompat.promise(compiler, '_hardSourceVerifyCache', []);
    }

    compilerHooks.watchRun.tapPromise('HardSource - index', runReadOrReset);
    compilerHooks.run.tapPromise('HardSource - index', runReadOrReset);
    compilerHooks.watchRun.tapPromise('HardSource - index', runVerify);
    compilerHooks.run.tapPromise('HardSource - index', runVerify);

    const detectModule = path => {
      try {
        require(path);
        return true;
      } catch (_) {
        return false;
      }
    };

    const webpackFeatures = {
      concatenatedModule: detectModule(
        'webpack/lib/optimize/ConcatenatedModule',
      ),
      generator: detectModule('webpack/lib/JavascriptGenerator'),
    };

    let schemasVersion = 2;
    if (webpackFeatures.concatenatedModule) {
      schemasVersion = 3;
    }
    if (webpackFeatures.generator) {
      schemasVersion = 4;
    }

    const ArchetypeSystem = require('./lib/archetype-system');

    const AssetCache = require('./lib/asset-cache');
    const ModuleCache = require('./lib/module-cache');

    const EnhancedResolveCache = require('./lib/enhanced-resolve-cache');
    const Md5Cache = require('./lib/md5-cache');
    const ModuleResolverCache = require('./lib/module-resolver-cache');

    const HardCompilationPlugin = require('./lib/hard-compilation-plugin');
    const HardAssetPlugin = require('./lib/hard-asset-plugin');
    let HardConcatenationModulePlugin;
    if (webpackFeatures.concatenatedModule) {
      HardConcatenationModulePlugin = require('./lib/hard-concatenation-module-plugin');
    }
    // var HardContextModuleFactoryPlugin = require('./lib/hard-context-module-factory-plugin');
    // var HardContextModulePlugin = require('./lib/hard-context-module-plugin');
    const HardNormalModulePlugin = require('./lib/hard-normal-module-plugin');
    const HardNormalModuleFactoryPlugin = require('./lib/hard-normal-module-factory-plugin');
    const HardModuleAssetsPlugin = require('./lib/hard-module-assets-plugin');
    const HardModuleErrorsPlugin = require('./lib/hard-module-errors-plugin');
    const HardModuleExtractTextPlugin = require('./lib/hard-module-extract-text-plugin');
    let HardModuleMiniCssExtractPlugin;
    if (webpackFeatures.generator) {
      HardModuleMiniCssExtractPlugin = require('./lib/hard-module-mini-css-extract-plugin');
    }
    const HardDependencyBlockPlugin = require('./lib/hard-dependency-block-plugin');
    const HardBasicDependencyPlugin = require('./lib/hard-basic-dependency-plugin');
    let HardHarmonyDependencyPlugin;
    const HardSourceSourcePlugin = require('./lib/hard-source-source-plugin');
    const HardParserPlugin = require('./lib/hard-parser-plugin');
    let HardGeneratorPlugin;
    if (webpackFeatures.generator) {
      HardGeneratorPlugin = require('./lib/hard-generator-plugin');
    }

    new ArchetypeSystem().apply(compiler);

    new AssetCache().apply(compiler);
    new ModuleCache().apply(compiler);

    new EnhancedResolveCache().apply(compiler);
    new Md5Cache().apply(compiler);
    new ModuleResolverCache().apply(compiler);

    new HardCompilationPlugin().apply(compiler);

    new HardAssetPlugin().apply(compiler);

    // new HardContextModuleFactoryPlugin({
    //   caches(compilation) {
    //     return {
    //       cachedMd5s: compilation.__hardSourceCachedMd5s,
    //       fileMd5s: compilation.__hardSourceFileMd5s,
    //       fileTimestamps: compilation.__hardSourceFileTimestamps,
    //       moduleCache: compilation.__hardSourceModuleCache,
    //       moduleResolveCache: compilation.__hardSourceModuleResolveCache,
    //       moduleResolveCacheChange: compilation.__hardSourceModuleResolveCacheChange,
    //     };
    //   }
    // }).apply(compiler);
    // new HardContextModulePlugin({
    //   schema: schemasVersion,
    // }).apply(compiler);

    new HardNormalModulePlugin({
      schema: schemasVersion,
    }).apply(compiler);
    new HardNormalModuleFactoryPlugin().apply(compiler);

    if (HardConcatenationModulePlugin) {
      new HardConcatenationModulePlugin().apply(compiler);
    }

    new HardModuleAssetsPlugin().apply(compiler);
    new HardModuleErrorsPlugin().apply(compiler);
    new HardModuleExtractTextPlugin().apply(compiler);

    if (HardModuleMiniCssExtractPlugin) {
      new HardModuleMiniCssExtractPlugin().apply(compiler);
    }

    new HardDependencyBlockPlugin({
      schema: schemasVersion,
    }).apply(compiler);

    new HardBasicDependencyPlugin({
      schema: schemasVersion,
    }).apply(compiler);

    new HardSourceSourcePlugin({
      schema: schemasVersion,
    }).apply(compiler);

    new HardParserPlugin({
      schema: schemasVersion,
    }).apply(compiler);

    if (HardGeneratorPlugin) {
      new HardGeneratorPlugin({
        schema: schemasVersion,
      }).apply(compiler);
    }

    let freeze;

    compilerHooks._hardSourceMethods.tap('HardSource - index', methods => {
      freeze = methods.freeze;
    });

    compilerHooks.afterCompile.tapPromise('HardSource - index', compilation => {
      if (!active) {
        return Promise.resolve();
      }

      const startCacheTime = Date.now();

      const identifierPrefix = cachePrefix(compilation);
      if (identifierPrefix !== null) {
        freeze('Compilation', null, compilation, {
          compilation,
        });
      }

      return Promise.all([
        mkdirp(cacheDirPath).then(() =>
          Promise.all([
            fsWriteFile(path.join(cacheDirPath, 'stamp'), currentStamp, 'utf8'),
            fsWriteFile(
              path.join(cacheDirPath, 'version'),
              hardSourceVersion,
              'utf8',
            ),
          ]),
        ),
        pluginCompat.promise(compiler, '_hardSourceWriteCache', [
          compilation,
          {
            relateNormalPath,
            relateNormalRequest,
            relateNormalModuleId,
          },
        ]),
      ]).then(() => {
        // console.log('cache out', Date.now() - startCacheTime);
      });
    });
  }
}

module.exports = HardSourceWebpackPlugin;

HardSourceWebpackPlugin.HardSourceJsonSerializerPlugin = HardSourceJsonSerializerPlugin;
HardSourceWebpackPlugin.HardSourceAppendSerializerPlugin = HardSourceAppendSerializerPlugin;
HardSourceWebpackPlugin.HardSourceLevelDbSerializerPlugin = HardSourceLevelDbSerializerPlugin;
