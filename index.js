var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var level = require('level');
var lodash = require('lodash');
var mkdirp = require('mkdirp');

var Promise = require('bluebird');

var envHash = require('./lib/env-hash');
// try {
//   envHash = require('env-hash');
//   envHash = envHash.default || envHash;
// }
// catch (_) {
//   envHash = function() {
//     return Promise.resolve('');
//   };
// }

var AMDDefineDependency = require('webpack/lib/dependencies/AMDDefineDependency');
var AMDRequireContextDependency = require('webpack/lib/dependencies/AMDRequireContextDependency');
var AsyncDependenciesBlock = require('webpack/lib/AsyncDependenciesBlock');
var CommonJsRequireContextDependency = require('webpack/lib/dependencies/CommonJsRequireContextDependency');
var ConstDependency = require('webpack/lib/dependencies/ConstDependency');
var ContextDependency = require('webpack/lib/dependencies/ContextDependency');
var RequireContextDependency = require('webpack/lib/dependencies/RequireContextDependency');
var RequireResolveContextDependency = require('webpack/lib/dependencies/RequireResolveContextDependency');
var SingleEntryDependency = require('webpack/lib/dependencies/SingleEntryDependency');

var ContextModule = require('webpack/lib/ContextModule');
var NormalModule = require('webpack/lib/NormalModule');
var NullDependencyTemplate = require('webpack/lib/dependencies/NullDependencyTemplate');
var NullFactory = require('webpack/lib/NullFactory');

var HarmonyImportDependency, HarmonyImportSpecifierDependency, HarmonyExportImportedSpecifierDependency, SystemImportContextDependency;

try {
  HarmonyImportDependency = require('webpack/lib/dependencies/HarmonyImportDependency');
  HarmonyImportSpecifierDependency = require('webpack/lib/dependencies/HarmonyImportSpecifierDependency');
  HarmonyExportImportedSpecifierDependency = require('webpack/lib/dependencies/HarmonyExportImportedSpecifierDependency');
  SystemImportContextDependency = require('webpack/lib/dependencies/SystemImportContextDependency');
}
catch (_) {}

var HardModuleDependency = require('./lib/dependencies').HardModuleDependency;
var HardContextDependency = require('./lib/dependencies').HardContextDependency;
var HardNullDependency = require('./lib/dependencies').HardNullDependency;
var HardHarmonyExportDependency = require('./lib/dependencies').HardHarmonyExportDependency;
var HardHarmonyImportDependency =
require('./lib/dependencies').HardHarmonyImportDependency;
var HardHarmonyImportSpecifierDependency =
require('./lib/dependencies').HardHarmonyImportSpecifierDependency;
var HardHarmonyExportImportedSpecifierDependency = require('./lib/dependencies').HardHarmonyExportImportedSpecifierDependency;

var FileSerializer = require('./lib/cache-serializers').FileSerializer;
var LevelDbSerializer = require('./lib/cache-serializers').LevelDbSerializer;

var HardContextModule = require('./lib/hard-context-module');
var HardContextModuleFactory = require('./lib/hard-context-module-factory');
var HardModule = require('./lib/hard-module');

var makeDevtoolOptions = require('./lib/devtool-options');
var cachePrefix = require('./lib/util').cachePrefix;
var deserializeDependencies = require('./lib/deserialize-dependencies');

var hardSourceVersion = require('./package.json').version;

function requestHash(request) {
  return crypto.createHash('sha1').update(request).digest().hexSlice();
}

var fsReadFile = Promise.promisify(fs.readFile, {context: fs});
var fsWriteFile = Promise.promisify(fs.writeFile, {context: fs});

var NS, extractTextNS;

NS = fs.realpathSync(__dirname);

try {
  extractTextNS = path.dirname(require.resolve('extract-text-webpack-plugin'));
}
catch (_) {}

function flattenPrototype(obj) {
  if (typeof obj === 'string') {
    return obj;
  }
  var copy = {};
  for (var key in obj) {
    copy[key] = obj[key];
  }
  return copy;
}

