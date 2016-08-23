var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var level = require('level');
var lodash = require('lodash');
var mkdirp = require('mkdirp');

var Promise = require('bluebird');

var envHash;
try {
  envHash = require('env-hash');
  envHash = envHash.default || envHash;
}
catch (_) {
  envHash = function() {
    return Promise.resolve('');
  };
}

var AsyncDependenciesBlock = require('webpack/lib/AsyncDependenciesBlock');
var ConstDependency = require('webpack/lib/dependencies/ConstDependency');
var ContextDependency = require('webpack/lib/dependencies/ContextDependency');
var NormalModule = require('webpack/lib/NormalModule');
var NullDependencyTemplate = require('webpack/lib/dependencies/NullDependencyTemplate');
var NullFactory = require('webpack/lib/NullFactory');

var HardModuleDependency = require('./lib/dependencies').HardModuleDependency;
var HardContextDependency = require('./lib/dependencies').HardContextDependency;
var HardNullDependency = require('./lib/dependencies').HardNullDependency;
var HardHarmonyExportDependency = require('./lib/dependencies').HardHarmonyExportDependency;

var HardModule = require('./lib/hard-module');
var makeDevtoolOptions = require('./lib/devtool-options');

function requestHash(request) {
  return crypto.createHash('sha1').update(request).digest().hexSlice();
}

var fsReadFile = Promise.promisify(fs.readFile, {context: fs});
var fsReaddir = Promise.promisify(fs.readdir, {context: fs});
var fsStat = Promise.promisify(fs.stat, {context: fs});
var fsWriteFile = Promise.promisify(fs.writeFile, {context: fs});

