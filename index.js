var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var lodash = require('lodash');
var _mkdirp = require('mkdirp');
var _rimraf = require('rimraf');
var nodeObjectHash = require('node-object-hash');

var envHash = require('./lib/env-hash');
var defaultConfigHash = require('./lib/default-config-hash');
var promisify = require('./lib/util/promisify');
var values = require('./lib/util/Object.values');
var relateContext = require('./lib/util/relate-context');
var pluginCompat = require('./lib/util/plugin-compat');

var LoggerFactory = require('./lib/logger-factory');

var cachePrefix = require('./lib/util').cachePrefix;

var CacheSerializerFactory = require('./lib/cache-serializer-factory');
var HardSourceJsonSerializerPlugin =
  require('./lib/hard-source-json-serializer-plugin');
var HardSourceAppendSerializerPlugin =
  require('./lib/hard-source-append-serializer-plugin');
var HardSourceLevelDbSerializerPlugin =
  require('./lib/hard-source-leveldb-serializer-plugin');

var hardSourceVersion = require('./package.json').version;

function requestHash(request) {
  return crypto.createHash('sha1').update(request).digest().hexSlice();
}

var mkdirp = promisify(_mkdirp, {context: _mkdirp});
mkdirp.sync = _mkdirp.sync.bind(_mkdirp);
var rimraf = promisify(_rimraf);
rimraf.sync = _rimraf.sync.bind(_rimraf);
var fsReadFile = promisify(fs.readFile, {context: fs});
var fsWriteFile = promisify(fs.writeFile, {context: fs});

