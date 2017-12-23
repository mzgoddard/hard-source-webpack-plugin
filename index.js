var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var lodash = require('lodash');
var _mkdirp = require('mkdirp');
var _rimraf = require('rimraf');

var nodeObjectHash = require('node-object-hash');

var envHash = require('./lib/env-hash');
var promisify = require('./lib/util/promisify');
var values = require('./lib/util/Object.values');

var AMDRequireContextDependency = require('webpack/lib/dependencies/AMDRequireContextDependency');
var CommonJsRequireContextDependency = require('webpack/lib/dependencies/CommonJsRequireContextDependency');
var ContextDependency = require('webpack/lib/dependencies/ContextDependency');
var RequireContextDependency = require('webpack/lib/dependencies/RequireContextDependency');
var RequireResolveContextDependency = require('webpack/lib/dependencies/RequireResolveContextDependency');

try{
  var NullDependencyTemplate = require('webpack/lib/dependencies/NullDependencyTemplate');
} catch(ex) {
  var NullDependencyTemplate = require('webpack/lib/dependencies/NullDependency').Template;
}
var NullFactory = require('webpack/lib/NullFactory');

var HarmonyCompatibilityDependency;
var HarmonyExportImportedSpecifierDependency;
var HarmonyImportDependency;
var HarmonyImportSpecifierDependency;
var ImportContextDependency;

try {
  HarmonyExportImportedSpecifierDependency = require('webpack/lib/dependencies/HarmonyExportImportedSpecifierDependency');
  HarmonyImportDependency = require('webpack/lib/dependencies/HarmonyImportDependency');
  HarmonyImportSpecifierDependency = require('webpack/lib/dependencies/HarmonyImportSpecifierDependency');
  ImportContextDependency = require('webpack/lib/dependencies/ImportContextDependency');

  try {
    HarmonyCompatibilityDependency = require('webpack/lib/dependencies/HarmonyCompatibilityDependency');
  }
  catch (_) {
    HarmonyCompatibilityDependency = require('webpack/lib/dependencies/HarmonyCompatiblilityDependency');
  }
}
catch (_) {
  HarmonyCompatibilityDependency = function() {};
}

var HardModuleDependency = require('./lib/dependencies').HardModuleDependency;
var HardContextDependency = require('./lib/dependencies').HardContextDependency;
var HardNullDependency = require('./lib/dependencies').HardNullDependency;
var HardHarmonyExportExpressionDependency = require('./lib/dependencies').HardHarmonyExportExpressionDependency;
var HardHarmonyExportHeaderDependency = require('./lib/dependencies').HardHarmonyExportHeaderDependency;
var HardHarmonyExportSpecifierDependency = require('./lib/dependencies').HardHarmonyExportSpecifierDependency;
var HardHarmonyImportDependency =
require('./lib/dependencies').HardHarmonyImportDependency;
var HardHarmonyImportSpecifierDependency =
require('./lib/dependencies').HardHarmonyImportSpecifierDependency;
var HardHarmonyExportImportedSpecifierDependency = require('./lib/dependencies').HardHarmonyExportImportedSpecifierDependency;
var HardHarmonyCompatibilityDependency = require('./lib/dependencies').HardHarmonyCompatibilityDependency;

var HardContextModule = require('./lib/hard-context-module');
var HardContextModuleFactory = require('./lib/hard-context-module-factory');
var HardModule = require('./lib/hard-module');

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

var NS;

