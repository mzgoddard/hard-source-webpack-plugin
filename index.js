const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const lodash = require('lodash');
const _mkdirp = require('mkdirp');
const _rimraf = require('rimraf');
const nodeObjectHash = require('node-object-hash');
const findCacheDir = require('find-cache-dir');

const envHash = require('./lib/envHash');
const defaultConfigHash = require('./lib/defaultConfigHash');
const promisify = require('./lib/util/promisify');
const relateContext = require('./lib/util/relate-context');
const pluginCompat = require('./lib/util/plugin-compat');
const logMessages = require('./lib/util/log-messages');

const LoggerFactory = require('./lib/loggerFactory');

const cachePrefix = require('./lib/util').cachePrefix;

const CacheSerializerFactory = require('./lib/CacheSerializerFactory');
const ExcludeModulePlugin = require('./lib/ExcludeModulePlugin');
const HardSourceLevelDbSerializerPlugin = require('./lib/SerializerLeveldbPlugin');
const SerializerAppend2Plugin = require('./lib/SerializerAppend2Plugin');
const SerializerAppendPlugin = require('./lib/SerializerAppendPlugin');
const SerializerCacachePlugin = require('./lib/SerializerCacachePlugin');
const SerializerJsonPlugin = require('./lib/SerializerJsonPlugin');

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
        findCacheDir({
          name: 'hard-source',
          cwd: compiler.options.context || process.cwd(),
        }),
        '[confighash]',
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
      compiler.__hardSource_configHash = this.configHash;
      compiler.__hardSource_shortConfigHash = this.configHash.substring(0, 8);
    }
    const configHashInDirectory =
      options.cacheDirectory.search(/\[confighash\]/) !== -1;
    if (configHashInDirectory && !this.configHash) {
      logMessages.configHashSetButNotUsed(compiler, {
        cacheDirectory: options.cacheDirectory,
      });
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
        environmentHasher.inputs = () =>
          envHash.inputs(options.environmentHash);
      } else if (typeof options.environmentHash === 'function') {
        environmentHasher = () => Promise.resolve(options.environmentHash());
        if (options.environmentHash.inputs) {
          environmentHasher.inputs = () =>
            Promise.resolve(options.environmentHasher.inputs());
        }
      }
    }
    if (!environmentHasher) {
      environmentHasher = envHash;
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

    if (configHashInDirectory) {
      const PruneCachesSystem = require('./lib/SystemPruneCaches');

      new PruneCachesSystem(
        path.dirname(cacheDirPath),
        options.cachePrune,
      ).apply(compiler);
    }

    function runReadOrReset(_compiler) {
      logger.unlock();

      if (!active) {
        return Promise.resolve();
      }

      try {
        fs.statSync(cacheAssetDirPath);
      } catch (_) {
        mkdirp.sync(cacheAssetDirPath);
        logMessages.configHashFirstBuild(compiler, {
          cacheDirPath,
          configHash: compiler.__hardSource_configHash,
        });
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

        environmentHasher.inputs ? environmentHasher.inputs() : null,
      ]).then(([stamp, hash, versionStamp, hashInputs]) => {
        if (!configHashInDirectory && options.configHash) {
          hash += `_${_this.configHash}`;
        }

        if (hashInputs && !cacheRead) {
          logMessages.environmentInputs(compiler, { inputs: hashInputs });
        }

        currentStamp = hash;
        if (!hash || hash !== stamp || hardSourceVersion !== versionStamp) {
          if (hash && stamp) {
            if (configHashInDirectory) {
              logMessages.environmentHashChanged(compiler);
            } else {
              logMessages.configHashChanged(compiler);
            }
          } else if (versionStamp && hardSourceVersion !== versionStamp) {
            logMessages.hardSourceVersionChanged(compiler);
          }

          // Reset the cache, we can't use it do to an environment change.
          pluginCompat.call(compiler, '_hardSourceResetCache', []);

          return rimraf(cacheDirPath);
        }

        if (cacheRead) {
          return Promise.resolve();
        }
        cacheRead = true;

        logMessages.configHashBuildWith(compiler, {
          cacheDirPath,
          configHash: compiler.__hardSource_configHash,
        });

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
              const value = fn(compiler, source[key], key);
              if (value) {
                dest[key] = value;
              } else {
                delete dest[key];
              }
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
        ])
          .catch(error => {
            logMessages.serialBadCache(compiler, error);

            return rimraf(cacheDirPath);
          })
          .then(() => {
            // console.log('cache in', Date.now() - start);
          });
      });
    }

    compilerHooks.watchRun.tapPromise(
      'HardSource - index - readOrReset',
      runReadOrReset,
    );
    compilerHooks.run.tapPromise(
      'HardSource - index - readOrReset',
      runReadOrReset,
    );

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

    const ArchetypeSystem = require('./lib/SystemArchetype');
    const ParitySystem = require('./lib/SystemParity');

    const AssetCache = require('./lib/CacheAsset');
    const ModuleCache = require('./lib/CacheModule');

    const EnhancedResolveCache = require('./lib/CacheEnhancedResolve');
    const Md5Cache = require('./lib/CacheMd5');
    const ModuleResolverCache = require('./lib/CacheModuleResolver');

    const TransformCompilationPlugin = require('./lib/TransformCompilationPlugin');
    const TransformAssetPlugin = require('./lib/TransformAssetPlugin');
    let TransformConcatenationModulePlugin;
    if (webpackFeatures.concatenatedModule) {
      TransformConcatenationModulePlugin = require('./lib/TransformConcatenationModulePlugin');
    }
    const TransformNormalModulePlugin = require('./lib/TransformNormalModulePlugin');
    const TransformNormalModuleFactoryPlugin = require('./lib/TransformNormalModuleFactoryPlugin');
    const TransformModuleAssetsPlugin = require('./lib/TransformModuleAssetsPlugin');
    const TransformModuleErrorsPlugin = require('./lib/TransformModuleErrorsPlugin');
    const SupportExtractTextPlugin = require('./lib/SupportExtractTextPlugin');
    let SupportMiniCssExtractPlugin;
    let ExcludeMiniCssModulePlugin;
    if (webpackFeatures.generator) {
      SupportMiniCssExtractPlugin = require('./lib/SupportMiniCssExtractPlugin');
      ExcludeMiniCssModulePlugin = require('./lib/ExcludeMiniCssModulePlugin');
    }
    const TransformDependencyBlockPlugin = require('./lib/TransformDependencyBlockPlugin');
    const TransformBasicDependencyPlugin = require('./lib/TransformBasicDependencyPlugin');
    let HardHarmonyDependencyPlugin;
    const TransformSourcePlugin = require('./lib/TransformSourcePlugin');
    const TransformParserPlugin = require('./lib/TransformParserPlugin');
    let TransformGeneratorPlugin;
    if (webpackFeatures.generator) {
      TransformGeneratorPlugin = require('./lib/TransformGeneratorPlugin');
    }

    const ChalkLoggerPlugin = require('./lib/ChalkLoggerPlugin');

    new ArchetypeSystem().apply(compiler);
    new ParitySystem().apply(compiler);

    new AssetCache().apply(compiler);
    new ModuleCache().apply(compiler);

    new EnhancedResolveCache().apply(compiler);
    new Md5Cache().apply(compiler);
    new ModuleResolverCache().apply(compiler);

    new TransformCompilationPlugin().apply(compiler);

    new TransformAssetPlugin().apply(compiler);

    new TransformNormalModulePlugin({
      schema: schemasVersion,
    }).apply(compiler);
    new TransformNormalModuleFactoryPlugin().apply(compiler);

    if (TransformConcatenationModulePlugin) {
      new TransformConcatenationModulePlugin().apply(compiler);
    }

    new TransformModuleAssetsPlugin().apply(compiler);
    new TransformModuleErrorsPlugin().apply(compiler);
    new SupportExtractTextPlugin().apply(compiler);

    if (SupportMiniCssExtractPlugin) {
      new SupportMiniCssExtractPlugin().apply(compiler);
      new ExcludeMiniCssModulePlugin().apply(compiler);
    }

    new TransformDependencyBlockPlugin({
      schema: schemasVersion,
    }).apply(compiler);

    new TransformBasicDependencyPlugin({
      schema: schemasVersion,
    }).apply(compiler);

    new TransformSourcePlugin({
      schema: schemasVersion,
    }).apply(compiler);

    new TransformParserPlugin({
      schema: schemasVersion,
    }).apply(compiler);

    if (TransformGeneratorPlugin) {
      new TransformGeneratorPlugin({
        schema: schemasVersion,
      }).apply(compiler);
    }

    new ChalkLoggerPlugin(this.options.info).apply(compiler);

    function runVerify(_compiler) {
      if (!active) {
        return Promise.resolve();
      }

      const stats = {};
      return pluginCompat.promise(compiler, '_hardSourceVerifyCache', []);
    }

    compilerHooks.watchRun.tapPromise('HardSource - index - verify', runVerify);
    compilerHooks.run.tapPromise('HardSource - index - verify', runVerify);

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

            contextNormalPath,
            contextNormalRequest,
            contextNormalModuleId,
          },
        ]),
      ]).then(() => {
        // console.log('cache out', Date.now() - startCacheTime);
      });
    });
  }
}

module.exports = HardSourceWebpackPlugin;

HardSourceWebpackPlugin.ExcludeModulePlugin = ExcludeModulePlugin;
HardSourceWebpackPlugin.HardSourceLevelDbSerializerPlugin = HardSourceLevelDbSerializerPlugin;
HardSourceWebpackPlugin.LevelDbSerializerPlugin = HardSourceLevelDbSerializerPlugin;
HardSourceWebpackPlugin.SerializerAppend2Plugin = SerializerAppend2Plugin;
HardSourceWebpackPlugin.SerializerAppendPlugin = SerializerAppendPlugin;
HardSourceWebpackPlugin.SerializerCacachePlugin = SerializerCacachePlugin;
HardSourceWebpackPlugin.SerializerJsonPlugin = SerializerJsonPlugin;

Object.defineProperty(HardSourceWebpackPlugin, 'ParallelModulePlugin', {
  get() {
    return require('./lib/ParallelModulePlugin');
  },
});