var bulkFsTask = function(array, each) {
  return new Promise(function(resolve, reject) {
    var ops = 0;
    var out = [];
    array.forEach(function(item, i) {
      out[i] = each(item, function(back, callback) {
        ops++;
        return function(err, value) {
          try {
            out[i] = back(err, value, out[i]);
          }
          catch (e) {
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
};

var compilerContext = relateContext.compilerContext;
var relateNormalPath = relateContext.relateNormalPath;
var contextNormalPath = relateContext.contextNormalPath;
var contextNormalPathSet = relateContext.contextNormalPathSet;

function relateNormalRequest(compiler, key) {
  return key
  .split('!')
  .map(function(subkey) {
    return relateNormalPath(compiler, subkey);
  })
  .join('!');
}

function relateNormalModuleId(compiler, id) {
  return id.substring(0, 24) + relateNormalRequest(compiler, id.substring(24));
}

function contextNormalRequest(compiler, key) {
  return key
  .split('!')
  .map(function(subkey) {
    return contextNormalPath(compiler, subkey);
  })
  .join('!');
}

function contextNormalModuleId(compiler, id) {
  return id.substring(0, 24) + contextNormalRequest(compiler, id.substring(24));
}

function contextNormalLoaders(compiler, loaders) {
  return loaders.map(function(loader) {
    return Object.assign({}, loader, {
      loader: contextNormalPath(compiler, loader.loader),
    });
  });
}

function contextNormalPathArray(compiler, paths) {
  return paths.map(function(subpath) {
    return contextNormalPath(compiler, subpath);
  });
}

function HardSourceWebpackPlugin(options) {
  this.options = options || {};
}

HardSourceWebpackPlugin.prototype.getPath = function(dirName, suffix) {
  var confighashIndex = dirName.search(/\[confighash\]/);
  if (confighashIndex !== -1) {
    dirName = dirName.replace(/\[confighash\]/, this.configHash);
  }
  var cachePath = path.resolve(
    process.cwd(), this.compilerOutputOptions.path, dirName
  );
  if (suffix) {
    cachePath = path.join(cachePath, suffix);
  }
  return cachePath;
};

HardSourceWebpackPlugin.prototype.getCachePath = function(suffix) {
  return this.getPath(this.options.cacheDirectory, suffix);
};

HardSourceWebpackPlugin.prototype.apply = function(compiler) {
  var options = this.options;
  var active = true;

  var logger = new LoggerFactory(compiler).create();

  var loggerCore = logger.from('core');
  logger.lock();

  if (!compiler.options.cache) {
    compiler.options.cache = true;
  }

  if (!options.cacheDirectory) {
    options.cacheDirectory = path.resolve(
      process.cwd(),
      compiler.options.context,
      'node_modules/.cache/hard-source/[confighash]'
    );
  }

  this.compilerOutputOptions = compiler.options.output;
  if (!options.configHash) {
    options.configHash = defaultConfigHash;
  }
  if (options.configHash) {
    if (typeof options.configHash === 'string') {
      this.configHash = options.configHash;
    }
    else if (typeof options.configHash === 'function') {
      this.configHash = options.configHash(compiler.options);
    }
  }
  var configHashInDirectory =
    options.cacheDirectory.search(/\[confighash\]/) !== -1;
  if (configHashInDirectory && !this.configHash) {
    loggerCore.error(
      {
        id: 'confighash-directory-no-confighash',
        cacheDirectory: options.cacheDirectory
      },
      'HardSourceWebpackPlugin cannot use [confighash] in cacheDirectory ' +
      'without configHash option being set and returning a non-falsy value.'
    );
    active = false;
    compiler.plugin(['watch-run', 'run'], function(compiler, cb) {
      logger.unlock();
      cb();
    });
    return;
  }

  var environmentHasher = null;
  if (typeof options.environmentHash !== 'undefined') {
    if (options.environmentHash === false) {
      environmentHasher = function() {
        return Promise.resolve('');
      };
    }
    else if (typeof options.environmentHash === 'string') {
      environmentHasher = function() {
        return Promise.resolve(options.environmentHash);
      };
    }
    else if (typeof options.environmentHash === 'object') {
      environmentHasher = function() {
        return envHash(options.environmentHash);
      };
    }
    else if (typeof options.environmentHash === 'function') {
      environmentHasher = function() {
        return Promise.resolve(options.environmentHash());
      };
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
        'configuration.'
      );
    }
    else {
      compiler.options.recordsInputPath =
        this.getPath(options.recordsInputPath || options.recordsPath);
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
        'configuration.'
      );
    }
    else {
      compiler.options.recordsOutputPath =
        this.getPath(options.recordsOutputPath || options.recordsPath);
    }
  }

  var cacheDirPath = this.getCachePath();
  var cacheAssetDirPath = path.join(cacheDirPath, 'assets');
  var resolveCachePath = path.join(cacheDirPath, 'resolve.json');

  var currentStamp = '';

  var cacheSerializerFactory = new CacheSerializerFactory(compiler);
  var createSerializers = true;
  var cacheRead = false;

  var _this = this;

  pluginCompat.register(compiler, '_hardSourceCreateSerializer', 'sync', ['cacheSerializerFactory', 'cacheDirPath']);
  pluginCompat.register(compiler, '_hardSourceResetCache', 'sync', []);
  pluginCompat.register(compiler, '_hardSourceReadCache', 'asyncParallel', ['relativeHelpers']);
  pluginCompat.register(compiler, '_hardSourceVerifyCache', 'asyncParallel', []);
  pluginCompat.register(compiler, '_hardSourceWriteCache', 'asyncParallel', ['compilation', 'relativeHelpers']);

  compiler.plugin(['watch-run', 'run'], function(compiler, cb) {
    logger.unlock();

    if (!active) {return cb();}

    try {
      fs.statSync(cacheAssetDirPath);
    }
    catch (_) {
      mkdirp.sync(cacheAssetDirPath);
      if (configHashInDirectory) {
        loggerCore.warn(
          {
            id: 'new-config-hash',
            cacheDirPath: cacheDirPath
          },
          'HardSourceWebpackPlugin is writing to a new confighash path for ' + 
          'the first time: ' + cacheDirPath
        );
      }
      if (options.recordsPath || options.recordsOutputPath || options.recordsInputPath) {
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
            'configuration.'
          ].join('')
        );
      }
    }
    var start = Date.now();

    if (createSerializers) {
      createSerializers = false;
      try {
        pluginCompat.call(compiler, '_hardSourceCreateSerializer', [cacheSerializerFactory, cacheDirPath]);
      }
      catch (err) {
        return cb(err);
      }
    }

    Promise.all([
      fsReadFile(path.join(cacheDirPath, 'stamp'), 'utf8')
      .catch(function() {return '';}),

      environmentHasher(),

      fsReadFile(path.join(cacheDirPath, 'version'), 'utf8')
      .catch(function() {return '';}),
    ])
    .then(function(stamps) {
      var stamp = stamps[0];
      var hash = stamps[1];
      var versionStamp = stamps[2];

      if (!configHashInDirectory && options.configHash) {
        hash += '_' + _this.configHash;
      }

      currentStamp = hash;
      if (!hash || hash !== stamp || hardSourceVersion !== versionStamp) {
        if (hash && stamp) {
          loggerCore.error(
            {
              id: 'environment-changed'
            },
            'Environment has changed (node_modules or configuration was ' +
            'updated).\nHardSourceWebpackPlugin will reset the cache and ' +
            'store a fresh one.'
          );
        }
        else if (versionStamp && hardSourceVersion !== versionStamp) {
          loggerCore.error(
            {
              id: 'hard-source-changed'
            },
            'Installed HardSource version does not match the saved ' +
            'cache.\nHardSourceWebpackPlugin will reset the cache and store ' +
            'a fresh one.'
          );
        }

        // Reset the cache, we can't use it do to an environment change.
        pluginCompat.call(compiler, '_hardSourceResetCache', []);

        return rimraf(cacheDirPath);
      }

      if (cacheRead) {return Promise.resolve();}
      cacheRead = true;

      function contextKeys(compiler, fn) {
        return function(source) {
          var dest = {};
          Object.keys(source).forEach(function(key) {
            dest[fn(compiler, key)] = source[key];
          });
          return dest;
        }
      }

      function contextValues(compiler, fn) {
        return function(source) {
          var dest = {};
          Object.keys(source).forEach(function(key) {
            dest[key] = fn(compiler, source[key]);
          });
          return dest;
        }
      }

      function copyWithDeser(dest, source) {
        Object.keys(source).forEach(function(key) {
          var item = source[key];
          dest[key] = typeof item === 'string' ? JSON.parse(item) : item;
        });
      }

      return Promise.all([
        pluginCompat.promise(compiler, '_hardSourceReadCache', [{
          contextKeys,
          contextValues,
          contextNormalPath,
          contextNormalRequest,
          contextNormalModuleId,
          copyWithDeser,
        }]),
      ])
      .then(function() {
        // console.log('cache in', Date.now() - start);
      });
    })
    .then(cb, cb);
  });

  compiler.plugin(['watch-run', 'run'], function(_compiler, cb) {
    if (!active) {return cb();}

    // No previous build to verify.
    // if (Object.keys(moduleCache).length === 0) return cb();

    var stats = {};
    return pluginCompat.promise(compiler, '_hardSourceVerifyCache', [])
    .then(function() {cb();}, cb);
  });

  var detectModule = function(path) {
    try {
      require(path);
      return true;
    }
    catch (_) {
      return false;
    }
  };

  var webpackFeatures = {
    concatenatedModule: detectModule('webpack/lib/optimize/ConcatenatedModule'),
    generator: detectModule('webpack/lib/JavascriptGenerator'),
  };

  var schemasVersion = 2;
  if (webpackFeatures.concatenatedModule) {
    schemasVersion = 3;
  }
  if (webpackFeatures.generator) {
    schemasVersion = 4;
  }

  var ArchetypeSystem = require('./lib/archetype-system');

  var AssetCache = require('./lib/asset-cache');
  var ModuleCache = require('./lib/module-cache');

  var EnhancedResolveCache = require('./lib/enhanced-resolve-cache');
  var Md5Cache = require('./lib/md5-cache');
  var ModuleResolverCache = require('./lib/module-resolver-cache');

  var HardCompilationPlugin = require('./lib/hard-compilation-plugin');
  var HardAssetPlugin = require('./lib/hard-asset-plugin');
  var HardConcatenationModulePlugin;
  if (webpackFeatures.concatenatedModule) {
    HardConcatenationModulePlugin = require('./lib/hard-concatenation-module-plugin');
  }
  var HardContextModuleFactoryPlugin = require('./lib/hard-context-module-factory-plugin');
  var HardContextModulePlugin = require('./lib/hard-context-module-plugin');
  var HardNormalModulePlugin = require('./lib/hard-normal-module-plugin');
  var HardNormalModuleFactoryPlugin = require('./lib/hard-normal-module-factory-plugin');
  var HardModuleAssetsPlugin = require('./lib/hard-module-assets-plugin');
  var HardModuleErrorsPlugin = require('./lib/hard-module-errors-plugin');
  var HardModuleExtractTextPlugin = require('./lib/hard-module-extract-text-plugin');
  var HardModuleMiniCssExtractPlugin;
  if (webpackFeatures.generator) {
    HardModuleMiniCssExtractPlugin = require('./lib/hard-module-mini-css-extract-plugin');
  }
  var HardDependencyBlockPlugin = require('./lib/hard-dependency-block-plugin');
  var HardBasicDependencyPlugin = require('./lib/hard-basic-dependency-plugin');
  var HardHarmonyDependencyPlugin;
  var HardSourceSourcePlugin = require('./lib/hard-source-source-plugin');
  var HardParserPlugin = require('./lib/hard-parser-plugin');
  var HardGeneratorPlugin;
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

  new HardContextModuleFactoryPlugin({
    caches(compilation) {
      return {
        cachedMd5s: compilation.__hardSourceCachedMd5s,
        fileMd5s: compilation.__hardSourceFileMd5s,
        fileTimestamps: compilation.__hardSourceFileTimestamps,
        moduleCache: compilation.__hardSourceModuleCache,
        moduleResolveCache: compilation.__hardSourceModuleResolveCache,
        moduleResolveCacheChange: compilation.__hardSourceModuleResolveCacheChange,
      };
    }
  }).apply(compiler);
  new HardContextModulePlugin({
    schema: schemasVersion,
  }).apply(compiler);
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

  var freeze;

  pluginCompat.tap(compiler, '_hardSourceMethods', 'HardSource - index', function(methods) {
    freeze = methods.freeze;
  });

  compiler.plugin('after-compile', function(compilation, cb) {
    if (!active) {return cb();}

    var startCacheTime = Date.now();

    var identifierPrefix = cachePrefix(compilation);
    if (identifierPrefix !== null) {
      freeze('Compilation', null, compilation, {
        compilation: compilation,
      });
    }

    Promise.all([
      mkdirp(cacheDirPath)
      .then(function() {
        return Promise.all([
          fsWriteFile(path.join(cacheDirPath, 'stamp'), currentStamp, 'utf8'),
          fsWriteFile(path.join(cacheDirPath, 'version'), hardSourceVersion, 'utf8'),
        ]);
      }),
      pluginCompat.promise(compiler, '_hardSourceWriteCache', [compilation, {
        relateNormalPath,
        relateNormalRequest,
        relateNormalModuleId,
      }]),
    ])
    .then(function() {
      // console.log('cache out', Date.now() - startCacheTime);
      cb();
    }, cb);
  });
};

module.exports = HardSourceWebpackPlugin;

HardSourceWebpackPlugin.HardSourceJsonSerializerPlugin = HardSourceJsonSerializerPlugin;
HardSourceWebpackPlugin.HardSourceAppendSerializerPlugin = HardSourceAppendSerializerPlugin;
HardSourceWebpackPlugin.HardSourceLevelDbSerializerPlugin = HardSourceLevelDbSerializerPlugin;