NS = fs.realpathSync(__dirname);

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

  if (!options.cacheDirectory) {
    options.cacheDirectory = path.resolve(
      process.cwd(),
      compiler.options.context,
      'node_modules/.cache/hard-source/[confighash]'
    );
  }

  this.compilerOutputOptions = compiler.options.output;
  if (!options.configHash) {
    options.configHash = nodeObjectHash({sort: false}).hash;
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
        'Can not set recordsInputPath when it is already set. Using current ' +
        'value: ' +
        (compiler.options.recordsInputPath || compiler.options.recordsPath)
      );
    }
    else {
      compiler.options.recordsInputPath =
        this.getPath(options.recordsInputPath || options.recordsPath);
    }
  }
  else if (
    !compiler.options.recordsInputPath &&
    !compiler.options.recordsPath
  ) {
    options.recordsInputPath = path.join(options.cacheDirectory, 'records.json');
    compiler.options.recordsInputPath = this.getPath(options.recordsInputPath);
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
        'Can not set recordsOutputPath when it is already set. Using current ' +
        'value: ' +
        (compiler.options.recordsOutputPath || compiler.options.recordsPath)
      );
    }
    else {
      compiler.options.recordsOutputPath =
        this.getPath(options.recordsOutputPath || options.recordsPath);
    }
  }
  else if (
    !compiler.options.recordsOutputPath &&
    !compiler.options.recordsPath
  ) {
    options.recordsOutputPath = path.join(options.cacheDirectory, 'records.json');
    compiler.options.recordsOutputPath =
      this.getPath(options.recordsOutputPath);
  }

  var cacheDirPath = this.getCachePath();
  var cacheAssetDirPath = path.join(cacheDirPath, 'assets');
  var resolveCachePath = path.join(cacheDirPath, 'resolve.json');

  var moduleCache = {};
  var assetCache = {};
  var dataCache = {};
  var moduleResolveCache = {};
  var md5Cache = {};
  var missingCache = {normal: {},loader: {},context: {}};
  var resolverCache = {normal: {},loader: {},context: {}};
  var currentStamp = '';

  var moduleResolveCacheChange = [];

  var fileMd5s = {};
  var cachedMd5s = {};
  var fileTimestamps = {};
  var contextMd5s = {};
  var contextTimestamps = {};

  var cacheSerializerFactory = new CacheSerializerFactory(compiler);

  var assetCacheSerializer;
  var moduleCacheSerializer;
  var dataCacheSerializer;
  var md5CacheSerializer;
  var moduleResolveCacheSerializer;
  var missingCacheSerializer;
  var resolverCacheSerializer;

  var _this = this;

  var stat, readdir, readFile, mtime, md5, fileStamp, contextStamps;

  compiler.plugin('after-plugins', function() {
    if (
      !compiler.recordsInputPath || !compiler.recordsOutputPath
    ) {
      loggerCore.error(
        {
          id: 'no-records-path'
        },
        'recordsPath must be set.'
      );
      active = false;
    }
  });

  function bindFS() {
    stat = promisify(
      compiler.inputFileSystem.stat,
      {context: compiler.inputFileSystem}
    );
    // stat = promisify(fs.stat, {context: fs});

    readdir = promisify(
      compiler.inputFileSystem.readdir,
      {context: compiler.inputFileSystem}
    );

    readFile = promisify(
      compiler.inputFileSystem.readFile,
      {context: compiler.inputFileSystem}
    );

    mtime = function(file) {
      return stat(file)
      .then(function(stat) {return +stat.mtime;})
      .catch(function() {return 0;});
    };

    md5 = function(file) {
      return readFile(file)
      .then(function(contents) {
        return crypto.createHash('md5').update(contents, 'utf8').digest('hex');
      })
      .catch(function() {return '';});
    };

    fileStamp = function(file, stats) {
      if (compiler.fileTimestamps[file]) {
        return compiler.fileTimestamps[file];
      }
      else {
        if (!stats[file]) {stats[file] = stat(file);}
        return stats[file]
        .then(function(stat) {
          var mtime = +stat.mtime;
          compiler.fileTimestamps[file] = mtime;
          return mtime;
        });
      }
    };

    contextStamp = function(dir, stats) {
      var context = {};

      var selfTime = 0;

      function walk(dir) {
        return readdir(dir)
        .then(function(items) {
          return Promise.all(items.map(function(item) {
            var file = path.join(dir, item);
            if (!stats[file]) {stats[file] = stat(file);}
            return stats[file]
            .then(function(stat) {
              if (stat.isDirectory()) {
                return walk(path.join(dir, item))
                .then(function(items2) {
                  return items2.map(function(item2) {
                    return path.join(item, item2);
                  });
                });
              }
              if (+stat.mtime > selfTime) {
                selfTime = +stat.mtime;
              }
              return item;
            }, function() {
              return;
            });
          }));
        })
        .catch(() => [])
        .then(function(items) {
          return items.reduce(function(carry, item) {
            return carry.concat(item);
          }, [])
          .filter(Boolean);
        });
      }

      return walk(dir)
      .then(function(items) {
        items.sort();
        var selfHash = crypto.createHash('md5');
        items.forEach(function(item) {
          selfHash.update(item);
        });
        context.mtime = selfTime;
        context.hash = selfHash.digest('hex');
        return context;
      });
    };

    contextStamps = function(contextDependencies, stats) {
      stats = stats || {};
      var contexts = {};
      contextDependencies.forEach(function(context) {
        contexts[context] = {files: [], mtime: 0, hash: ''};
      });

      var compilerContextTs = compiler.contextTimestamps;

      contextDependencies.forEach(function(contextPath) {
        const _context = contextStamp(contextPath, stats);
        if (!_context.then) {
          contexts[contextPath] = _context;
        }
        else {
          contexts[contextPath] = _context
          .then(function(context) {
            contexts[contextPath] = context;
            return context;
          });
        }
      });
      return contexts;
    };
  }

  if (compiler.inputFileSystem) {
    bindFS();
  }
  else {
    compiler.plugin('after-environment', bindFS);
  }

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
    }
    var start = Date.now();

    if (!assetCacheSerializer) {
      try {
        assetCacheSerializer = cacheSerializerFactory.create({
          name: 'assets',
          type: 'file',
          cacheDirPath: cacheDirPath,
        });
        moduleCacheSerializer = cacheSerializerFactory.create({
          name: 'module',
          type: 'data',
          cacheDirPath: cacheDirPath,
          autoParse: true,
        });
        dataCacheSerializer = cacheSerializerFactory.create({
          name: 'data',
          type: 'data',
          cacheDirPath: cacheDirPath,
        });
        md5CacheSerializer = cacheSerializerFactory.create({
          name: 'md5',
          type: 'data',
          cacheDirPath: cacheDirPath,
        });
        moduleResolveCacheSerializer = cacheSerializerFactory.create({
          name: 'module-resolve',
          type: 'data',
          cacheDirPath: cacheDirPath,
        });
        missingCacheSerializer = cacheSerializerFactory.create({
          name: 'missing-resolve',
          type: 'data',
          cacheDirPath: cacheDirPath,
        });
        resolverCacheSerializer = cacheSerializerFactory.create({
          name: 'resolver',
          type: 'data',
          cacheDirPath: cacheDirPath,
        });
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
        moduleCache = {};
        assetCache = {};
        dataCache = {};
        moduleResolveCache = {};
        md5Cache = {};
        missingCache = {normal: {},loader: {},context: {}};
        resolverCache = {normal: {},loader: {},context: {}};
        fileTimestamps = {};
        contextTimestamps = {};

        return rimraf(cacheDirPath);
      }

      if (Object.keys(moduleCache).length) {return Promise.resolve();}

      function copyWithDeser(dest, source) {
        Object.keys(source).forEach(function(key) {
          var item = source[key];
          dest[key] = typeof item === 'string' ? JSON.parse(item) : item;
        });
      }

      return Promise.all([
        assetCacheSerializer.read()
        .then(function(_assetCache) {assetCache = _assetCache;}),

        moduleCacheSerializer.read()
        .then(copyWithDeser.bind(null, moduleCache)),

        dataCacheSerializer.read()
        .then(copyWithDeser.bind(null, dataCache)),

        md5CacheSerializer.read()
        .then(function(_md5Cache) {md5Cache = _md5Cache;})
        .then(function() {
          Object.keys(md5Cache).forEach(function(key) {
            if (typeof md5Cache[key] === 'string') {
              md5Cache[key] = JSON.parse(md5Cache[key]);
            }

            cachedMd5s[key] = md5Cache[key].hash;
          });
        }),

        moduleResolveCacheSerializer.read()
        .then(copyWithDeser.bind(null, moduleResolveCache)),

        missingCacheSerializer.read()
        .then(function(_missingCache) {
          missingCache = {normal: {},loader: {}, context: {}};
          Object.keys(_missingCache).forEach(function(key) {
            var item = _missingCache[key];
            if (typeof item === 'string') {
              item = JSON.parse(item);
            }
            var splitIndex = key.indexOf('/');
            var group = key.substring(0, splitIndex);
            var keyName = key.substring(splitIndex + 1);
            missingCache[group][keyName] = item;
          });
        }),

        resolverCacheSerializer.read()
        .then(function(_resolverCache) {
          resolverCache = {normal: {},loader: {}, context: {}};
          Object.keys(_resolverCache).forEach(function(key) {
            var item = _resolverCache[key];
            if (typeof item === 'string') {
              item = JSON.parse(item);
            }
            var splitIndex = key.indexOf('/');
            var group = key.substring(0, splitIndex);
            var keyName = key.substring(splitIndex + 1);
            resolverCache[group][keyName] = item;
          });
        }),
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
    if (!dataCache.fileDependencies) return cb();

    var stats = {};
    return Promise.all([
      (function() {
        var compilerFileTs = compiler.fileTimestamps = {};
        var fileTs = fileTimestamps = {};

        return bulkFsTask(dataCache.fileDependencies, function(file, task) {
          if (compiler.fileTimestamps[file]) {
            return compiler.fileTimestamps[file];
          }
          else {
            compiler.inputFileSystem.stat(file, task(function(err, value) {
              if (err) {
                return 0;
              }

              var mtime = +value.mtime;
              compiler.fileTimestamps[file] = mtime;
              return mtime;
            }));
          }
        })
        .then(function(mtimes) {
          const bulk = lodash.zip(dataCache.fileDependencies, mtimes);
          return bulkFsTask(bulk, function(item, task) {
            var file = item[0];
            var mtime = item[1];

            fileTs[file] = mtime || 0;
            if (!compiler.fileTimestamps[file]) {
              compiler.fileTimestamps[file] = mtime;
            }

            if (
              fileTs[file] &&
              md5Cache[file] &&
              fileTs[file] < md5Cache[file].mtime
            ) {
              fileTs[file] = md5Cache[file].mtime;
              fileMd5s[file] = md5Cache[file].hash;
            }
            else {
              compiler.inputFileSystem.readFile(file, task(function(err, body) {
                if (err) {
                  fileMd5s[file] = '';
                  return;
                }

                const hash = crypto.createHash('md5')
                .update(body, 'utf8').digest('hex');

                fileMd5s[file] = hash;
              }));
            }
          });
        });
      })(),
      (function() {
        compiler.contextTimestamps = compiler.contextTimestamps || {};
        var contextTs = contextTimestamps = {};
        const contexts = contextStamps(dataCache.contextDependencies, stats);
        return Promise.all(values(contexts))
        .then(function() {
          for (var contextPath in contexts) {
            var context = contexts[contextPath];

            if (!compiler.contextTimestamps[contextPath]) {
              compiler.contextTimestamps[contextPath] = context.mtime;
            }
            contextTimestamps[contextPath] = context.mtime;
            fileMd5s[contextPath] = context.hash;
          }
        });
      })(),
      (function() {
        var bulk = lodash.flatten(Object.keys(missingCache)
        .map(function(group) {
          return lodash.flatten(Object.keys(missingCache[group])
          .map(function(key) {
            var missingItem = missingCache[group][key];
            if (!missingItem) {return;}
            return missingItem.map(function(missed, index) {
              return [group, key, missed, index];
            });
          })
          .filter(Boolean));
        }));

        return bulkFsTask(bulk, function(item, task) {
          var group = item[0];
          var key = item[1];
          var missingItem = missingCache[group][key];
          var missed = item[2];
          var missedPath = missed.split('?')[0];
          var missedIndex = item[3];

          // The missed index is the resolved item. Invalidate if it does not
          // exist.
          if (missedIndex === missingItem.length - 1) {
            compiler.inputFileSystem.stat(missed, task(function(err, stat) {
              if (err) {
                missingItem.invalid = true;
              }
            }));
          }
          else {
            compiler.inputFileSystem.stat(missed, task(function(err, stat) {
              if (err) {return;}

              if (stat.isDirectory()) {
                if (group === 'context') {missingItem.invalid = true;}
              }
              if (stat.isFile()) {
                if (group === 'loader' || group === 'normal') {
                  missingItem.invalid = true;
                }
              }
            }));
          }
        });
      })(),
    ])
    .then(function() {
      // Invalidate resolve cache items.
      Object.keys(moduleResolveCache).forEach(function(key) {
        var resolveKey = JSON.parse(key);
        var resolveItem = moduleResolveCache[key];
        if (resolveItem.type === 'context') {
          var contextMissing = missingCache.context[JSON.stringify([
            resolveKey.context,
            resolveItem.resource.split('?')[0]
          ])];
          if (!contextMissing || contextMissing.invalid) {
            resolveItem.invalid = true;
          }
        }
        else {
          var normalMissing = missingCache.normal[JSON.stringify([
            resolveKey[1],
            resolveItem.resource.split('?')[0]
          ])];
          if (!normalMissing || normalMissing.invalid) {
            resolveItem.invalid = true;
          }
          resolveItem.loaders.forEach(function(loader) {
            if (typeof loader === 'object') {
              loader = loader.loader;
            }
            // Loaders specified in a dependency are searched for from the
            // context of the module containing that dependency.
            var loaderMissing = missingCache.loader[JSON.stringify([
              resolveKey[1],
              loader.split('?')[0]
            ])];
            if (!loaderMissing) {
              // webpack searches for rule based loaders from the project
              // context.
              loaderMissing = missingCache.loader[JSON.stringify([
                // compiler may be a Watching instance, which refers to the
                // compiler
                (compiler.options || compiler.compiler.options).context,
                loader.split('?')[0]
              ])];
            }
            if (!loaderMissing || loaderMissing.invalid) {
              resolveItem.invalid = true;
            }
          });
        }
      });
    })
    .then(function() {cb();}, cb);
  });

  compiler.plugin('after-plugins', function() {
    compiler.plugin('compilation', function(compilation, params) {
      var factories = compilation.dependencyFactories;
      var contextFactory = factories.get(RequireContextDependency) ||
        params.contextModuleFactory;

      var hardContextFactory = new HardContextModuleFactory({
        compilation: compilation,
        factory: contextFactory,
        resolveCache: moduleResolveCache,
        moduleCache: moduleCache,
        fileTimestamps: fileTimestamps,
        fileMd5s: fileMd5s,
        cachedMd5s: cachedMd5s,
      });

      factories.set(AMDRequireContextDependency, hardContextFactory);
      factories.set(CommonJsRequireContextDependency, hardContextFactory);
      factories.set(RequireContextDependency, hardContextFactory);
      factories.set(RequireResolveContextDependency, hardContextFactory);

      if (ImportContextDependency) {
        factories.set(ImportContextDependency, hardContextFactory);
      }

      factories.set(HardContextDependency, hardContextFactory);
    });
  });

  function getModuleCacheItem(compilation, result) {
    // a map of dependency identifiers to factory.create checks
    var checkedDependencies =
      compilation.__hardSource_checkedDependencies =
      compilation.__hardSource_checkedDependencies || {};
    // a map of module identifiers to fully checked modules
    var checkedModules =
      compilation.__hardSource_checkedModules =
      compilation.__hardSource_checkedModules || {};

    if (checkedModules[result.request] && !checkedModules[result.request].invalid) {
      return checkedModules[result.request];
    }

    var identifierPrefix = cachePrefix(compilation);
    if (identifierPrefix === null) {
      return;
    }
    var identifier = identifierPrefix + result.request;

    if (moduleCache[identifier] && !moduleCache[identifier].invalid) {
      var cacheItem = moduleCache[identifier];

      if (typeof cacheItem === 'string') {
        cacheItem = JSON.parse(cacheItem);
        moduleCache[identifier] = cacheItem;
      }
      // if (Array.isArray(cacheItem.assets)) {
      //   cacheItem.assets = (cacheItem.assets || [])
      //   .reduce(function(carry, key) {
      //     carry[key] = assetCache[requestHash(key)];
      //     return carry;
      //   }, {});
      // }

      if (!HardModule.needRebuild(
        cacheItem,
        cacheItem.fileDependencies,
        cacheItem.contextDependencies,
        fileTimestamps,
        contextTimestamps,
        fileMd5s,
        cachedMd5s
      )) {
        var promise = null;

        var walkDependencyBlock = function(block, callback) {
          var addPromise = function(item) {
            var p = callback(item);
            if (p && p.then) {
              if (!promise) {promise = [];}
              promise.push(p);
            }
          };
          block.dependencies.forEach(addPromise)
          block.variables.forEach(function(variable) {
            variable.dependencies.forEach(addPromise);
          })
          block.blocks.forEach(function(block) {
            walkDependencyBlock(block, callback);
          })
        };

        var state = {state: {imports: {}}};

        walkDependencyBlock(cacheItem.dependencyBlock, function(cacheDependency) {
          if (
            cacheDependency &&
            cacheDependency.type !== 'ContextDependency' &&
            typeof cacheDependency.request !== 'undefined'
          ) {
            var resolveId = cacheDependency._moduleResolveCacheId;
            var resolveItem = moduleResolveCache[resolveId];
            if (
              resolveItem &&
              !resolveItem.invalid
            ) {
              var depIdentifier = identifierPrefix + resolveItem.request;
              var depCacheItem = moduleCache[depIdentifier];
              if (
                depCacheItem &&
                depCacheItem.fileDependencies
                .reduce(function(carry, file) {
                  return carry && fileTimestamps[file];
                }, true) &&
                depCacheItem.contextDependencies
                .reduce(function(carry, dir) {
                  return carry && contextTimestamps[dir];
                }, true)
              ) {
                return;
              }
              else if (depCacheItem) {
                return;
              }
            }
            else if (resolveItem && resolveItem.invalid) {
              cacheItem.invalid = true;
              cacheItem.invalidReason = 'resolveItem';
              return;
            }
          }

          if (
            cacheDependency._resolvedModuleIdentifier &&
            cacheDependency._inContextDependencyIdentifier
          ) {
            var dependencyIdentifier = cacheDependency._inContextDependencyIdentifier;
            if (!checkedDependencies[dependencyIdentifier]) {
              var dependency = thaw('dependency', null, cacheDependency, {
                state: state.state,
                compilation: compilation,
              });
              var factory = compilation.dependencyFactories.get(dependency.constructor);
              var p = new Promise(function(resolve, reject) {
                var callFactory = function(fn) {
                  if (factory.create.length === 2) {
                    factory.create({
                      contextInfo: {
                        issuer: cacheItem.resource.split('?')[0],
                      },
                      context: cacheItem.context,
                      dependencies: [dependency],
                    }, fn);
                  }
                  if (factory.create.length === 3) {
                    factory.create(cacheItem.context, dependency, fn);
                  }
                };
                callFactory(function(err, depModule) {
                  if (
                    !checkedDependencies[dependencyIdentifier] ||
                    checkedDependencies[dependencyIdentifier].then
                  ) {
                    checkedDependencies[dependencyIdentifier] = cacheItem;
                  }
                  if (err) {
                    cacheItem.invalid = true;
                    cacheItem.invalidReason = 'dependencyIdentifier';
                    return reject(err);
                  }
                  // IgnorePlugin and other plugins can call this callback
                  // without an error or module.
                  if (!depModule) {return resolve();}

                  if (cacheDependency._resolvedModuleIdentifier === depModule.identifier()) {
                    return resolve();
                  }
                  cacheItem.invalid = true;
                  reject(new Error('dependency has a new identifier'));
                  loggerCore.debug(
                    {
                      id: 'invalid-module--must-update-dependency',
                      moduleIdentifier: cacheItem.identifier,
                      dependedModuleIdentifier: depModule.identifier()
                    },
                    'The cached "' + cacheItem.identifier + '" module is ' +
                    'invalid. It depends on a module that has resolved to a ' +
                    'new identifier. Either its loaders changed or the ' +
                    'resolved file on disk moved.'
                  );
                });
              });
              if (!checkedDependencies[dependencyIdentifier]) {
                checkedDependencies[dependencyIdentifier] = p;
              }
              else {
                return p;
              }
            }
            return checkedDependencies[dependencyIdentifier];
          }
        });

        if (promise && promise.length) {
          return Promise.all(promise)
          .then(function() {
            if (!cacheItem || cacheItem.invalid) {
              throw new Error('invalid cacheItem');
            }
            checkedModules[result.request] = cacheItem;
            return cacheItem;
          })
          .catch(function(e) {
            cacheItem.invalid = true;
            cacheItem.invalidReason = 'error while validating dependencies';
            moduleCache[identifier] = null;
            throw new Error(
              'invalid cacheItem: ' + e.message + '\n' +
              (e.stack && e.stack.split('\n')[1])
            );
          });
        }
        else {
          if (!cacheItem || cacheItem.invalid) {
            if (cacheItem) {
              cacheItem = null;
            }
            moduleCache[identifier] = null;
          }
          checkedModules[result.request] = cacheItem;
          return cacheItem;
        }
      }
    }
  }

  function bindResolvers() {
    function configureMissing(key, resolver) {
      // missingCache[key] = missingCache[key] || {};
      // resolverCache[key] = resolverCache[key] || {};

      var _resolve = resolver.resolve;
      resolver.resolve = function(info, context, request, cb) {
        var numArgs = 4;
        if (!cb) {
          numArgs = 3;
          cb = request;
          request = context;
          context = info;
        }
        var resolveId = JSON.stringify([context, request]);
        var resolve = resolverCache[key][resolveId];
        if (resolve && !resolve.invalid) {
          var missingId = JSON.stringify([context, resolve.result]);
          var missing = missingCache[key][missingId];
          if (missing && !missing.invalid) {
            return cb(null, [resolve.result].concat(request.split('?').slice(1)).join('?'));
          }
          else {
            resolve.invalid = true;
          }
        }
        var localMissing = [];
        var callback = function(err, result) {
          if (result) {
            var inverseId = JSON.stringify([context, result.split('?')[0]]);
            var resolveId = JSON.stringify([context, request]);

            // Skip recording missing for any dependency in node_modules.
            // Changes to them will be handled by the environment hash. If we
            // tracked the stuff in node_modules too, we'd be adding a whole
            // bunch of reduntant work.
            if (result.indexOf('node_modules') !== -1) {
              localMissing = localMissing.filter(function(missed) {
                return missed.indexOf('node_modules') === -1;
              });
            }

            // In case of other cache layers, if we already have missing
            // recorded and we get a new empty array of missing, keep the old
            // value.
            if (localMissing.length === 0 && missingCache[key][inverseId]) {
              return cb(err, result);
            }

            missingCache[key][inverseId] = localMissing.filter(function(missed, missedIndex) {
              var index = localMissing.indexOf(missed);
              if (index === -1 || index < missedIndex) {
                return false;
              }
              if (missed === result) {
                return false;
              }
              return true;
            }).concat(result.split('?')[0]);
            missingCache[key][inverseId].new = true;
            resolverCache[key][resolveId] = {
              result: result.split('?')[0],
              new: true,
            };
          }
          cb(err, result);
        };
        if (callback.missing) {
          var _missing = callback.missing;
          callback.missing = {push: function(path) {
            localMissing.push(path);
            _missing.push(path);
          }};
        }
        else {
          callback.missing = localMissing;
        }
        if (numArgs === 3) {
          _resolve.call(this, context, request, callback);
        }
        else {
          _resolve.call(this, info, context, request, callback);
        }
      };
    }

    configureMissing('normal', compiler.resolvers.normal);
    configureMissing('loader', compiler.resolvers.loader);
    configureMissing('context', compiler.resolvers.context);
  }

  compiler.plugin('after-plugins', function() {
    if (compiler.resolvers.normal) {
      bindResolvers();
    }
    else {
      compiler.plugin('after-resolvers', bindResolvers);
    }
  });

  compiler.plugin('compilation', function(compilation, params) {
    if (!active) {return;}

    compilation.fileTimestamps = fileTimestamps;
    compilation.contextTimestamps = contextTimestamps;

    compilation.__hardSourceFileMd5s = fileMd5s;
    compilation.__hardSourceCachedMd5s = cachedMd5s;

    compilation.dependencyFactories.set(HardModuleDependency, params.normalModuleFactory);
    compilation.dependencyTemplates.set(HardModuleDependency, new NullDependencyTemplate);

    compilation.dependencyFactories.set(HardContextDependency, params.contextModuleFactory);
    compilation.dependencyTemplates.set(HardContextDependency, new NullDependencyTemplate);

    compilation.dependencyFactories.set(HardNullDependency, new NullFactory());
    compilation.dependencyTemplates.set(HardNullDependency, new NullDependencyTemplate);

    compilation.dependencyFactories.set(HardHarmonyExportExpressionDependency, new NullFactory());
    compilation.dependencyTemplates.set(HardHarmonyExportExpressionDependency, new NullDependencyTemplate);

    compilation.dependencyFactories.set(HardHarmonyExportHeaderDependency, new NullFactory());
    compilation.dependencyTemplates.set(HardHarmonyExportHeaderDependency, new NullDependencyTemplate);

    compilation.dependencyFactories.set(HardHarmonyExportSpecifierDependency, new NullFactory());
    compilation.dependencyTemplates.set(HardHarmonyExportSpecifierDependency, new NullDependencyTemplate);

    compilation.dependencyFactories.set(HardHarmonyImportDependency, params.normalModuleFactory);
    compilation.dependencyTemplates.set(HardHarmonyImportDependency, new NullDependencyTemplate);

    compilation.dependencyFactories.set(HardHarmonyImportSpecifierDependency, new NullFactory());
    compilation.dependencyTemplates.set(HardHarmonyImportSpecifierDependency, new NullDependencyTemplate);

    compilation.dependencyFactories.set(HardHarmonyCompatibilityDependency, new NullFactory());
    compilation.dependencyTemplates.set(HardHarmonyCompatibilityDependency, new NullDependencyTemplate);

    compilation.dependencyFactories.set(HardHarmonyExportImportedSpecifierDependency, new NullFactory());
    compilation.dependencyTemplates.set(HardHarmonyExportImportedSpecifierDependency, new NullDependencyTemplate);

    var needAdditionalPass;

    compilation.plugin('after-seal', function(cb) {
      needAdditionalPass = compilation.modules.reduce(function(carry, module) {
        var identifierPrefix = cachePrefix(compilation);
        if (identifierPrefix === null) {
          return carry;
        }
        var identifier = identifierPrefix + module.identifier();

        var cacheItem = moduleCache[identifier];
        if (cacheItem && (
          !lodash.isEqual(cacheItem.used, module.used) ||
          !lodash.isEqual(cacheItem.usedExports, module.usedExports)
        )) {
          // Bust this module, the keys exported or their order has changed.
          cacheItem.invalid = true;
          cacheItem.invalidReason = 'used or usedExports';
          // moduleCache[identifier] = null;

          // Bust all dependents, they likely need to use new keys for this
          // module.
          module.reasons.forEach(function(reason) {
            var identifier = identifierPrefix + reason.module.identifier();
            var reasonItem = moduleCache[identifier];
            if (reasonItem) {
              reasonItem.invalid = true;
              // moduleCache[identifier] = null;
            }
            if (reason.dependency.__NormalModuleFactoryCache) {
              reason.dependency.__NormalModuleFactoryCache = null;
              reason.module.reasons.forEach(function(reason) {
                reason.dependency.__NormalModuleFactoryCache = null;
              });
            }
          });
          return true;
        }
        return carry;
      }, false);

      // Bust webpack's NormalModule unsafeCache. Best case this is done before
      // the compilation really gets started. In the worse case it gets here and
      // we have to tell it to build again.
      needAdditionalPass = compilation.modules.reduce(function(carry, module) {
        if (
          module.isHard && module.isHard() &&
          HardModule.needRebuild(module.cacheItem, module.fileDependencies, module.contextDependencies, fileTimestamps, contextTimestamps, fileMd5s, cachedMd5s)
        ) {
          module.reasons.forEach(function(reason) {
            if (reason.dependency.__NormalModuleFactoryCache) {
              reason.dependency.__NormalModuleFactoryCache = null;
            }
          });
          return true;
        }
        return carry;
      }, needAdditionalPass);

      cb();
    });

    compilation.plugin('need-additional-pass', function() {
      if (needAdditionalPass) {
        needAdditionalPass = false;
        return true;
      }
    });

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

        var next = function() {
          var originalRequest = request;
          return fn.call(null, request, function(err, request) {
            if (err) {
              return cb(err);
            }
            if (!request.source) {
              moduleResolveCacheChange.push(cacheId);
              moduleResolveCache[cacheId] = Object.assign({}, request, {
                parser: null,
                parserOptions: request.parser[NS + '/parser-options'],
                dependencies: null,
              });
            }
            cb.apply(null, arguments);
          });
        };

        var fromCache = function() {
          var result = Object.assign({}, moduleResolveCache[cacheId]);
          result.dependencies = request.dependencies;
          result.parser = compilation.compiler.parser;
          if (!result.parser || !result.parser.parse) {
            result.parser = params.normalModuleFactory.getParser(result.parserOptions);
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
          moduleResolveCache[cacheId] &&
          !moduleResolveCache[cacheId].invalid
        ) {
          return fromCache();
        }

        next();
      };
    });

    params.normalModuleFactory.plugin('resolver', function(fn) {
      return function(request, cb) {
        fn.call(null, request, function(err, result) {
          if (err) {return cb(err);}
          // IgnorePlugin and other plugins can call this callback without an
          // error or module.
          if (!result) {return cb();}

          var p = getModuleCacheItem(compilation, result);
          if (p && p.then) {
            return p
            .then(function(cacheItem) {
              if (
                compilation.cache &&
                compilation.cache['m' + result.request] &&
                compilation.cache['m' + result.request] instanceof HardModule &&
                !compilation.cache['m' + result.request].cacheItem.invalid
              ) {
                return cb(null, compilation.cache['m' + result.request]);
              }

              var identifierPrefix = cachePrefix(compilation);
              if (identifierPrefix === null) {
                return;
              }
              var identifier = identifierPrefix + result.request;
              var module = fetch('module', identifier, {
                compilation: compilation,
              });
              // var module = new HardModule(cacheItem);
              cb(null, module);
            })
            .catch(function() {
              cb(err, result);
            });
          }
          else if (p) {
            try {
            if (
              compilation.cache &&
              compilation.cache['m' + result.request] &&
              compilation.cache['m' + result.request] instanceof HardModule &&
              !compilation.cache['m' + result.request].cacheItem.invalid
            ) {
              return cb(null, compilation.cache['m' + result.request]);
            }
            }
            catch(e) {
              return cb(e);
            }

            var identifierPrefix = cachePrefix(compilation);
            if (identifierPrefix === null) {
              return;
            }
            var identifier = identifierPrefix + result.request;
            var module = fetch('module', identifier, {
              compilation: compilation,
            });
            // var module = new HardModule(p);
            return cb(null, module);
          }
          cb(err, result);
        });
      };
    });
  });

  function preload(prefix, memoryCache) {
    Object.keys(moduleCache)
    .map(function(key) {
      if (key.indexOf(prefix) !== 0) {return;}
      var cacheItem = moduleCache[key];
      if (!cacheItem) {return;}
      if (typeof cacheItem === 'string') {
        cacheItem = JSON.parse(cacheItem);
        moduleCache[key] = cacheItem;
      }
      if (
        cacheItem &&
        cacheItem.fileDependencies &&
        !HardModule.needRebuild(cacheItem, cacheItem.fileDependencies, cacheItem.contextDependencies, fileTimestamps, contextTimestamps, fileMd5s, cachedMd5s)
      ) {
        var memCacheId = 'm' + cacheItem.identifier;
        if (!memoryCache[memCacheId]) {
          // if (Array.isArray(cacheItem.assets)) {
          //   cacheItem.assets = (cacheItem.assets || [])
          //   .reduce(function(carry, key) {
          //     carry[key] = assetCache[requestHash(key)];
          //     return carry;
          //   }, {});
          // }
          // var module = memoryCache[memCacheId] = new HardModule(cacheItem);
          var module = memoryCache[memCacheId] = fetch('module', key, {
            compilation: {
              __hardSourceFileMd5s: fileMd5s,
              __hardSourceCachedMd5s: cachedMd5s,
            },
          });
          module.build(null, {__hardSourceMethods: {thaw: thaw, mapThaw: mapThaw}}, null, null, function() {});
          return module;
        }
      }
      else if (
        cacheItem &&
        !cacheItem.fileDependencies &&
        !HardContextModule.needRebuild(cacheItem, fileTimestamps, contextTimestamps, fileMd5s, cachedMd5s)
      ) {
        var memCacheId = 'm' + cacheItem.identifier;
        if (!memoryCache[memCacheId]) {
          // var module = memoryCache[memCacheId] = new HardContextModule(cacheItem);
          var module = memoryCache[memCacheId] = fetch('module', key, {
            compilation: {
              __hardSourceFileMd5s: fileMd5s,
              __hardSourceCachedMd5s: cachedMd5s,
            },
          });
          module.build(null, {__hardSourceMethods: {thaw: thaw, mapThaw: mapThaw}}, null, null, function() {});
          return module;
        }
      }
    })
    .filter(Boolean)
    .forEach(function(module) {
      var origin = memoryCache['m' + module.cacheItem.issuer];
      module.issuer = origin;

      module.errors.forEach(function(err) {
        err.origin = origin;
      }, this);
      module.warnings.forEach(function(err) {
        err.origin = origin;
      }, this);
    });
  }

  var preloadCacheByPrefix = {};

  compiler.plugin('make', function(compilation, cb) {
    if (compilation.cache) {
      var prefix = cachePrefix(compilation);
      if (prefix !== null && !preloadCacheByPrefix[prefix]) {
        preloadCacheByPrefix[prefix] = true;

        preload(prefix, compilation.cache);
      }

      // Bust dependencies to HardModules in webpack 2's NormalModule
      // unsafeCache to avoid an additional pass that would bust them.
      Object.keys(compilation.cache).forEach(function(key) {
        var module = compilation.cache[key];
        if (module && module.isHard && module.isHard()) {
          if (HardModule.needRebuild(module.cacheItem, module.fileDependencies, module.contextDependencies, fileTimestamps, contextTimestamps, fileMd5s, cachedMd5s)) {
            module.reasons.forEach(function(reason) {
              if (reason.dependency.__NormalModuleFactoryCache) {
                reason.dependency.__NormalModuleFactoryCache = null;
              }
            });
          }
        }
      });
    }
    return cb();
  });

  var assetArchetypeCache = {
    _ops: [],

    get: function(id) {
      var hashId = requestHash(id);
      if (assetCache[hashId]) {
        if (typeof assetCache[hashId] === 'string') {
          assetCache[hashId] = JSON.parse(assetCache[hashId]);
        }
        return assetCache[hashId];
      }
    },

    set: function(id, item) {
      var hashId = requestHash(id);
      if (item) {
        assetCache[hashId] = item;
        this._ops.push({
          key: hashId,
          value: item,
        });
      }
      else {
        assetCache[hashId] = null;
        this._ops.push({
          key: hashId,
          value: null,
        });
      }
    },

    operations: function() {
      var ops = this._ops.slice();
      this._ops.length = 0;
      return ops;
    },
  };

  var moduleArchetypeCache = {
    _ops: [],

    get: function(id) {
      if (moduleCache[id] && !moduleCache[id].invalid) {
        if (typeof moduleCache[id] === 'string') {
          moduleCache[id] = JSON.parse(moduleCache[id]);
        }
        return moduleCache[id];
      }
    },

    set: function(id, item) {
      moduleCache[id] = item;
      if (item) {
        this._ops.push(id);
      }
      else if (moduleCache[id]) {
        if (typeof moduleCache[id] === 'string') {
          moduleCache[id] = JSON.parse(moduleCache[id]);
        }
        moduleCache[id].invalid = true;

        this._ops.push(id);
      }
    },

    operations: function() {
      var _this = this;
      var ops = this._ops.map(function(id) {
        return {
          key: id,
          value: _this.get(id) || null,
        };
      });
      this._ops.length = 0;
      return ops;
    },
  };

  var archetypeCaches = {
    asset: assetArchetypeCache,
    module: moduleArchetypeCache,
  };

  var freeze, thaw, mapFreeze, mapThaw, store, fetch;

  compiler.plugin(['watch-run', 'run'], function(_compiler, cb) {
    var compiler = _compiler;
    if (_compiler.compiler) {
      compiler = _compiler.compiler;
    }
    freeze = function(archetype, frozen, item, extra) {
      if (!item) {
        return item;
      }

      frozen = compiler.applyPluginsWaterfall('--hard-source-before-freeze-' + archetype, frozen, item, extra);
      frozen = compiler.applyPluginsWaterfall('--hard-source-freeze-' + archetype, frozen, item, extra);
      frozen = compiler.applyPluginsWaterfall('--hard-source-after-freeze-' + archetype, frozen, item, extra);

      return frozen;
    };
    thaw = function(archetype, item, frozen, extra) {
      if (!frozen) {
        return frozen;
      }

      item = compiler.applyPluginsWaterfall('--hard-source-before-thaw-' + archetype, item, frozen, extra);
      item = compiler.applyPluginsWaterfall('--hard-source-thaw-' + archetype, item, frozen, extra);
      item = compiler.applyPluginsWaterfall('--hard-source-after-thaw-' + archetype, item, frozen, extra);

      return item;
    };
    mapMap = function(fn, name, output, input, extra) {
      if (output) {
        return input.map(function(item, index) {
          return fn(name, output[index], item, extra);
        })
        .filter(Boolean);
      }
      else {
        return input.map(function(item) {
          return fn(name, null, item, extra);
        })
        .filter(Boolean);
      }
    };
    mapFreeze = function(name, frozen, items, extra) {
      return mapMap(freeze, name, frozen, items, extra);
    };
    mapThaw = function(name, items, frozen, extra) {
      return mapMap(thaw, name, items, frozen, extra);
    };
    store = function(archetype, id, item, extra) {
      var cache = archetypeCaches[archetype];
      if (item) {
        var frozen = cache.get(id);
        var newFrozen = freeze(archetype, frozen, item, extra);
        if (
          (frozen && newFrozen && newFrozen !== frozen) ||
          (!frozen && newFrozen)
        ) {
          cache.set(id, newFrozen);
          return newFrozen;
        }
        else if (frozen) {
          return frozen;
        }
      }
      else {
        cache.set(id, null);
      }
    };
    fetch = function(archetype, id, extra) {
      var cache = archetypeCaches[archetype];
      var frozen = cache.get(id);
      return thaw(archetype, null, frozen, extra);
    };

    var methods = {
      freeze,
      thaw,
      mapFreeze,
      mapThaw,
      store,
      fetch,
    };
    compiler.applyPlugins('--hard-source-methods', methods);
    cb();
  });

  compiler.plugin('compilation', function(compilation) {
    compilation.__hardSourceMethods = {
      freeze,
      thaw,
      mapFreeze,
      mapThaw,
      store,
      fetch,
    };
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
    harmonyDependencies: detectModule('webpack/lib/dependencies/HarmonyImportDependency'),
  };

  var HardCompilationPlugin = require('./lib/hard-compilation-plugin');
  var HardAssetPlugin = require('./lib/hard-asset-plugin');
  var HardConcatenationModulePlugin;
  if (webpackFeatures.concatenatedModule) {
    HardConcatenationModulePlugin = require('./lib/hard-concatenation-module-plugin');
  }
  var HardContextModulePlugin = require('./lib/hard-context-module-plugin');
  var HardNormalModulePlugin = require('./lib/hard-normal-module-plugin');
  var HardModuleAssetsPlugin = require('./lib/hard-module-assets-plugin');
  var HardModuleErrorsPlugin = require('./lib/hard-module-errors-plugin');
  var HardModuleExtractTextPlugin = require('./lib/hard-module-extract-text-plugin');
  var HardDependencyBlockPlugin = require('./lib/hard-dependency-block-plugin');
  var HardBasicDependencyPlugin = require('./lib/hard-basic-dependency-plugin');
  var HardHarmonyDependencyPlugin;
  if (webpackFeatures.harmonyDependencies) {
    HardHarmonyDependencyPlugin = require('./lib/hard-harmony-dependency-plugin');
  }
  var HardSourceMapPlugin = require('./lib/hard-source-map-plugin');

  new HardCompilationPlugin().apply(compiler);

  new HardAssetPlugin().apply(compiler);

  new HardContextModulePlugin().apply(compiler);
  new HardNormalModulePlugin().apply(compiler);

  if (HardConcatenationModulePlugin) {
    new HardConcatenationModulePlugin().apply(compiler);
  }

  new HardModuleAssetsPlugin().apply(compiler);
  new HardModuleErrorsPlugin().apply(compiler);
  new HardModuleExtractTextPlugin().apply(compiler);

  new HardDependencyBlockPlugin().apply(compiler);

  new HardBasicDependencyPlugin().apply(compiler);
  if (HardHarmonyDependencyPlugin) {
    new HardHarmonyDependencyPlugin().apply(compiler);
  }

  new HardSourceMapPlugin().apply(compiler);

  compiler.plugin('this-compilation', function(compilation) {
    compiler.__hardSource_topCompilation = compilation;
  });

  compiler.plugin('after-compile', function(compilation, cb) {
    if (!active) {return cb();}

    var startCacheTime = Date.now();

    // fs.writeFileSync(
    //   path.join(cacheDirPath, 'file-dependencies.json'),
    //   JSON.stringify({fileDependencies: compilation.fileDependencies}),
    //   'utf8'
    // );

    var moduleOps = [];
    var dataOps = [];
    var md5Ops = [];
    var assetOps = [];
    var moduleResolveOps = [];
    var missingOps = [];
    var resolverOps = [];

    var buildingMd5s = {};

    if (compiler.__hardSource_topCompilation === compilation) {
      // var fileDependenciesDiff = lodash.difference(compilation.fileDependencies, dataCache.fileDependencies || []);

      function buildMd5Ops(dependencies) {
        dependencies.forEach(function(file) {
          function updateMd5CacheItem(value) {
            if (
              !md5Cache[file] ||
              (
                md5Cache[file] &&
                md5Cache[file].hash !== value.hash
              )
            ) {
              md5Cache[file] = value;
              cachedMd5s[file] = value.hash;

              md5Ops.push({
                key: file,
                value: JSON.stringify(value),
              });
            }
            else if (
              !value.mtime &&
              md5Cache[file] &&
              md5Cache[file].mtime !== value.mtime
            ) {
              md5Cache[file] = value;
              cachedMd5s[file] = value.hash;
            }
          }

          const building = buildingMd5s[file];
          if (!building.then) {
            updateMd5CacheItem(building);
          }
          else {
            buildingMd5s[file] = building.then(updateMd5CacheItem);
          }
        });
      }

      if (!lodash.isEqual(compilation.fileDependencies, dataCache.fileDependencies)) {
        lodash.difference(dataCache.fileDependencies, compilation.fileDependencies).forEach(function(file) {
          buildingMd5s[file] = {
            mtime: 0,
            hash: '',
          };
        });

        dataCache.fileDependencies = compilation.fileDependencies;

        dataOps.push({
          key: 'fileDependencies',
          value: JSON.stringify(dataCache.fileDependencies),
        });
      }

      var MD5_TIME_PRECISION_BUFFER = 2000;

      dataCache.fileDependencies.forEach(function(file) {
        if (buildingMd5s[file]) {return;}

        function getValue(store, key, fn) {
          if (store[key]) {
            return store[key];
          }
          else {
            return fn(key);
          }
        }

        if (fileMd5s[file]) {
          buildingMd5s[file] = {
            // Subtract a small buffer from now for file systems that record
            // lower precision mtimes.
            mtime: Date.now() - MD5_TIME_PRECISION_BUFFER,
            hash: fileMd5s[file],
          };
        }
        else {
          buildingMd5s[file] = md5(file)
          .then(function(hash) {
            return {
              mtime: Date.now() - MD5_TIME_PRECISION_BUFFER,
              hash: hash,
            };
          });
        }
      });

      buildMd5Ops(dataCache.fileDependencies);

      if (!lodash.isEqual(compilation.contextDependencies, dataCache.contextDependencies)) {
        lodash.difference(dataCache.contextDependencies, compilation.contextDependencies).forEach(function(file) {
          buildingMd5s[file] = {
            mtime: 0,
            hash: '',
          };
        });

        dataCache.contextDependencies = compilation.contextDependencies;

        dataOps.push({
          key: 'contextDependencies',
          value: JSON.stringify(dataCache.contextDependencies),
        });
      }

      const contexts = contextStamps(dataCache.contextDependencies);
      dataCache.contextDependencies.forEach(function(file) {
        if (buildingMd5s[file]) {return;}

        var context = contexts[file];
        if (!context.then) {
          // Subtract a small buffer from now for file systems that record lower
          // precision mtimes.
          context.mtime = Date.now() - MD5_TIME_PRECISION_BUFFER;
        }
        else {
          context = context
          .then(function(context) {
            context.mtime = Date.now() - MD5_TIME_PRECISION_BUFFER;
            return context;
          });
        }
        buildingMd5s[file] = context;
      });

      buildMd5Ops(dataCache.contextDependencies);

      moduleResolveCacheChange
      .reduce(function(carry, value) {
        if (carry.indexOf(value) === -1) {
          carry.push(value);
        }
        return carry;
      }, [])
      .forEach(function(key) {
        moduleResolveOps.push({
          key: key,
          value: moduleResolveCache[key] ?
            JSON.stringify(moduleResolveCache[key]) :
            null,
        });
      });

      moduleResolveCacheChange = [];

      Object.keys(missingCache).forEach(function(group) {
        Object.keys(missingCache[group]).forEach(function(key) {
          if (!missingCache[group][key]) {return;}
          if (missingCache[group][key].new) {
            missingCache[group][key].new = false;
            missingOps.push({
              key: group + '/' + key,
              value: JSON.stringify(missingCache[group][key]),
            });
          }
          else if (missingCache[group][key].invalid) {
            missingCache[group][key] = null;
            missingOps.push({
              key: group + '/' + key,
              value: null,
            });
          }
        });
      });

      Object.keys(resolverCache).forEach(function(group) {
        Object.keys(resolverCache[group]).forEach(function(key) {
          if (!resolverCache[group][key]) {return;}
          if (resolverCache[group][key].new) {
            resolverCache[group][key].new = false;
            resolverOps.push({
              key: group + '/' + key,
              value: JSON.stringify(resolverCache[group][key]),
            });
          }
          else if (resolverCache[group][key].invalid) {
            resolverCache[group][key] = null;
            resolverOps.push({
              key: group + '/' + key,
              value: null,
            });
          }
        });
      });

      Object.keys(moduleCache).forEach(function(key) {
        var cacheItem = moduleCache[key];
        if (cacheItem && cacheItem.invalid) {
          moduleCache[key] = null;
          moduleOps.push({
            key: key,
            value: null,
          });
        }
      });
    }

    // moduleCache.fileDependencies = compilation.fileDependencies;
    // moduleOps.push({
    //   type: 'put',
    //   key: 'fileDependencies',
    //   // value: JSON.stringify(compilation.fileDependencies),
    //   value: moduleCache.fileDependencies,
    // });

    // mkdirp.sync(cacheAssetDirPath);

    function walkCompilations(compilation, fn) {
      fn(compilation);
      compilation.children.forEach(function(compilation) {
        walkCompilations(compilation, fn);
      });
    }

    var identifierPrefix = cachePrefix(compilation);
    if (identifierPrefix !== null) {
      freeze('compilation', null, compilation);
    }

    assetOps = archetypeCaches.asset.operations();
    moduleOps = archetypeCaches.module.operations();

    var writeMd5Ops = Promise.all(Object.keys(buildingMd5s).map(function(key) {
      return buildingMd5s[key];
    }));

    Promise.all([
      mkdirp(cacheDirPath)
      .then(function() {
        return Promise.all([
          fsWriteFile(path.join(cacheDirPath, 'stamp'), currentStamp, 'utf8'),
          fsWriteFile(path.join(cacheDirPath, 'version'), hardSourceVersion, 'utf8'),
        ]);
      }),
      moduleResolveCacheSerializer.write(moduleResolveOps),
      assetCacheSerializer.write(assetOps),
      moduleCacheSerializer.write(moduleOps),
      dataCacheSerializer.write(dataOps),
      writeMd5Ops.then(function() {
        return md5CacheSerializer.write(md5Ops);
      }),
      missingCacheSerializer.write(missingOps),
      resolverCacheSerializer.write(resolverOps),
    ])
    .then(function() {
      // console.log('cache out', Date.now() - startCacheTime);
      cb();
    }, cb);
  });

  // Ensure records are stored inbetween runs of memory-fs using
  // webpack-dev-middleware.
  compiler.plugin('done', function() {
    if (!active) {return;}

    fs.writeFileSync(
      path.resolve(compiler.options.context, compiler.recordsOutputPath),
      JSON.stringify(compiler.records, null, 2),
      'utf8'
    );
  });
};

module.exports = HardSourceWebpackPlugin;

HardSourceWebpackPlugin.HardSourceJsonSerializerPlugin = HardSourceJsonSerializerPlugin;
HardSourceWebpackPlugin.HardSourceAppendSerializerPlugin = HardSourceAppendSerializerPlugin;
HardSourceWebpackPlugin.HardSourceLevelDbSerializerPlugin = HardSourceLevelDbSerializerPlugin;