function serializeDependencies(deps) {
  return deps
  .map(function(dep) {
    if (dep.originModule) {
      return {
        harmonyExport: true,
        harmonyId: dep.id,
        harmonyName: dep.describeHarmonyExport().exportedName,
        harmonyPrecedence: dep.describeHarmonyExport().exportedName,
      };
    }
    return {
      contextDependency: dep instanceof ContextDependency,
      constDependency: dep instanceof ConstDependency,
      request: dep.request,
      recursive: dep.recursive,
      regExp: dep.regExp ? dep.regExp.source : null,
    };
  })
  .filter(function(req) {
    return req.request || req.constDependency || req.harmonyExport;
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

function HardSourceWebpackPlugin(options) {
  this.options = options;
}

module.exports = HardSourceWebpackPlugin;
HardSourceWebpackPlugin.prototype.apply = function(compiler) {
  var options = this.options;
  var active = true;
  var cacheDirName = options.cacheDirectory;
  if (!cacheDirName) {
    console.error('HardSourceWebpackPlugin requires a cacheDirectory setting.');
    active = false;
    return;
  }
  var cacheDirPath = path.resolve(compiler.options.output.path, cacheDirName);
  var cacheAssetDirPath = path.join(cacheDirPath, 'assets');
  var resolveCachePath = path.join(cacheDirPath, 'resolve.json');

  var resolveCache = {};
  var moduleCache = {};
  var assets = {};
  var currentStamp = '';

  var fileTimestamps = {};

  compiler.plugin('after-plugins', function() {
    if (
      !compiler.recordsInputPath ||
      compiler.recordsInputPath !== compiler.recordsOutputPath
    ) {
      console.error('HardSourceWebpackPlugin requires recordsPath to be set.');
      active = false;
    }
  });

  compiler.plugin(['watch-run', 'run'], function(compiler, cb) {
    if (!active) {return cb();}

    mkdirp.sync(cacheAssetDirPath);
    var start = Date.now();

    Promise.all([
      fsReadFile(path.join(cacheDirPath, 'stamp'), 'utf8')
      .catch(function() {return '';}),

      (function() {
        if (options.environmentPaths === false) {
          return Promise.resolve('');
        }
        return envHash(options.environmentPaths);
      })(),
    ])
    .then(function(stamps) {
      var stamp = stamps[0];
      var hash = stamps[1];

      currentStamp = hash;
      if (!hash || hash !== stamp) {
        if (hash && stamp) {
          console.error('Environment has changed (node_modules or configuration was updated).\nHardSourceWebpackPlugin will reset the cache and store a fresh one.');
        }

        // Reset the cache, we can't use it do to an environment change.
        resolveCache = {};
        moduleCache = {};
        assets = {};
        fileTimestamps = {};
        return;
      }

      if (Object.keys(moduleCache).length) {return Promise.resolve();}

      return Promise.all([
        fsReadFile(resolveCachePath, 'utf8')
        .then(JSON.parse)
        .then(function(_resolveCache) {resolveCache = _resolveCache}),

        Promise.all(fs.readdirSync(cacheAssetDirPath).map(function(name) {
          return fsReadFile(path.join(cacheAssetDirPath, name))
          .then(function(asset) {
            assets[name] = asset;
          });
        })),

        (function() {
          var start = Date.now();
          return Promise.promisify(level)(path.join(cacheDirPath, 'modules'))
          .then(function(db) {
            return new Promise(function(resolve, reject) {
              var dbClose = Promise.promisify(db.close, {context: db});
              db.createReadStream()
              .on('data', function(data) {
                var value = data.value;
                if (!moduleCache[data.key]) {
                  moduleCache[data.key] = value;
                }
              })
              .on('end', function() {
                dbClose().then(resolve, reject);
              });
            });
          })
          .then(function() {
            // console.log('cache in - modules', Date.now() - start);
            if (typeof moduleCache.fileDependencies === 'string') {
              moduleCache.fileDependencies = JSON.parse(moduleCache.fileDependencies);
            }
          });
        })(),
      ])
      .then(function() {
        // console.log('cache in', Date.now() - start);
      });
    })
    .then(cb, cb);
  });

  compiler.plugin(['watch-run', 'run'], function(compiler, cb) {
    if (!active) {return cb();}

    if(!moduleCache.fileDependencies) return cb();
    // var fs = compiler.inputFileSystem;
    var fileTs = compiler.fileTimestamps = fileTimestamps = {};

    return Promise.all(moduleCache.fileDependencies.map(function(file) {
      return fsStat(file)
      .then(function(stat) {
        fileTs[file] = stat.mtime || Infinity;
      }, function(err) {
        fileTs[file] = 0;

        // Invalidate modules that depend on this userRequest.
        var walkDependencyBlock = function(block, callback) {
          // console.log(block);
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
          if (key === 'fileDependencies') {return;}
          var module = moduleCache[key];
          if (typeof module === 'string') {
            module = JSON.parse(module);
            moduleCache[key] = module;
          }
          var dependsOnRequest = false;
          walkDependencyBlock(module, function(cacheDependency) {
            var resolveId = JSON.stringify(
              [module.context, cacheDependency.request]
            );
            var resolveItem = resolveCache[resolveId];
            dependsOnRequest = dependsOnRequest ||
              resolveItem && resolveItem.userRequest === file;
          });
          if (dependsOnRequest) {
            moduleCache[key] = null;
          }
        });

        if (err.code === "ENOENT") {return;}
        throw err;
      });
    }))
    .then(function() {cb();}, cb);
  });

  compiler.plugin('compilation', function(compilation, params) {
    if (!active) {return;}

    compilation.fileTimestamps = fileTimestamps;

    compilation.dependencyFactories.set(HardModuleDependency, params.normalModuleFactory);
    compilation.dependencyTemplates.set(HardModuleDependency, new NullDependencyTemplate);

    compilation.dependencyFactories.set(HardContextDependency, params.contextModuleFactory);
    compilation.dependencyTemplates.set(HardContextDependency, new NullDependencyTemplate);

    compilation.dependencyFactories.set(HardNullDependency, new NullFactory());
    compilation.dependencyTemplates.set(HardNullDependency, new NullDependencyTemplate);

    compilation.dependencyFactories.set(HardHarmonyExportDependency, new NullFactory());
    compilation.dependencyTemplates.set(HardHarmonyExportDependency, new NullDependencyTemplate);

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
          return cb(null, result);
        };

        if (resolveCache[cacheId]) {
          var userRequest = resolveCache[cacheId].userRequest;
          if (fileTimestamps[userRequest]) {
            return fromCache();
          }
          return fs.stat(userRequest, function(err) {
            if (!err) {
              return fromCache();
            }

            next();
          });
        }

        next();
      };
    });

    params.normalModuleFactory.plugin('resolver', function(fn) {
      return function(request, cb) {
        fn.call(null, request, function(err, result) {
          if (err) {return cb(err);}
          else if (moduleCache[result.request]) {
            var cacheItem = moduleCache[result.request];
            if (typeof cacheItem === 'string') {
              cacheItem = JSON.parse(cacheItem);
              cacheItem.assets = (cacheItem.assets || [])
              .reduce(function(carry, key) {
                carry[key] = assets[requestHash(key)];
                return carry;
              }, {});
              moduleCache[result.request] = cacheItem;
            }
            if (!HardModule.needRebuild(
              cacheItem.buildTimestamp,
              cacheItem.fileDependencies,
              cacheItem.contextDependencies,
              // [],
              fileTimestamps,
              compiler.contextTimestamps
            )) {
              var module = new HardModule(cacheItem);
              return cb(null, module);
            }
          }
          return cb(null, result);
        });
      };
    });

    params.normalModuleFactory.plugin('module', function(module) {
      module.isUsed = function(exportName) {
        return exportName ? exportName : false;
      };
      return module;
    });
  });

  var leveldbLock = Promise.resolve();

  // compiler.plugin('this-compilation', function() {
  //   leveldbLock = Promise.resolve();
  // });

  compiler.plugin('after-compile', function(compilation, cb) {
    if (!active) {return cb();}

    var startCacheTime = Date.now();

    var devtoolOptions = makeDevtoolOptions(compiler.options);

    // fs.writeFileSync(
    //   path.join(cacheDirPath, 'file-dependencies.json'),
    //   JSON.stringify({fileDependencies: compilation.fileDependencies}),
    //   'utf8'
    // );

    var ops = [];
    var assetOps = [];

    var fileDependenciesDiff = lodash.difference(compilation.fileDependencies, moduleCache.fileDependencies || []);
    if (fileDependenciesDiff.length) {
      moduleCache.fileDependencies = (moduleCache.fileDependencies || [])
      .concat(fileDependenciesDiff);

      ops.push({
        type: 'put',
        key: 'fileDependencies',
        value: moduleCache.fileDependencies,
      });
    }

    // moduleCache.fileDependencies = compilation.fileDependencies;
    // ops.push({
    //   type: 'put',
    //   key: 'fileDependencies',
    //   // value: JSON.stringify(compilation.fileDependencies),
    //   value: moduleCache.fileDependencies,
    // });

    // mkdirp.sync(cacheAssetDirPath);

    compilation.modules.forEach(function(module, cb) {
      if (module.request && module.cacheable && !(module instanceof HardModule) && (module instanceof NormalModule)) {
        var source = module.source(
          compilation.dependencyTemplates,
          compilation.moduleTemplate.outputOptions, 
          compilation.moduleTemplate.requestShortener
        );
        var assets = Object.keys(module.assets || {}).map(function(key) {
          return [requestHash(key), module.assets[key].source()];
        });
        moduleCache[module.request] = {
          moduleId: module.id,
          context: module.context,
          request: module.request,
          identifier: module.identifier(),
          readableIdentifier: module
          .readableIdentifier(compilation.moduleTemplate.requestShortener),
          assets: Object.keys(module.assets || {}),
          buildTimestamp: module.buildTimestamp,
          strict: module.strict,
          meta: module.meta,

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
        };

        ops.push({
          type: 'put',
          key: module.request,
          value: moduleCache[module.request],
        });

        if (assets.length) {
          assetOps = assetOps.concat(assets);
        }
      }
    });

    Promise.all([
      fsWriteFile(path.join(cacheDirPath, 'stamp'), currentStamp, 'utf8'),
      fsWriteFile(resolveCachePath, JSON.stringify(resolveCache), 'utf8'),
      (function() {
        return Promise.all(assetOps.map(function(asset) {
          var assetPath = path.join(cacheAssetDirPath, asset[0]);
          return fsWriteFile(assetPath, asset[1]);
        }));
      })(),
      (function() {
        if (ops.length === 0) {
          return;
        }
        return leveldbLock = leveldbLock
        .then(function() {
          return Promise.promisify(level)(path.join(cacheDirPath, 'modules'), {valueEncoding: 'json'});
        })
        .then(function(db) {
          return Promise.promisify(db.batch, {context: db})(ops)
          .then(function() {return db;});
        })
        .then(function(db) {
          return Promise.promisify(db.close, {context: db})();
        });
      })(),
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
