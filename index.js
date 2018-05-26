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

var AMDRequireContextDependency = require('webpack/lib/dependencies/AMDRequireContextDependency');
var CommonJsRequireContextDependency = require('webpack/lib/dependencies/CommonJsRequireContextDependency');
var ContextDependency = require('webpack/lib/dependencies/ContextDependency');
var RequireContextDependency = require('webpack/lib/dependencies/RequireContextDependency');
var RequireResolveContextDependency = require('webpack/lib/dependencies/RequireResolveContextDependency');

var ImportContextDependency;

try {
  ImportContextDependency = require('webpack/lib/dependencies/ImportContextDependency');
}
catch (_) {}

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
      if (compiler.__hardSource_fileTimestamps[file]) {
        return compiler.__hardSource_fileTimestamps[file];
      }
      else {
        if (!stats[file]) {stats[file] = stat(file);}
        return stats[file]
        .then(function(stat) {
          var mtime = +stat.mtime;
          compiler.__hardSource_fileTimestamps[file] = mtime;
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

      function contextNormalModuleResolveKey(compiler, key) {
        var parsed = JSON.parse(key);
        if (Array.isArray(parsed)) {
          return JSON.stringify([parsed[0], contextNormalPath(compiler, parsed[1]), parsed[2]]);
        }
        else {
          return JSON.stringify(Object.assign({}, parsed, {
            context: contextNormalPath(compiler, parsed.context),
          }));
        }
      }

      function contextNormalModuleResolve(compiler, resolved) {
        if (typeof resolved === 'string') {
          resolved = JSON.parse(resolved);
        }
        if (resolved.type === 'context') {
          return (Object.assign({}, resolved, {
            identifier: contextNormalModuleId(compiler, resolved.identifier),
            resource: contextNormalRequest(compiler, resolved.resource),
          }));
        }
        return (Object.assign({}, resolved, {
          context: contextNormalRequest(compiler, resolved.context),
          request: contextNormalRequest(compiler, resolved.request),
          userRequest: contextNormalRequest(compiler, resolved.userRequest),
          rawRequest: contextNormalRequest(compiler, resolved.rawRequest),
          resource: contextNormalRequest(compiler, resolved.resource),
          loaders: resolved.loaders.map(function(loader) {
            return Object.assign({}, loader, {
              loader: contextNormalPath(compiler, loader.loader),
            });
          }),
        }));
      }

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
        .then(contextKeys(compiler, contextNormalModuleId))
        .then(copyWithDeser.bind(null, moduleCache)),

        dataCacheSerializer.read()
        .then(copyWithDeser.bind(null, dataCache))
        .then(function() {
          dataCache.fileDependencies = dataCache.fileDependencies
          .map(function(dep) {
            return contextNormalPath(compiler, dep);
          });
          dataCache.contextDependencies = dataCache.contextDependencies
          .map(function(dep) {
            return contextNormalPath(compiler, dep);
          });
        }),

        md5CacheSerializer.read()
        .then(contextKeys(compiler, contextNormalPath))
        .then(function(_md5Cache) {
          Object.keys(_md5Cache).forEach(function(key) {
            if (typeof _md5Cache[key] === 'string') {
              _md5Cache[key] = JSON.parse(_md5Cache[key]);
            }

            cachedMd5s[key] = _md5Cache[key].hash;
          });
          md5Cache = _md5Cache;
        }),

        moduleResolveCacheSerializer.read()
        .then(contextKeys(compiler, contextNormalModuleResolveKey))
        .then(contextValues(compiler, contextNormalModuleResolve))
        .then(copyWithDeser.bind(null, moduleResolveCache)),

        missingCacheSerializer.read()
        .then(function(_missingCache) {
          missingCache = {normal: {},loader: {}, context: {}};

          function contextNormalMissingKey(compiler, key) {
            var parsed = JSON.parse(key);
            return JSON.stringify([
              contextNormalPath(compiler, parsed[0]),
              contextNormalPath(compiler, parsed[1])
            ]);
          }

          function contextNormalMissing(compiler, missing) {
            return missing.map(function(missed) {
              return contextNormalRequest(compiler, missed);
            });
          }

          Object.keys(_missingCache).forEach(function(key) {
            var item = _missingCache[key];
            if (typeof item === 'string') {
              item = JSON.parse(item);
            }
            var splitIndex = key.indexOf('/');
            var group = key.substring(0, splitIndex);
            var keyName = contextNormalMissingKey(compiler, key.substring(splitIndex + 1));
            missingCache[group] = missingCache[group] || {};
            missingCache[group][keyName] = contextNormalMissing(compiler, item);
          });
        }),

        resolverCacheSerializer.read()
        .then(function(_resolverCache) {
          resolverCache = {normal: {},loader: {}, context: {}};

          function contextNormalResolvedKey(compiler, key) {
            var parsed = JSON.parse(key);
            return JSON.stringify([contextNormalPath(compiler, parsed[0]), parsed[1]]);
          }

          function contextNormalResolved(compiler, resolved) {
            return Object.assign({}, resolved, {
              result: contextNormalPath(compiler, resolved.result),
            });
          }

          Object.keys(_resolverCache).forEach(function(key) {
            var item = _resolverCache[key];
            if (typeof item === 'string') {
              item = JSON.parse(item);
            }
            var splitIndex = key.indexOf('/');
            var group = key.substring(0, splitIndex);
            var keyName = contextNormalResolvedKey(compiler, key.substring(splitIndex + 1));
            resolverCache[group] = resolverCache[group] || {};
            resolverCache[group][keyName] = contextNormalResolved(compiler, item);
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
        var compilerFileTs = compiler.__hardSource_fileTimestamps = {};
        var fileTs = fileTimestamps = {};

        return bulkFsTask(dataCache.fileDependencies, function(file, task) {
          if (compiler.__hardSource_fileTimestamps[file]) {
            return compiler.__hardSource_fileTimestamps[file];
          }
          else {
            compiler.inputFileSystem.stat(file, task(function(err, value) {
              if (err) {
                return 0;
              }

              var mtime = +value.mtime;
              compiler.__hardSource_fileTimestamps[file] = mtime;
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
            if (!compiler.__hardSource_fileTimestamps[file]) {
              compiler.__hardSource_fileTimestamps[file] = mtime;
            }

            // if (
            //   fileTs[file] &&
            //   md5Cache[file] &&
            //   fileTs[file] < md5Cache[file].mtime
            // ) {
            //   fileTs[file] = md5Cache[file].mtime;
            //   fileMd5s[file] = md5Cache[file].hash;
            // }
            // else {
              compiler.inputFileSystem.readFile(file, task(function(err, body) {
                if (err) {
                  fileMd5s[file] = '';
                  return;
                }

                const hash = crypto.createHash('md5')
                .update(body, 'utf8').digest('hex');

                fileMd5s[file] = hash;
              }));
            // }
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
                missingItem.invalidReason = 'resolved now missing';
              }
            }));
          }
          else {
            compiler.inputFileSystem.stat(missed, task(function(err, stat) {
              if (err) {return;}

              if (stat.isDirectory()) {
                if (group === 'context') {
                  missingItem.invalid = true;
                }
              }
              if (stat.isFile()) {
                if (group === 'loader' || group.startsWith('normal')) {
                  missingItem.invalid = true;
                  missingItem.invalidReason = 'missing now found';
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
        var normalId = 'normal';
        if (resolveItem.resolveOptions) {
          normalId = `normal-${new nodeObjectHash({sort: false}).hash(resolveItem.resolveOptions)}`;
        }
        if (resolveItem.type === 'context') {
          var contextMissing = missingCache.context[JSON.stringify([
            resolveKey.context,
            resolveItem.resource.split('?')[0]
          ])];
          if (!contextMissing || contextMissing.invalid) {
            resolveItem.invalid = true;
            resolveItem.invalidReason = 'resolved context invalid';
          }
        }
        else {
          var normalMissing = missingCache[normalId][JSON.stringify([
            resolveKey[1],
            resolveItem.resource.split('?')[0]
          ])];
          if (!normalMissing || normalMissing.invalid) {
            resolveItem.invalid = true;
            resolveItem.invalidReason = 'resolved normal invalid' + (
                normalMissing ? (' ' + normalMissing.invalidReason) : ': resolve entry not in cache'
              );
          }
          resolveItem.loaders.forEach(function(loader) {
            if (typeof loader === 'object') {
              if (loader.loader != null) {
                loader = loader.loader;
              } else {
                // Convert { "0": "b", "1": "a", "2": "r" } into "bar"
                loader = Object.assign([], loader).join('');
              }
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
              resolveItem.invalidReason = 'resolved loader invalid';
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
        resolveCacheChange: moduleResolveCacheChange,
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
    });
  });

  function bindResolvers() {
    function configureMissing(key, resolver) {
      // missingCache[key] = missingCache[key] || {};
      // resolverCache[key] = resolverCache[key] || {};

      var _resolve = resolver.resolve;
      resolver.resolve = function(info, context, request, cb, cb2) {
        var numArgs = 4;
        if (!cb) {
          numArgs = 3;
          cb = request;
          request = context;
          context = info;
        }
        var resolveContext;
        if (cb2) {
          numArgs = 5;
          resolveContext = cb;
          cb = cb2;
        }

        if (info && info.resolveOptions) {
          key = `normal-${new nodeObjectHash({sort: false}).hash(info.resolveOptions)}`;
          resolverCache[key] = resolverCache[key] || {};
          missingCache[key] = missingCache[key] || {};
        }

        var resolveId = JSON.stringify([context, request]);
        var absResolveId = JSON.stringify([context, relateContext.relateAbsolutePath(context, request)]);
        var resolve = resolverCache[key][resolveId] || resolverCache[key][absResolveId];
        if (resolve && !resolve.invalid) {
          var missingId = JSON.stringify([context, resolve.result]);
          var missing = missingCache[key][missingId];
          if (missing && !missing.invalid) {
            return cb(null, [resolve.result].concat(request.split('?').slice(1)).join('?'));
          }
          else {
            resolve.invalid = true;
            resolve.invalidReason = 'out of date';
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
        var _missing = cb.missing || resolveContext && resolveContext.missing;
        if (_missing) {
          callback.missing = {
            push: function(path) {
              localMissing.push(path);
              _missing.push(path);
            },
            add: function(path) {
              localMissing.push(path);
              _missing.add(path);
            },
          };
          if (resolveContext) {
            resolveContext.missing = callback.missing;
          }
        }
        else {
          callback.missing = Object.assign(localMissing, {
            add: function(path) {
              localMissing.push(path);
            },
          });
          if (resolveContext) {
            resolveContext.missing = callback.missing;
          }
        }

        if (numArgs === 3) {
          _resolve.call(this, context, request, callback);
        }
        else if (numArgs === 5) {
          _resolve.call(this, info, context, request, resolveContext, callback);
        }
        else {
          _resolve.call(this, info, context, request, callback);
        }
      };
    }

    if (compiler.resolverFactory) {
      compiler.resolverFactory.hooks.resolver.for('normal').tap('HardSource resolve cache', function(resolver, options) {
        const normalCacheId = `normal-${new nodeObjectHash({sort: false}).hash(Object.assign({}, options, {fileSystem: null}))}`;
        resolverCache[normalCacheId] = resolverCache[normalCacheId] || {};
        missingCache[normalCacheId] = missingCache[normalCacheId] || {};
        configureMissing(normalCacheId, resolver);
        return resolver;
      });
      compiler.resolverFactory.hooks.resolver.for('loader').tap('HardSource resolve cache', function(resolver) {
        configureMissing('loader', resolver);
        return resolver;
      });
      compiler.resolverFactory.hooks.resolver.for('context').tap('HardSource resolve cache', function(resolver) {
        configureMissing('context', resolver);
        return resolver;
      });
    }
    else {
      configureMissing('normal', compiler.resolvers.normal);
      configureMissing('loader', compiler.resolvers.loader);
      configureMissing('context', compiler.resolvers.context);
    }
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

    // compilation.fileTimestamps = fileTimestamps;
    // compilation.contextTimestamps = contextTimestamps;

    compilation.__hardSourceFileMd5s = fileMd5s;
    compilation.__hardSourceCachedMd5s = cachedMd5s;

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
              moduleResolveCacheChange.push(cacheId);
              moduleResolveCache[cacheId] = Object.assign({}, request, {
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
          var result = Object.assign({}, moduleResolveCache[cacheId] || moduleResolveCache[absCacheId]);
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
          moduleResolveCache[cacheId] &&
          !moduleResolveCache[cacheId].invalid ||
          moduleResolveCache[absCacheId] &&
          !moduleResolveCache[absCacheId].invalid
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

  function preload(prefix, compilation, params) {
    const memoryCache = compilation.cache;
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
        (
          cacheItem.fileDependencies ||
          cacheItem.buildInfo && cacheItem.buildInfo.fileDependencies ||
          cacheItem.build && cacheItem.build.buildInfo && cacheItem.build.buildInfo.fileDependencies
        ) &&
        !HardModule.needRebuild(
          cacheItem,
          (cacheItem.buildInfo ? contextNormalPathSet : contextNormalPathArray)(compiler, cacheItem.build.buildInfo ? cacheItem.build.buildInfo.fileDependencies : cacheItem.fileDependencies),
          (cacheItem.buildInfo ? contextNormalPathSet : contextNormalPathArray)(compiler, cacheItem.build.buildInfo ? cacheItem.build.buildInfo.contextDependencies : cacheItem.contextDependencies),
          fileTimestamps,
          contextTimestamps,
          fileMd5s,
          cachedMd5s
        )
      ) {
        var memCacheId = 'm' + relateContext.contextNormalRequest(compiler, cacheItem.identifier);
        if (!memoryCache[memCacheId]) {
          // if (Array.isArray(cacheItem.assets)) {
          //   cacheItem.assets = (cacheItem.assets || [])
          //   .reduce(function(carry, key) {
          //     carry[key] = assetCache[requestHash(key)];
          //     return carry;
          //   }, {});
          // }
          // var module = memoryCache[memCacheId] = new HardModule(cacheItem);
          try {
            var module = memoryCache[memCacheId] = fetch('Module', key, {
              compilation,
              normalModuleFactory: params.normalModuleFactory,
              contextModuleFactory: params.contextModuleFactory,
            });
            // module.build(null, {
            //   compiler: compiler,
            //   __hardSourceMethods: {thaw: thaw, mapThaw: mapThaw}
            // }, null, null, function() {});
          }
          catch (e) {
            console.error(e);
          }
          return module;
        }
      }
      else if (
        cacheItem &&
        !(
          cacheItem.fileDependencies ||
          cacheItem.buildInfo && cacheItem.buildInfo.fileDependencies ||
          cacheItem.build && cacheItem.build.buildInfo && cacheItem.build.buildInfo.fileDependencies
        ) &&
        !HardContextModule.needRebuild(
          cacheItem,
          contextNormalPath(compiler, cacheItem.context),
          fileTimestamps,
          contextTimestamps,
          fileMd5s,
          cachedMd5s
        )
      ) {
        var memCacheId = 'm' + relateContext.contextNormalRequest(compiler, cacheItem.identifier);
        if (!memoryCache[memCacheId]) {
          // var module = memoryCache[memCacheId] = new HardContextModule(cacheItem);
          var module = memoryCache[memCacheId] = fetch('Module', key, {
            compilation: {
              compiler: compiler,
              __hardSourceMethods: {thaw: thaw, mapThaw: mapThaw},
              __hardSourceFileMd5s: fileMd5s,
              __hardSourceCachedMd5s: cachedMd5s,
            },
          });
          module.build(null, {
            compiler: compiler,
            __hardSourceMethods: {thaw: thaw, mapThaw: mapThaw},
          }, null, null, function() {});
          return module;
        }
      }
    })
    .filter(Boolean)
    .forEach(function(module) {
      // console.log(typeof module.issuer)
      // console.log(module.issuer);
      if (typeof module.issuer === 'string') {
        var issuer = module.issuer;
        var origin = memoryCache['m' + issuer];
        module.issuer = origin;

        module.errors.forEach(function(err) {
          err.origin = origin;
        }, this);
        module.warnings.forEach(function(err) {
          err.origin = origin;
        }, this);
      }

      module.errors.forEach(function(err) {
        err.origin = origin;
      }, this);
      module.warnings.forEach(function(err) {
        err.origin = origin;
      }, this);
    });
  }

  var preloadCacheByPrefix = {};

  var compilationParamsMap = new WeakMap();

  let second = false;
  compiler.plugin('compilation', (compilation, params) => {
    compilationParamsMap.set(compilation, params);
  });
  compiler.plugin('make', function(compilation, cb) {
    if (compilation.cache) {
      var prefix = cachePrefix(compilation);
      if (prefix !== null && !preloadCacheByPrefix[prefix]) {
        preloadCacheByPrefix[prefix] = true;

        // preload(prefix, compilation, compilationParamsMap.get(compilation));
      }

      // Bust dependencies to HardModules in webpack 2's NormalModule
      // unsafeCache to avoid an additional pass that would bust them.
      Object.keys(compilation.cache).forEach(function(key) {
        var module = compilation.cache[key];
        if (module && module.cacheItem) {
          if (HardModule.needRebuild(
            module.cacheItem,
            module.fileDependencies,
            module.contextDependencies,
            fileTimestamps,
            contextTimestamps,
            fileMd5s,
            cachedMd5s
          )) {
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
      var hashId = requestHash(relateNormalRequest(compiler, id));
      if (assetCache[hashId]) {
        if (typeof assetCache[hashId] === 'string') {
          assetCache[hashId] = JSON.parse(assetCache[hashId]);
        }
        return assetCache[hashId];
      }
    },

    set: function(id, item) {
      var hashId = requestHash(relateNormalRequest(compiler, id));
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
        moduleCache[id].invalidReason = 'overwritten';

        this._ops.push(id);
      }
    },

    operations: function() {
      var _this = this;
      var ops = this._ops.map(function(id) {
        return {
          key: relateNormalModuleId(compiler, id),
          value: _this.get(id) || null,
        };
      });
      this._ops.length = 0;
      return ops;
    },
  };

  var archetypeCaches = {
    asset: assetArchetypeCache,
    Asset: assetArchetypeCache,
    module: moduleArchetypeCache,
    Module: moduleArchetypeCache,
  };

  var freeze, thaw, mapFreeze, mapThaw, store, fetch;

  pluginCompat.register(compiler, '_hardSourceMethods', 'sync', ['methods']);

  [
    'Asset',
    'Compilation',
    'Dependency',
    'DependencyBlock',
    'DependencyVariable',
    'Module',
    'ModuleAssets',
    'ModuleError',
    'ModuleWarning',
    'Source',
  ].forEach(function(archetype) {
    pluginCompat.register(compiler, '_hardSourceBeforeFreeze' + archetype, 'syncWaterfall', ['frozen', 'item', 'extra']);
    pluginCompat.register(compiler, '_hardSourceFreeze' + archetype, 'syncWaterfall', ['frozen', 'item', 'extra']);
    pluginCompat.register(compiler, '_hardSourceAfterFreeze' + archetype, 'syncWaterfall', ['frozen', 'item', 'extra']);

    pluginCompat.register(compiler, '_hardSourceBeforeThaw' + archetype, 'syncWaterfall', ['item', 'frozen', 'extra']);
    pluginCompat.register(compiler, '_hardSourceThaw' + archetype, 'syncWaterfall', ['item', 'frozen', 'extra']);
    pluginCompat.register(compiler, '_hardSourceAfterThaw' + archetype, 'syncWaterfall', ['item', 'frozen', 'extra']);
  });

  compiler.plugin(['watch-run', 'run'], function(_compiler, cb) {
    var compiler = _compiler;
    if (_compiler.compiler) {
      compiler = _compiler.compiler;
    }
    freeze = function(archetype, frozen, item, extra) {
      if (!item) {
        return item;
      }

      frozen = pluginCompat.call(compiler, '_hardSourceBeforeFreeze' + archetype, [frozen, item, extra]);
      frozen = pluginCompat.call(compiler, '_hardSourceFreeze' + archetype, [frozen, item, extra]);
      frozen = pluginCompat.call(compiler, '_hardSourceAfterFreeze' + archetype, [frozen, item, extra]);

      return frozen;
    };
    thaw = function(archetype, item, frozen, extra) {
      if (!frozen) {
        return frozen;
      }

      item = pluginCompat.call(compiler, '_hardSourceBeforeThaw' + archetype, [item, frozen, extra]);
      item = pluginCompat.call(compiler, '_hardSourceThaw' + archetype, [item, frozen, extra]);
      item = pluginCompat.call(compiler, '_hardSourceAfterThaw' + archetype, [item, frozen, extra]);

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
    pluginCompat.call(compiler, '_hardSourceMethods', [methods]);
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
    generator: detectModule('webpack/lib/JavascriptGenerator'),
  };

  var schemasVersion = 2;
  if (webpackFeatures.concatenatedModule) {
    schemasVersion = 3;
  }
  if (webpackFeatures.generator) {
    schemasVersion = 4;
  }

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

  new HardCompilationPlugin().apply(compiler);

  new HardAssetPlugin().apply(compiler);

  new HardContextModulePlugin({
    schema: schemasVersion,
  }).apply(compiler);
  new HardNormalModulePlugin({
    schema: schemasVersion,
  }).apply(compiler);

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
                key: relateNormalPath(compiler, file),
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

      var fileDependencies = Array.from(compilation.fileDependencies)
      .map(file => contextNormalPath(compiler, file));

      if (!lodash.isEqual(fileDependencies, dataCache.fileDependencies)) {
        lodash.difference(dataCache.fileDependencies, fileDependencies).forEach(function(file) {
          buildingMd5s[file] = {
            mtime: 0,
            hash: '',
          };
        });

        dataCache.fileDependencies = fileDependencies;

        dataOps.push({
          key: 'fileDependencies',
          value: JSON.stringify(
            dataCache.fileDependencies
            .map(function(dep) {
              return relateNormalPath(compiler, dep);
            })
          ),
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

      var contextDependencies = Array.from(compilation.contextDependencies)
      .map(file => contextNormalPath(compiler, file));

      if (!lodash.isEqual(contextDependencies, dataCache.contextDependencies)) {
        lodash.difference(dataCache.contextDependencies, contextDependencies).forEach(function(file) {
          buildingMd5s[file] = {
            mtime: 0,
            hash: '',
          };
        });

        dataCache.contextDependencies = contextDependencies;

        dataOps.push({
          key: 'contextDependencies',
          value: JSON.stringify(
            dataCache.contextDependencies
            .map(function(dep) {
              return relateNormalPath(compiler, dep);
            })
          ),
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

      function relateNormalModuleResolveKey(compiler, key) {
        var parsed = JSON.parse(key);
        if (Array.isArray(parsed)) {
          return JSON.stringify([parsed[0], relateNormalPath(compiler, parsed[1]), relateContext.relateAbsoluteRequest(parsed[1], parsed[2])]);
        }
        else {
          if (!parsed.request) {
            return JSON.stringify(Object.assign({}, parsed, {
              context: relateNormalPath(compiler, parsed.context),
              userRequest: relateContext.relateAbsoluteRequest(parsed.context, parsed.userRequest),
              options: Object.assign({}, parsed.options, {
                request: relateContext.relateAbsoluteRequest(parsed.context, parsed.options.request),
              }),
            }));
          }
          else {
            return JSON.stringify(Object.assign({}, parsed, {
              context: relateNormalPath(compiler, parsed.context),
              request: relateContext.relateAbsoluteRequest(parsed.context, parsed.request),
            }));
          }
        }
      }

      function relateNormalModuleResolve(compiler, resolved) {
        if (resolved.type === 'context') {
          return (Object.assign({}, resolved, {
            identifier: relateNormalModuleId(compiler, resolved.identifier),
            resource: relateNormalRequest(compiler, resolved.resource),
          }));
        }
        return (Object.assign({}, resolved, {
          context: relateNormalRequest(compiler, resolved.context),
          request: relateNormalRequest(compiler, resolved.request),
          userRequest: relateNormalRequest(compiler, resolved.userRequest),
          rawRequest: relateNormalRequest(compiler, resolved.rawRequest),
          resource: relateNormalRequest(compiler, resolved.resource),
          loaders: resolved.loaders.map(function(loader) {
            return Object.assign({}, loader, {
              loader: relateNormalPath(compiler, loader.loader),
            });
          }),
        }));
      }

      moduleResolveCacheChange
      .reduce(function(carry, value) {
        if (carry.indexOf(value) === -1) {
          carry.push(value);
        }
        return carry;
      }, [])
      .forEach(function(key) {
        // console.log(key, moduleResolveCache[key]);
        // moduleResolveCache[key] && console.log(relateNormalModuleResolveKey(compiler, key));
        // moduleResolveCache[key] && console.log(relateNormalModuleResolve(compiler, moduleResolveCache[key]));
        moduleResolveOps.push({
          key: relateNormalModuleResolveKey(compiler, key),
          value: moduleResolveCache[key] ?
            JSON.stringify(relateNormalModuleResolve(compiler, moduleResolveCache[key])) :
            null,
        });
      });

      moduleResolveCacheChange = [];

      function relateNormalMissingKey(compiler, key) {
        var parsed = JSON.parse(key);
        return JSON.stringify([
          relateNormalPath(compiler, parsed[0]),
          relateNormalPath(compiler, parsed[1])
        ]);
      }

      function relateNormalMissing(compiler, missing) {
        return missing.map(function(missed) {
          return relateNormalRequest(compiler, missed);
        });
      }

      Object.keys(missingCache).forEach(function(group) {
        Object.keys(missingCache[group]).forEach(function(key) {
          if (!missingCache[group][key]) {return;}
          if (missingCache[group][key].new) {
            missingCache[group][key].new = false;
            missingOps.push({
              key: group + '/' + relateNormalMissingKey(compiler, key),
              value: JSON.stringify(relateNormalMissing(compiler, missingCache[group][key])),
            });
          }
          else if (missingCache[group][key].invalid) {
            missingCache[group][key] = null;
            missingOps.push({
              key: group + '/' + relateNormalMissingKey(compiler, key),
              value: null,
            });
          }
        });
      });

      function relateNormalResolvedKey(compiler, key) {
        var parsed = JSON.parse(key);
        return JSON.stringify([
          relateNormalPath(compiler, parsed[0]),
          relateContext.relateAbsolutePath(parsed[0], parsed[1]),
        ]);
      }

      function relateNormalResolved(compiler, resolved) {
        return Object.assign({}, resolved, {
          result: relateNormalPath(compiler, resolved.result),
        });
      }

      Object.keys(resolverCache).forEach(function(group) {
        Object.keys(resolverCache[group]).forEach(function(key) {
          if (!resolverCache[group][key]) {return;}
          if (resolverCache[group][key].new) {
            resolverCache[group][key].new = false;
            resolverOps.push({
              key: group + '/' + relateNormalResolvedKey(compiler, key),
              value: JSON.stringify(relateNormalResolved(compiler, resolverCache[group][key])),
            });
          }
          else if (resolverCache[group][key].invalid) {
            resolverCache[group][key] = null;
            resolverOps.push({
              key: group + '/' + relateNormalResolvedKey(compiler, key),
              value: null,
            });
          }
        });
      });

      Object.keys(moduleCache).forEach(function(key) {
        var cacheItem = moduleCache[key];
        if (cacheItem && cacheItem.invalid) {
          // console.log('invalid', cacheItem.invalidReason);
          moduleCache[key] = null;
          moduleOps.push({
            key: key,
            value: null,
          });
        }
      });
    }

    // moduleCache.fileDependencies = fileDependencies;
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
      freeze('Compilation', null, compilation, {
        compilation: compilation,
      });
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
};

module.exports = HardSourceWebpackPlugin;

HardSourceWebpackPlugin.HardSourceJsonSerializerPlugin = HardSourceJsonSerializerPlugin;
HardSourceWebpackPlugin.HardSourceAppendSerializerPlugin = HardSourceAppendSerializerPlugin;
HardSourceWebpackPlugin.HardSourceLevelDbSerializerPlugin = HardSourceLevelDbSerializerPlugin;