function serializeDependencies(deps) {
  return deps
  .map(function(dep) {
    if (typeof HarmonyImportDependency !== 'undefined') {
      if (dep instanceof HarmonyImportDependency) {
        return {
          moduleIdentifier: dep.module && dep.module.identifier(),
          harmonyImport: true,
          request: dep.request,
        };
      }
      if (dep instanceof HarmonyExportImportedSpecifierDependency) {
        return {
          harmonyRequest: dep.importDependency.request,
          harmonyExportImportedSpecifier: true,
          harmonyId: dep.id,
          harmonyName: dep.name,
        };
      }
      if (dep instanceof HarmonyImportSpecifierDependency) {
        return {
          harmonyRequest: dep.importDependency.request,
          harmonyImportSpecifier: true,
          harmonyId: dep.id,
          harmonyName: dep.name,
          loc: flattenPrototype(dep.loc),
        };
      }
    }
    if (dep.originModule) {
      return {
        harmonyExport: true,
        harmonyId: dep.id,
        harmonyName: dep.describeHarmonyExport().exportedName,
        harmonyPrecedence: dep.describeHarmonyExport().precedence,
      };
    }
    return {
      moduleIdentifier: dep.module && dep.module.identifier(),
      contextDependency: dep instanceof ContextDependency,
      contextCritical: dep.critical,
      constDependency: (
        dep instanceof ConstDependency ||
        dep instanceof AMDDefineDependency
      ),
      request: dep.request,
      recursive: dep.recursive,
      regExp: dep.regExp ? dep.regExp.source : null,
      async: dep.async,
      loc: flattenPrototype(dep.loc),
    };
  })
  .filter(function(req) {
    return req.request || req.constDependency || req.harmonyExport || req.harmonyImportSpecifier || req.harmonyExportImportedSpecifier;
  });
}
function serializeVariables(vars) {
  return vars.map(function(variable) {
    return {
      name: variable.name,
      expression: variable.expression,
      dependencies: serializeDependencies(variable.dependencies),
    }
  });
}
function serializeBlocks(blocks) {
  return blocks.map(function(block) {
    return {
      async: block instanceof AsyncDependenciesBlock,
      name: block.chunkName,
      dependencies: serializeDependencies(block.dependencies),
      variables: serializeVariables(block.variables),
      blocks: serializeBlocks(block.blocks),
    };
  });
}
function serializeHashContent(module) {
  var content = [];
  module.updateHash({
    update: function(str) {
      content.push(str);
    },
  });
  return content.join('');
}

// function AssetCache() {
//
// }
//
// function ModuleCache() {
//   this.cache = {};
//   this.serializer = null;
// }
//
// ModuleCache.prototype.get = function(identifier) {
//
// };
//
// ModuleCache.prototype.save = function(modules) {
//
// };

