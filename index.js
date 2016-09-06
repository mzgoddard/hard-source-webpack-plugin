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
var SingleEntryDependency = require('webpack/lib/dependencies/SingleEntryDependency');

var HarmonyImportDependency, HarmonyImportSpecifierDependency, HarmonyExportImportedSpecifierDependency;

try {
  HarmonyImportDependency = require('webpack/lib/dependencies/HarmonyImportDependency');
  HarmonyImportSpecifierDependency = require('webpack/lib/dependencies/HarmonyImportSpecifierDependency');
  HarmonyExportImportedSpecifierDependency = require('webpack/lib/dependencies/HarmonyExportImportedSpecifierDependency');
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
var HardModule = require('./lib/hard-module');
var LevelDbSerializer = require('./lib/cache-serializers').LevelDbSerializer;
var makeDevtoolOptions = require('./lib/devtool-options');

function requestHash(request) {
  return crypto.createHash('sha1').update(request).digest().hexSlice();
}

var fsReadFile = Promise.promisify(fs.readFile, {context: fs});
var fsStat = Promise.promisify(fs.stat, {context: fs});
var fsWriteFile = Promise.promisify(fs.writeFile, {context: fs});

function serializeDependencies(deps) {
  return deps
  .map(function(dep) {
    if (typeof HarmonyImportDependency !== 'undefined') {
      if (dep instanceof HarmonyImportDependency) {
        return {
          harmonyImport: true,
          request: dep.request,
        };
      }
      if (dep instanceof HarmonyExportImportedSpecifierDependency) {
        return {
          harmonyExportImportedSpecifier: true,
          harmonyId: dep.id,
          harmonyName: dep.name,
        };
      }
      if (dep instanceof HarmonyImportSpecifierDependency) {
        return {
          harmonyImportSpecifier: true,
          harmonyId: dep.id,
          harmonyName: dep.name,
          loc: dep.loc,
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
      contextDependency: dep instanceof ContextDependency,
      contextCritical: dep.critical,
      constDependency: dep instanceof ConstDependency,
      request: dep.request,
      recursive: dep.recursive,
      regExp: dep.regExp ? dep.regExp.source : null,
      loc: dep.loc,
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
  var cacheDirPath = path.resolve(
    process.cwd(), compiler.options.output.path, cacheDirName
  );
  var cacheAssetDirPath = path.join(cacheDirPath, 'assets');
  var resolveCachePath = path.join(cacheDirPath, 'resolve.json');

  var resolveCache = {};
  var moduleCache = {};
  var assetCache = {};
  var dataCache = {};
  var currentStamp = '';

  var fileTimestamps = {};

  var assetCacheSerializer = this.assetCacheSerializer =
    new FileSerializer({cacheDirPath: path.join(cacheDirPath, 'assets')});
  var moduleCacheSerializer = this.moduleCacheSerializer =
    new LevelDbSerializer({cacheDirPath: path.join(cacheDirPath, 'modules')});
  var dataCacheSerializer = this.dataCacheSerializer =
    new LevelDbSerializer({cacheDirPath: path.join(cacheDirPath, 'data')});

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
        assetCache = {};
        dataCache = {};
        fileTimestamps = {};
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

    return Promise.all(dataCache.fileDependencies.map(function(file) {
      return fsStat(file)
      .then(function(stat) {
        fileTs[file] = stat.mtime || Infinity;
      }, function(err) {
        fileTs[file] = 0;

        if (err.code === "ENOENT") {return;}
        throw err;
      });
    }))
    .then(function() {
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
            resolveItem.userRequest &&
            fileTs[resolveItem.userRequest] !== 0;
        });
        if (!validDepends) {
          cacheItem.invalid = true;
          moduleCache[key] = null;
        }
      });
    })
    .then(function() {
      if (!NormalModule.prototype.isUsed) {
        return Promise.resolve();
      }

      return Promise.resolve()
      .then(function() {
        // Ensure records have been read before we use the sub-compiler to
        // invlidate packages before the normal compiler executes.
        if (Object.keys((compiler.compiler || compiler).records).length === 0) {
          return Promise.promisify(
            (compiler.compiler || compiler).readRecords,
            {context: (compiler.compiler || compiler)}
          )();
        }
      })
      .then(function() {
        var _compiler = compiler.compiler || compiler;
        // Create a childCompiler but set it up and run it like it is the original
        // compiler except that it won't finalize the work ('after-compile' step
        // that renders chunks).
        var childCompiler = _compiler.createChildCompiler();
        // Copy 'this-compilation' and 'make' as well as other plugins.
        for(var name in _compiler._plugins) {
          if(["compile", "emit", "after-emit", "invalid", "done"].indexOf(name) < 0)
            childCompiler._plugins[name] = _compiler._plugins[name].slice();
        }
        // Use the parent's records.
        childCompiler.records = (compiler.compiler || compiler).records;

        var params = childCompiler.newCompilationParams();
        childCompiler.applyPlugins("compile", params);

        var compilation = childCompiler.newCompilation(params);

        // Run make and seal. This is enough to find out if any module should be
        // invalidated due to some built state.
        return Promise.promisify(childCompiler.applyPluginsParallel, {context: childCompiler})("make", compilation)
        .then(function() {
          return Promise.promisify(compilation.seal, {context: compilation})();
        })
        .then(function() {return compilation;});
      })
      .then(function(compilation) {
        // Iterate the sub-compiler's modules and invalidate modules whose cached
        // used and usedExports do not match their new values due to a dependent
        // module changing what it uses.
        compilation.modules.forEach(function(module) {
          if (!(module instanceof HardModule)) {
            return;
          }

          var cacheItem = moduleCache[module.request];
          if (!cacheItem) {
            return;
          }

          if (
            !lodash.isEqual(cacheItem.used, module.used) ||
            !lodash.isEqual(cacheItem.usedExports, module.usedExports)
          ) {
            cacheItem.invalid = true;
            moduleCache[module.request] = null;
          }
        });
      });
    })
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

    compilation.dependencyFactories.set(HardHarmonyImportDependency, params.normalModuleFactory);
    compilation.dependencyTemplates.set(HardHarmonyImportDependency, new NullDependencyTemplate);

    compilation.dependencyFactories.set(HardHarmonyImportSpecifierDependency, new NullFactory());
    compilation.dependencyTemplates.set(HardHarmonyImportSpecifierDependency, new NullDependencyTemplate);

    compilation.dependencyFactories.set(HardHarmonyExportImportedSpecifierDependency, new NullFactory());
    compilation.dependencyTemplates.set(HardHarmonyExportImportedSpecifierDependency, new NullDependencyTemplate);

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
              moduleCache[result.request] = cacheItem;
            }
            if (Array.isArray(cacheItem.assets)) {
              cacheItem.assets = (cacheItem.assets || [])
              .reduce(function(carry, key) {
                carry[key] = assetCache[requestHash(key)];
                return carry;
              }, {});
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
      // module.isUsed = function(exportName) {
      //   return exportName ? exportName : false;
      // };
      return module;
    });
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
    var assetOps = [];

    var fileDependenciesDiff = lodash.difference(compilation.fileDependencies, dataCache.fileDependencies || []);
    if (fileDependenciesDiff.length) {
      dataCache.fileDependencies = (dataCache.fileDependencies || [])
      .concat(fileDependenciesDiff);

      dataOps.push({
        key: 'fileDependencies',
        value: JSON.stringify(dataCache.fileDependencies),
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

    compilation.modules.forEach(function(module, cb) {
      if (module.request && module.cacheable && !(module instanceof HardModule) && (module instanceof NormalModule)) {
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
        moduleCache[module.request] = {
          moduleId: module.id,
          context: module.context,
          request: module.request,
          userRequest: module.userRequest,
          identifier: module.identifier(),
          readableIdentifier: module
          .readableIdentifier(compilation.moduleTemplate.requestShortener),
          // libIdent: module.libIdent &&
          // module.libIdent({context: compiler.options.context}),
          assets: Object.keys(module.assets || {}),
          buildTimestamp: module.buildTimestamp,
          strict: module.strict,
          meta: module.meta,
          used: module.used,
          usedExports: module.usedExports,

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

        moduleOps.push({
          key: module.request,
          value: JSON.stringify(moduleCache[module.request]),
        });

        if (assets.length) {
          assetOps = assetOps.concat(assets);
        }
      }
    });

    Promise.all([
      fsWriteFile(path.join(cacheDirPath, 'stamp'), currentStamp, 'utf8'),
      fsWriteFile(resolveCachePath, JSON.stringify(resolveCache), 'utf8'),
      assetCacheSerializer.write(assetOps),
      moduleCacheSerializer.write(moduleOps),
      dataCacheSerializer.write(dataOps),
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