function HardSourceWebpackPlugin(options) {
  this.options = options;
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

module.exports = HardSourceWebpackPlugin;
HardSourceWebpackPlugin.prototype.apply = function(compiler) {
  var options = this.options;
  var active = true;
  if (!options.cacheDirectory) {
    console.error('HardSourceWebpackPlugin requires a cacheDirectory setting.');
    active = false;
    return;
  }

  this.compilerOutputOptions = compiler.options.output;
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
    console.error('HardSourceWebpackPlugin cannot use [confighash] in cacheDirectory without configHash option being set and returning a non-falsy value.');
    active = false;
    return;
  }

  var environmentHasher = null;
  if (typeof options.environmentPaths !== 'undefined') {
    // TODO 0.3.0 Add deprecation message.
    if (options.environmentPaths === false) {
      environmentHasher = function() {
        return Promise.resolve('');
      };
    }
    else if (typeof options.environmentPaths === 'string') {
      environmentHasher = function() {
        return Promise.resolve(options.environmentPaths);
      };
    }
    else {
      environmentHasher = function() {
        return envHash(options.environmentPaths);
      };
    }
  }
  if (typeof options.environmentHash !== 'undefined') {
    if (environmentHasher) {
      console.error('HardSourceWebpackPlugin: environmentHash is a new option replacing environmentPaths. Please use only environmentHash.');
    }
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
      console.error('HardSourceWebpackPlugin will not set recordsInputPath when it is already set. Using current value:', compiler.options.recordsInputPath || compiler.options.recordsPath);
    }
    else {
      compiler.options.recordsInputPath =
        this.getPath(options.recordsInputPath || options.recordsPath);
    }
  }
  if (options.recordsOutputPath || options.recordsPath) {
    if (compiler.options.recordsOutputPath || compiler.options.recordsPath) {
      console.error('HardSourceWebpackPlugin will not set recordsOutputPath when it is already set. Using current value:', compiler.options.recordsOutputPath || compiler.options.recordsPath);
    }
    else {
      compiler.options.recordsOutputPath =
        this.getPath(options.recordsOutputPath || options.recordsPath);
    }
  }

  var cacheDirPath = this.getCachePath();
  var cacheAssetDirPath = path.join(cacheDirPath, 'assets');
  var resolveCachePath = path.join(cacheDirPath, 'resolve.json');

  var resolveCache = {};
  var moduleCache = {};
  var assetCache = {};
  var dataCache = {};
  var md5Cache = {};
  var missingCache = {normal: {},loader: {},context: {}};
  var resolverCache = {normal: {},loader: {},context: {}};
  var currentStamp = '';

  var fileMd5s = {};
  var cachedMd5s = {};
  var fileTimestamps = {};
  var contextMd5s = {};
  var contextTimestamps = {};

  var assetCacheSerializer = this.assetCacheSerializer =
    new FileSerializer({cacheDirPath: path.join(cacheDirPath, 'assets')});
  var moduleCacheSerializer = this.moduleCacheSerializer =
    new LevelDbSerializer({cacheDirPath: path.join(cacheDirPath, 'modules')});
  var dataCacheSerializer = this.dataCacheSerializer =
    new LevelDbSerializer({cacheDirPath: path.join(cacheDirPath, 'data')});
  var md5CacheSerializer = this.md5CacheSerializer =
    new LevelDbSerializer({cacheDirPath: path.join(cacheDirPath, 'md5')});
  var missingCacheSerializer = this.missingCacheSerializer =
    new LevelDbSerializer({cacheDirPath: path.join(cacheDirPath, 'missing')});
  var resolverCacheSerializer = this.missingCacheSerializer =
    new LevelDbSerializer({cacheDirPath: path.join(cacheDirPath, 'resolver')});
  var _this = this;

  var stat, readdir, mtime, md5, contextStamps;

  compiler.plugin('after-plugins', function() {
    if (
      !compiler.recordsInputPath || !compiler.recordsOutputPath
    ) {
      console.error('HardSourceWebpackPlugin requires recordsPath to be set.');
      active = false;
    }
  });

  compiler.plugin('after-environment', function() {
    stat = Promise.promisify(
      compiler.inputFileSystem.stat,
      {context: compiler.inputFileSystem}
    );

    readdir = Promise.promisify(
      compiler.inputFileSystem.readdir,
      {context: compiler.inputFileSystem}
    );

    mtime = function(file) {
      return stat(file)
      .then(function(stat) {return +stat.mtime;})
      .catch(function() {return 0;});
    };

    md5 = function(file) {
      return Promise.resolve({
        then: function(resolve, reject) {
          compiler.inputFileSystem.readFile(file, function(err, contents) {
            if (err) { return reject(err); }
            return resolve(crypto.createHash('md5').update(contents, 'utf8').digest('hex'));
          });
        }
      })
      .catch(function() {return '';});
    };

    contextStamps = function(contextDependencies, fileDependencies, stats) {
      stats = stats || {};
      var contexts = {};
      contextDependencies.forEach(function(context) {
        contexts[context] = {files: [], mtime: 0, hash: ''};
      });

      fileDependencies.forEach(function(file) {
        contextDependencies.forEach(function(context) {
          if (file.substring(0, context.length + 1) === context + path.sep) {
            contexts[context].files.push(file.substring(context.length + 1));
          }
        });
      });

      return Promise.all(contextDependencies.map(function(contextPath) {
        var context = contexts[contextPath];
        var selfTime = 0;
        var selfHash = crypto.createHash('md5');
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
        return walk(contextPath)
        .then(function(items) {
          items.sort();
          items.forEach(function(item) {
            selfHash.update(item);
          });
          context.mtime = selfTime;
          context.hash = selfHash.digest('hex');
        });
      }))
      .then(function() {
        return contexts;
      });
    };
  });

  compiler.plugin(['watch-run', 'run'], function(compiler, cb) {
    if (!active) {return cb();}

    try {
      fs.statSync(cacheAssetDirPath);
    }
    catch (_) {
      mkdirp.sync(cacheAssetDirPath);
      if (configHashInDirectory) {
        console.log('HardSourceWebpackPlugin is writing to a new confighash path for the first time:', cacheDirPath);
      }
    }
    var start = Date.now();

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
          console.error('Environment has changed (node_modules or configuration was updated).\nHardSourceWebpackPlugin will reset the cache and store a fresh one.');
        }
        else if (versionStamp && hardSourceVersion !== versionStamp) {
          console.error('Installed HardSource version does not match the saved cache.\nHardSourceWebpackPlugin will reset the cache and store a fresh one.');
        }

        // Reset the cache, we can't use it do to an environment change.
        resolveCache = {};
        moduleCache = {};
        assetCache = {};
        dataCache = {};
        md5Cache = {};
        missingCache = {normal: {},loader: {},context: {}};
        resolverCache = {normal: {},loader: {},context: {}};
        fileTimestamps = {};
        contextTimestamps = {};
        return;
      }

      if (Object.keys(moduleCache).length) {return Promise.resolve();}

      return Promise.all([
        fsReadFile(resolveCachePath, 'utf8')
        .then(JSON.parse)
        .then(function(_resolveCache) {resolveCache = _resolveCache}),

        assetCacheSerializer.read()
        .then(function(_assetCache) {assetCache = _assetCache;}),

        moduleCacheSerializer.read()
        .then(function(_moduleCache) {moduleCache = _moduleCache;}),

        dataCacheSerializer.read()
        .then(function(_dataCache) {dataCache = _dataCache;})
        .then(function() {
          Object.keys(dataCache).forEach(function(key) {
            if (typeof dataCache[key] === 'string') {
              dataCache[key] = JSON.parse(dataCache[key]);
            }
          });
        }),

        md5CacheSerializer.read()
        .then(function(_md5Cache) {md5Cache = _md5Cache;})
        .then(function() {
          Object.keys(md5Cache).forEach(function(key) {
            if (typeof md5Cache[key] === 'string') {
              md5Cache[key] = JSON.parse(md5Cache[key]);
              // md5Cache[key].mtime = md5Cache[key].mtime;
            }

            cachedMd5s[key] = md5Cache[key].hash;
          });
        }),

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

  compiler.plugin(['watch-run', 'run'], function(compiler, cb) {
    if (!active) {return cb();}

    if(!dataCache.fileDependencies) return cb();
    // var fs = compiler.inputFileSystem;
    var fileTs = compiler.fileTimestamps = fileTimestamps = {};

    function setKey(store, key, _default) {
      return function(value) {
        store[key] = value || _default;
      };
    }

    function setKeyError(store, key, _default) {
      return function(err) {
        store[key] = _default;

        if (err.code === "ENOENT") {return;}
        throw err;
      };
    }

    var stats = {};
    return Promise.all([
      Promise.all(dataCache.fileDependencies.map(function(file) {
        if (!stats[file]) {stats[file] = stat(file);}
        return stats[file]
        .then(function(stat) {return +stat.mtime;})
        .then(setKey(fileTs, file, 0), setKeyError(fileTs, file, 0))
        .then(function() {
          var setter = setKey(fileMd5s, file, '');
          if (
            md5Cache[file] && fileTs[file] >= md5Cache[file].mtime ||
            !md5Cache[file] ||
            !fileTs[file]
          ) {
            return md5(file)
            .then(setter, setKeyError(fileMd5s, file, ''));
          }
          else {
            setter(md5Cache[file].hash);
          }
        });
      })),
      new Promise(function(resolve, reject) {
        var contextTs = compiler.contextTimestamps = contextTimestamps = {};
        return contextStamps(dataCache.contextDependencies, dataCache.fileDependencies, stats)
        .then(function(contexts) {
          for (var contextPath in contexts) {
            var context = contexts[contextPath];

            // fileTimestamps[contextPath] = context.mtime;
            contextTimestamps[contextPath] = context.mtime;
            fileMd5s[contextPath] = context.hash;
          }
        })
        .then(resolve, reject);
      }),
      (function() {
        var handles = [];
        Object.keys(missingCache).map(function(group) {
          Object.keys(missingCache[group]).map(function(key) {
            var missingItem = missingCache[group][key];
            if (!missingItem) {return;}
            missingItem.map(function(missed, index) {
              var missedPath = missed.split('?')[0];
              if (index === missingItem.length - 1) {
                if (!stats[missed]) {stats[missed] = stat(missed);}
                return handles.push(stats[missed]
                .catch(function() {missingItem.invalid = true;}));
              }
              if (!stats[missed]) {stats[missed] = stat(missed);}
              return handles.push(stats[missed]
              .then(function(stat) {
                if (stat.isDirectory()) {
                  if (group === 'context') {missingItem.invalid = true;}
                }
                if (stat.isFile()) {
                  if (group === 'loader' || group === 'normal') {missingItem.invalid = true;}
                }
              })
              .catch(function() {}));
            });
          });
        });
        return handles;
      })(),
    ])
    .then(function() {
      // Invalidate resolve cache items.
      Object.keys(resolveCache).forEach(function(key) {
        var resolveKey = JSON.parse(key);
        var resolveItem = resolveCache[key];
        if (resolveItem.type === 'context') {
          var contextMissing = missingCache.context[JSON.stringify([resolveKey.context, resolveItem.resource.split('?')[0]])];
          if (!contextMissing || contextMissing.invalid) {resolveItem.invalid = true;}
        }
        else {
          var normalMissing = missingCache.normal[JSON.stringify([resolveKey[0], resolveItem.resource.split('?')[0]])];
          if (!normalMissing || normalMissing.invalid) {resolveItem.invalid = true;}
          resolveItem.loaders.forEach(function(loader) {
            if (typeof loader === 'object') {
              loader = loader.loader;
            }
            var loaderMissing = missingCache.loader[JSON.stringify([resolveKey[0], loader.split('?')[0]])];
            if (!loaderMissing || loaderMissing.invalid) {resolveItem.invalid = true;}
          });
        }
      });
      // Invalidate modules that depend on a userRequest that is no longer
      // valid.
      var walkDependencyBlock = function(block, callback) {
        block.dependencies.forEach(callback);
        block.variables.forEach(function(variable) {
          variable.dependencies.forEach(callback);
        });
        block.blocks.forEach(function(block) {
          walkDependencyBlock(block, callback);
        });
      };
      // Remove the out of date cache modules.
      Object.keys(moduleCache).forEach(function(key) {
        var cacheItem = moduleCache[key];
        if (!cacheItem) {return;}
        if (typeof cacheItem === 'string') {
          cacheItem = JSON.parse(cacheItem);
          moduleCache[key] = cacheItem;
        }
        var validDepends = true;
        walkDependencyBlock(cacheItem, function(cacheDependency) {
          if (
            !cacheDependency ||
            cacheDependency.contextDependency ||
            typeof cacheDependency.request === 'undefined'
          ) {
            return;
          }

          var resolveId = JSON.stringify(
            [cacheItem.context, cacheDependency.request]
          );
          var resolveItem = resolveCache[resolveId];
          validDepends = validDepends &&
            resolveItem &&
            !resolveItem.invalid;
        });
        if (!validDepends) {
          // console.log('invalid', key);
          // cacheItem.invalid = true;
          // moduleCache[key] = null;
        }
      });
    })
    .then(function() {cb();}, cb);
  });

  compiler.plugin('after-plugins', function() {
    compiler.plugin('compilation', function(compilation) {
      var factories = compilation.dependencyFactories;
      var contextFactory = factories.get(RequireContextDependency);

      var hardContextFactory = new HardContextModuleFactory({
        compilation: compilation,
        factory: contextFactory,
        resolveCache: resolveCache,
        moduleCache: moduleCache,
        fileTimestamps: fileTimestamps,
        fileMd5s: fileMd5s,
        cachedMd5s: cachedMd5s,
      });

      factories.set(AMDRequireContextDependency, hardContextFactory);
      factories.set(CommonJsRequireContextDependency, hardContextFactory);
      factories.set(RequireContextDependency, hardContextFactory);
      factories.set(RequireResolveContextDependency, hardContextFactory);

      if (SystemImportContextDependency) {
        factories.set(SystemImportContextDependency, hardContextFactory);
      }

      factories.set(HardContextDependency, hardContextFactory);
    });
  });

  compiler.plugin('after-plugins', function() {
    function configureMissing(key, resolver) {
      // console.log(missingCache[key], resolverCache[key]);
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
        // console.log(key, resolverCache[key]);
        // console.log(resolveId, resolve);
        if (resolve) {
          console.log('resolve', key, resolve.result + request.split('?').slice(1).join('?'));
          var missingId = JSON.stringify([context, resolve.result]);
          var missing = missingCache[key][missingId];
          if (missing && !missing.invalid) {
            return cb(null, resolve.result + request.split('?').slice(1).join('?'));
          }
        }
        var localMissing = [];
        var callback = function(err, result) {
          if (result) {
            var inverseId = JSON.stringify([context, result.split('?')[0]]);
            var resolveId = JSON.stringify([context, request]);
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
  });

  compiler.plugin('compilation', function(compilation, params) {
    if (!active) {return;}

    compilation.fileTimestamps = fileTimestamps;
    compilation.contextTimestamps = contextTimestamps;

    compilation.dependencyFactories.set(HardModuleDependency, params.normalModuleFactory);
    compilation.dependencyTemplates.set(HardModuleDependency, new NullDependencyTemplate);

    compilation.dependencyFactories.set(HardContextDependency, params.contextModuleFactory);
    compilation.dependencyTemplates.set(HardContextDependency, new NullDependencyTemplate);

    compilation.dependencyFactories.set(HardNullDependency, new NullFactory());
    compilation.dependencyTemplates.set(HardNullDependency, new NullDependencyTemplate);

    compilation.dependencyFactories.set(HardHarmonyExportDependency, new NullFactory());
    compilation.dependencyTemplates.set(HardHarmonyExportDependency, new NullDependencyTemplate);

    compilation.dependencyFactories.set(HardHarmonyImportDependency, params.normalModuleFactory);
    compilation.dependencyTemplates.set(HardHarmonyImportDependency, new NullDependencyTemplate);

    compilation.dependencyFactories.set(HardHarmonyImportSpecifierDependency, new NullFactory());
    compilation.dependencyTemplates.set(HardHarmonyImportSpecifierDependency, new NullDependencyTemplate);

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
          });
          return true;
        }
        return carry;
      }, false);
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
        var cacheId = JSON.stringify([request.context, request.request]);

        var next = function() {
          var originalRequest = request;
          return fn.call(null, request, function(err, request) {
            if (err) {
              return cb(err);
            }
            if (!request.source) {
              resolveCache[cacheId] = Object.assign({}, request, {
                parser: null,
                parserOptions: request.parser[NS + '/parser-options'],
                dependencies: null,
              });
            }
            cb.apply(null, arguments);
          });
        };

        var fromCache = function() {
          var result = Object.assign({}, resolveCache[cacheId]);
          result.dependencies = request.dependencies;
          result.parser = compilation.compiler.parser;
          if (!result.parser || !result.parser.parse) {
            result.parser = params.normalModuleFactory.getParser(result.parserOptions);
          }
          return cb(null, result);
        };

        if (resolveCache[cacheId] && !resolveCache[cacheId].invalid) {
          return fromCache();
        }

        next();
      };
    });

    params.normalModuleFactory.plugin('resolver', function(fn) {
      return function(request, cb) {
        fn.call(null, request, function(err, result) {
          if (err) {return cb(err);}

          var identifierPrefix = cachePrefix(compilation);
          if (identifierPrefix === null) {
            return cb(err, result);
          }
          var identifier = identifierPrefix + result.request;

          if (moduleCache[identifier] && !moduleCache[identifier].invalid) {
            var cacheItem = moduleCache[identifier];

            if (typeof cacheItem === 'string') {
              cacheItem = JSON.parse(cacheItem);
              moduleCache[identifier] = cacheItem;
            }
            if (Array.isArray(cacheItem.assets)) {
              cacheItem.assets = (cacheItem.assets || [])
              .reduce(function(carry, key) {
                carry[key] = assetCache[requestHash(key)];
                return carry;
              }, {});
            }

            if (!HardModule.needRebuild(
              cacheItem,
              cacheItem.fileDependencies,
              cacheItem.contextDependencies,
              // [],
              fileTimestamps,
              contextTimestamps,
              fileMd5s,
              cachedMd5s
            )) {
              var walkDependencyBlock = function(block, callback) {
                return Promise.all(
                  block.dependencies.map(callback)
                  .concat(block.variables.map(function(variable) {
                    return Promise.all(variable.dependencies.map(callback));
                  }))
                  .concat(block.blocks.map(function(block) {
                    return walkDependencyBlock(block, callback);
                  }))
                );
              };

              var state = {state: {imports: {}}};

              return walkDependencyBlock(cacheItem, function(cacheDependency) {
                if (
                  cacheDependency &&
                  !cacheDependency.contextDependency &&
                  typeof cacheDependency.request !== 'undefined'
                ) {
                  var resolveId = JSON.stringify(
                    [cacheItem.context, cacheDependency.request]
                  );
                  var resolveItem = resolveCache[resolveId];
                  if (
                    resolveItem &&
                    resolveItem.request &&
                    resolveItem.resource &&
                    fileTimestamps[resolveItem.resource.split('?')[0]]
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
                      return Promise.resolve();
                    }
                    else if (depCacheItem) {
                      return Promise.reject();
                    }
                  }
                }

                if (cacheDependency.moduleIdentifier) {
                  var dependency = deserializeDependencies.dependencies.call(state, [cacheDependency], null)[0];
                  var factory = compilation.dependencyFactories.get(dependency.constructor);
                  return new Promise(function(resolve, reject) {
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
                      if (err) {
                        return reject(err);
                      }
                      if (cacheDependency.moduleIdentifier === depModule.identifier()) {
                        return resolve();
                      }
                      reject(new Error('dependency has a new identifier'));
                    });
                  });
                }

                return Promise.resolve();
              })
              .then(function() {
                // console.log('valid', cacheItem.request);
                var module = new HardModule(cacheItem);

                return cb(null, module);
              })
              .catch(function(err) {
                // console.log('invalid', cacheItem.request, err);
                cacheItem.invalid = true;
                moduleCache[identifier] = null;

                return cb(null, result);
              });
            }
          }
          return cb(null, result);
        });
      };
    });

    params.normalModuleFactory.plugin('module', function(module) {
      // module.isUsed = function(exportName) {
      //   return exportName ? exportName : false;
      // };
      return module;
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
          if (Array.isArray(cacheItem.assets)) {
            cacheItem.assets = (cacheItem.assets || [])
            .reduce(function(carry, key) {
              carry[key] = assetCache[requestHash(key)];
              return carry;
            }, {});
          }
          var module = memoryCache[memCacheId] = new HardModule(cacheItem);
          module.build(null, null, null, null, function() {});
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
          var module = memoryCache[memCacheId] = new HardContextModule(cacheItem);
          module.build(null, null, null, null, function() {});
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

  compiler.plugin('compilation', function(compilation, params) {
    var preloadMemoryCache = false;
    params.normalModuleFactory.plugin('before-resolve', function(data, cb) {
      if (preloadMemoryCache) {return cb(null, data);}
      preloadMemoryCache = true;
      if (compilation.cache) {
        var prefix = cachePrefix(compilation);
        if (prefix === null) {return cb(null, data);}
        if (preloadCacheByPrefix[prefix]) {return cb(null, data);}
        preloadCacheByPrefix[prefix] = true;

        preload(prefix, compilation.cache);
      }
      return cb(null, data);
    });
  });

  compiler.plugin('make', function(compilation, cb) {
    if (compilation.cache) {
      var prefix = cachePrefix(compilation);
      if (prefix === null) {return cb();}
      if (preloadCacheByPrefix[prefix]) {return cb();}
      preloadCacheByPrefix[prefix] = true;

      preload(prefix, compilation.cache);
    }
    return cb();
  });

  compiler.plugin('this-compilation', function(compilation) {
    compiler.__hardSource_topCompilation = compilation;
  });

  compiler.plugin('after-compile', function(compilation, cb) {
    if (!active) {return cb();}

    var startCacheTime = Date.now();

    var devtoolOptions = makeDevtoolOptions(compiler.options);

    // fs.writeFileSync(
    //   path.join(cacheDirPath, 'file-dependencies.json'),
    //   JSON.stringify({fileDependencies: compilation.fileDependencies}),
    //   'utf8'
    // );

    var moduleOps = [];
    var dataOps = [];
    var md5Ops = [];
    var assetOps = [];
    var missingOps = [];
    var resolverOps = [];

    var buildingMd5s = {};

    if (compiler.__hardSource_topCompilation === compilation) {
      // var fileDependenciesDiff = lodash.difference(compilation.fileDependencies, dataCache.fileDependencies || []);

      function buildMd5Ops(dependencies) {
        dependencies.forEach(function(file) {
          buildingMd5s[file] = buildingMd5s[file]
          .then(function(value) {
            if (
              !md5Cache[file] ||
              (!value.mtime && md5Cache[file] && md5Cache[file].mtime !== value.mtime) ||
              (md5Cache[file] && md5Cache[file].hash !== value.hash)
            ) {
              md5Cache[file] = value;
              cachedMd5s[file] = value.hash;

              md5Ops.push({
                key: file,
                value: JSON.stringify(value),
              });
            }
          });
        });
      }

      if (!lodash.isEqual(compilation.fileDependencies, dataCache.fileDependencies)) {
        // dataCache.fileDependencies = (dataCache.fileDependencies || [])
        // .concat(fileDependenciesDiff);
        lodash.difference(dataCache.fileDependencies, compilation.fileDependencies).forEach(function(file) {
          buildingMd5s[file] = Promise.resolve({
            mtime: 0,
            hash: '',
          });
        });

        dataCache.fileDependencies = compilation.fileDependencies;

        dataOps.push({
          key: 'fileDependencies',
          value: JSON.stringify(dataCache.fileDependencies),
        });
      }

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

        buildingMd5s[file] = Promise.props({
          mtime: getValue(fileTimestamps, file, mtime),
          hash: getValue(fileMd5s, file, md5),
        });
      });

      buildMd5Ops(dataCache.fileDependencies);

      if (!lodash.isEqual(compilation.contextDependencies, dataCache.contextDependencies)) {
        lodash.difference(dataCache.contextDependencies, compilation.contextDependencies).forEach(function(file) {
          buildingMd5s[file] = Promise.resolve({
            mtime: 0,
            hash: '',
          });
        });

        dataCache.contextDependencies = compilation.contextDependencies;

        dataOps.push({
          key: 'contextDependencies',
          value: JSON.stringify(dataCache.contextDependencies),
        });
      }

      var contexts = Promise.all(
        Object.keys(buildingMd5s).map(function(key) {return buildingMd5s[key];})
      )
      .then(function() {
        return contextStamps(dataCache.contextDependencies, dataCache.fileDependencies);
      });
      dataCache.contextDependencies.forEach(function(file) {
        if (buildingMd5s[file]) {return;}

        buildingMd5s[file] = contexts
        .then(function(contexts) {
          return Promise.props({
            mtime: contexts[file].mtime,
            hash: contexts[file].hash,
          });
        });
      });

      buildMd5Ops(dataCache.contextDependencies);

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

    function serializeError(error) {
      var serialized = {
        message: error.message,
      };
      if (error.origin) {
        serialized.origin = serializeDependencies([error.origin])[0];
      }
      if (error.dependencies) {
        serialized.dependencies = serializeDependencies(error.dependencies);
      }
      return serialized;
    }

    compilation.modules.forEach(function(module) {
      var identifierPrefix = cachePrefix(compilation);
      if (identifierPrefix === null) {
        return;
      }
      var identifier = identifierPrefix + module.identifier();
      var existingCacheItem = moduleCache[identifier];

      if (
        module.request &&
        module.cacheable &&
        !(module instanceof HardModule) &&
        (module instanceof NormalModule) &&
        (
          existingCacheItem &&
          module.buildTimestamp > existingCacheItem.buildTimestamp ||
          !existingCacheItem
        )
      ) {
        var source = module.source(
          compilation.dependencyTemplates,
          compilation.moduleTemplate.outputOptions,
          compilation.moduleTemplate.requestShortener
        );
        var assets = Object.keys(module.assets || {}).map(function(key) {
          return {
            key: requestHash(key),
            value: module.assets[key].source(),
          };
        });
        moduleCache[identifier] = {
          moduleId: module.id,
          context: module.context,
          request: module.request,
          userRequest: module.userRequest,
          rawRequest: module.rawRequest,
          resource: module.resource,
          loaders: module.loaders,
          identifier: module.identifier(),
          // libIdent: module.libIdent &&
          // module.libIdent({context: compiler.options.context}),
          assets: Object.keys(module.assets || {}),
          buildTimestamp: module.buildTimestamp,
          strict: module.strict,
          meta: module.meta,
          used: module.used,
          usedExports: module.usedExports,
          issuer:
            typeof module.issuer === 'string' ? module.issuer :
            module.issuer && typeof module.issuer === 'object' ? module.issuer.identifier() :
            null,

          rawSource: module._source ? module._source.source() : null,
          source: source.source(),
          map: devtoolOptions && source.map(devtoolOptions),
          // Some plugins (e.g. UglifyJs) set useSourceMap on a module. If that
          // option is set we should always store some source map info and
          // separating it from the normal devtool options may be necessary.
          baseMap: module.useSourceMap && source.map(),
          hashContent: serializeHashContent(module),

          dependencies: serializeDependencies(module.dependencies),
          variables: serializeVariables(module.variables),
          blocks: serializeBlocks(module.blocks),

          fileDependencies: module.fileDependencies,
          contextDependencies: module.contextDependencies,

          errors: module.errors.map(serializeError),
          warnings: module.warnings.map(serializeError),
        };

        // Custom plugin handling for common plugins.
        // This will be moved in a pluginified HardSourcePlugin.
        //
        // Ignore the modules that kick off child compilers in extract text.
        // These modules must always be built so the child compilers run so
        // that assets get built.
        if (
          module[extractTextNS] ||
          module.meta && module.meta[extractTextNS]
        ) {
          moduleCache[identifier] = null;
          return;
        }

        moduleOps.push({
          key: identifier,
          value: JSON.stringify(moduleCache[identifier]),
        });

        // module.fileDependencies.forEach(function(file) {
        //   buildMd5s.push(file);
        // });
        //
        // module.contextDependencies.forEach(function(context) {
        //   buildContextMd5s.push(file);
        // });

        if (assets.length) {
          assetOps = assetOps.concat(assets);
        }
      }

      if (
        module.context &&
        module.cacheable &&
        !(module instanceof HardContextModule) &&
        (module instanceof ContextModule) &&
        (
          existingCacheItem &&
          module.builtTime >= existingCacheItem.builtTime ||
          !existingCacheItem
        )
      ) {
        var source = module.source(
          compilation.dependencyTemplates,
          compilation.moduleTemplate.outputOptions,
          compilation.moduleTemplate.requestShortener
        );
        var assets = Object.keys(module.assets || {}).map(function(key) {
          return {
            key: requestHash(key),
            value: module.assets[key].source(),
          };
        });
        moduleCache[identifier] = {
          moduleId: module.id,
          context: module.context,
          recursive: module.recursive,
          regExp: module.regExp ? module.regExp.source : null,
          async: module.async,
          addons: module.addons,
          identifier: module.identifier(),
          builtTime: module.builtTime,

          used: module.used,
          usedExports: module.usedExports,

          source: source.source(),
          map: devtoolOptions && source.map(devtoolOptions),
          // Some plugins (e.g. UglifyJs) set useSourceMap on a module. If that
          // option is set we should always store some source map info and
          // separating it from the normal devtool options may be necessary.
          baseMap: module.useSourceMap && source.map(),
          hashContent: serializeHashContent(module),

          dependencies: serializeDependencies(module.dependencies),
          variables: serializeVariables(module.variables),
          blocks: serializeBlocks(module.blocks),
        };

        moduleOps.push({
          key: identifier,
          value: JSON.stringify(moduleCache[identifier]),
        });
      }
    });

    var writeMd5Ops = Promise.all(Object.keys(buildingMd5s).map(function(key) {
      return buildingMd5s[key];
    }))
    .then(function() {
      return md5CacheSerializer.write(md5Ops);
    });

    Promise.all([
      fsWriteFile(path.join(cacheDirPath, 'stamp'), currentStamp, 'utf8'),
      fsWriteFile(path.join(cacheDirPath, 'version'), hardSourceVersion, 'utf8'),
      fsWriteFile(resolveCachePath, JSON.stringify(resolveCache), 'utf8'),
      assetCacheSerializer.write(assetOps),
      moduleCacheSerializer.write(moduleOps),
      dataCacheSerializer.write(dataOps),
      writeMd5Ops,
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
