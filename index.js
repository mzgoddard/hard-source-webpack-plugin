var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var mkdirp = require('mkdirp');
var async = require('async');

var ConstDependency = require('webpack/lib/dependencies/ConstDependency');
var NullFactory = require('webpack/lib/NullFactory');
var NullDependency = require('webpack/lib/dependencies/NullDependency');
var NullDependencyTemplate = require('webpack/lib/dependencies/NullDependencyTemplate');
var ModuleDependency = require('webpack/lib/dependencies/ModuleDependency');
var RawModule = require('webpack/lib/RawModule');
var RawSource = require('webpack/lib/RawSource');
var ContextDependency = require('webpack/lib/dependencies/ContextDependency');
var AsyncDependenciesBlock = require('webpack/lib/AsyncDependenciesBlock');

function RawModuleDependency(request) {
  ModuleDependency.call(this, request);
}
RawModuleDependency.prototype = Object.create(ModuleDependency.prototype);
RawModuleDependency.prototype.constructor = RawModuleDependency;
function RawModuleDependencyTemplate() {
}
RawModuleDependencyTemplate.prototype.apply = function() {};
RawModuleDependencyTemplate.prototype.applyAsTemplateArgument = function() {};

function CacheModule(cacheItem) {
  RawModule.call(this, cacheItem.source, cacheItem.identifier, cacheItem.identifier);

  this.context = cacheItem.context;
  this.request = cacheItem.request;
  this.map = function() {return cacheItem.map;};
  this.assets = Object.keys(cacheItem.assets).reduce(function(carry, key) {
    let source = cacheItem.assets[key];
    if (source.type === 'Buffer') {
      source = new Buffer(source);
    }
    carry[key] = new RawSource(source);
    return carry;
  }, {});
  this.buildTimestamp = cacheItem.buildTimestamp;
  this.fileDependencies = cacheItem.fileDependencies;
  this.contextDependencies = cacheItem.contextDependencies;
  this.dependencies = cacheItem.dependencies.map(function(req) {
    if (req.contextDependency) {
      return new ContextDependency(req.request, req.recursive, req.regExp ? new RegExp(req.regExp) : null);
    }
    if (req.constDependency) {
      return new NullDependency();
    }
    return new RawModuleDependency(req.request);
  });
  var module = this;
  this.blocks = cacheItem.blocks.map(function(req) {
    if (req.async) {
      var block = new AsyncDependenciesBlock(req.name, module);
      block.dependencies = req.dependencies.map(function(req) {
        if (req.contextDependency) {
          return new ContextDependency(req.request, req.recursive, req.regExp ? new RegExp(req.regExp) : null);
        }
        if (req.constDependency) {
          return new NullDependency();
        }
        return new RawModuleDependency(req.request);
      });
      return block;
    }
  })
  .filter(Boolean);
}
CacheModule.prototype = Object.create(RawModule.prototype);
CacheModule.prototype.constructor = CacheModule;
function needRebuild(buildTimestamp, fileDependencies, contextDependencies, fileTimestamps, contextTimestamps) {
  var timestamp = 0;
  fileDependencies.forEach(function(file) {
    var ts = fileTimestamps[file];
    if(!ts) timestamp = Infinity;
    if(ts > timestamp) timestamp = ts;
  });
  contextDependencies.forEach(function(context) {
    var ts = contextTimestamps[context];
    if(!ts) timestamp = Infinity;
    if(ts > timestamp) timestamp = ts;
  });
  return timestamp >= buildTimestamp;
}
CacheModule.prototype.needRebuild = function(fileTimestamps, contextTimestamps) {
  return needRebuild(this.buildTimestamp, this.fileDependencies, this.contextDependencies, fileTimestamps, contextTimestamps);
};

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
  var cacheDirPath = path.join(compiler.options.context, cacheDirName);
  var resolveCachePath = path.join(cacheDirPath, 'resolve.json');

  var resolveCache = {};
  var moduleCache = {};
  var moduleCacheLoading = [];

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
    mkdirp.sync(cacheDirPath);
    try {
      resolveCache = JSON.parse(fs.readFileSync(resolveCachePath, 'utf8'));
    }
    catch (e) {}
    var start = Date.now();

    moduleCacheLoading = [];

    async.each(fs.readdirSync(cacheDirPath), function(name, cb) {
      if (name === 'records.json') {return cb();}
      if (name === 'resolve.json') {return cb();}
      fs.readFile(path.join(cacheDirPath, name), 'utf8', function(err, json) {
        if (err) {return cb();}
        let subcache = JSON.parse(json);
        let key = Object.keys(subcache)[0];
        moduleCache[key] = subcache[key];
        cb();
      });
    }, function() {
      var loading = moduleCacheLoading;
      moduleCacheLoading = null;
      for (let i = 0; i < loading.length; i++) {
        loading[i]();
      }
      cb();
    });
  });

  compiler.plugin(['watch-run', 'run'], function(compiler, cb) {
    if (!active) {return cb();}

    if (!compiler.inputFileSystem) {
      // try {
      //   compiler.compiler.records = JSON.parse(fs.readFileSync(recordsPath, 'utf8'));
      // }
      // catch (e) {}
    }
    else {
      // compiler.recordsInputPath = compiler.recordsOutputPath = recordsPath;
    }

    if(!moduleCache.fileDependencies) return cb();
    // var fs = compiler.inputFileSystem;
    var fileTs = compiler.fileTimestamps = fileTimestamps = {};
    async.forEach(moduleCache.fileDependencies, function(file, callback) {
      fs.stat(file, function(err, stat) {
        if(err) {
          if(err.code === "ENOENT") return callback();
          return callback(err);
        }

        fileTs[file] = stat.mtime || Infinity;
        callback();
      });
    }, cb);
  });

  compiler.plugin('compilation', function(compilation, params) {
    if (!active) {return;}

    compilation.fileTimestamps = fileTimestamps;

    compilation.dependencyFactories.set(RawModuleDependency, params.normalModuleFactory);
    compilation.dependencyTemplates.set(RawModuleDependency, new RawModuleDependencyTemplate);

    compilation.dependencyFactories.set(ContextDependency, params.contextModuleFactory);
    compilation.dependencyTemplates.set(ContextDependency, new RawModuleDependencyTemplate);

    compilation.dependencyFactories.set(NullDependency, new NullFactory());
    compilation.dependencyTemplates.set(NullDependency, new NullDependencyTemplate);

    params.normalModuleFactory.plugin('resolver', function(fn) {
      return function(request, cb) {
        // if (request.request.indexOf('index.html') !== -1) {
        //   console.log('resolve cache', request.request);
        // }
        let cacheId = JSON.stringify([request.context, request.request]);
        if (resolveCache[cacheId]) {
          let result = resolveCache[cacheId];
          result.parser = compilation.compiler.parser;
          return cb(null, result);
        }

        var originalRequest = request;
        return fn.call(null, request, function(err, request) {
          if (err) {
            return cb(err);
          }
          if (!request.source) {
            resolveCache[JSON.stringify([request.context, request.rawRequest])] = Object.assign({}, request, {parser: null});
          }
          cb.apply(null, arguments);
        });
      };
    });

    params.normalModuleFactory.plugin('resolver', function(fn) {
      return function(request, cb) {
        fn.call(null, request, function(err, result) {
          if (err) {return cb(err);}
          // else if (moduleCacheLoading) {
          //   return moduleCacheLoading.push(function() {
          //     let cacheItem = moduleCache[result.request];
          //     if (!needRebuild(
          //       cacheItem.buildTimestamp,
          //       cacheItem.fileDependencies,
          //       // cacheItem.contextDependencies,
          //       [],
          //       fileTimestamps,
          //       compiler.contextTimestamps
          //     )) {
          //       let module = new CacheModule(cacheItem);
          //       return cb(null, module);
          //     }
          //     else {
          //       result.parser = compilation.compiler.parser;
          //       return cb(null, result);
          //     }
          //   });
          // }
          else if (moduleCache[result.request]) {
            let cacheItem = moduleCache[result.request];
            if (!needRebuild(
              cacheItem.buildTimestamp,
              cacheItem.fileDependencies,
              cacheItem.contextDependencies,
              // [],
              fileTimestamps,
              compiler.contextTimestamps
            )) {
              let module = new CacheModule(cacheItem);
              return cb(null, module);
            }
          }
          return cb(null, result);
        });
      };
    });
  });

  compiler.plugin('after-compile', function(compilation, cb) {
    if (!active) {return cb();}

    var startCacheTime = Date.now();
    fs.writeFileSync(resolveCachePath, JSON.stringify(resolveCache), 'utf8');

    function serializeDependencies(deps) {
      return deps
      .map(function(dep) {
        return {
          contextDependency: dep instanceof ContextDependency,
          constDependency: dep instanceof ConstDependency,
          request: dep.request,
          recursive: dep.recursive,
          regExp: dep.regExp ? dep.regExp.source : null,
        };
      })
      .filter(function(req) {
        return req.request || req.constDependency;
      });
    }

    moduleCache.fileDependencies = compilation.fileDependencies;
    fs.writeFileSync(
      path.join(cacheDirPath, 'file-dependencies.json'),
      JSON.stringify({fileDependencies: compilation.fileDependencies}),
      'utf8'
    );

    async.forEach(compilation.modules, function(module, cb) {
      if (module.request && module.cacheable && !(module instanceof CacheModule)) {
        moduleCache[module.request] = {
          moduleId: module.id,
          context: module.context,
          request: module.request,
          identifier: module.identifier(),
          assets: Object.keys(module.assets || {}).reduce(function(carry, key) {
            carry[key] = module.assets[key].source();
            return carry;
          }, {}),
          buildTimestamp: module.buildTimestamp,

          source: module.source(
            compilation.dependencyTemplates,
            compilation.moduleTemplate.outputOptions, 
            compilation.moduleTemplate.requestShortener
          ).source(),
          map: compiler.options.devTool && module.source(
            compilation.dependencyTemplates,
            compilation.moduleTemplate.outputOptions,
            compilation.moduleTemplate.requestShortener
          ).map(),

          dependencies: serializeDependencies(module.dependencies
          .concat(
            [].concat(module.variables.reduce(function(carry, variable) {
              carry.push.apply(carry, variable.dependencies);
              return carry;
            }, []))
          )),

          blocks: module.blocks
          .map(function(block) {
            return {
              async: block instanceof AsyncDependenciesBlock,
              name: block.chunkName,
              dependencies: serializeDependencies(block.dependencies),
            };
          }),

          variables: module.variables
          .map(function(variable) {
            return {
              dependencies: serializeDependencies(variable.dependencies),
            }
          }),

          fileDependencies: module.fileDependencies,
          contextDependencies: module.contextDependencies,
        };

        mkdirp.sync(cacheDirPath);
        var hashName = crypto.createHash('sha1')
        .update(module.request).digest().hexSlice();
        return fs.writeFile(
          path.join(cacheDirPath, hashName + '.json'),
          JSON.stringify({[module.request]: moduleCache[module.request]}),
          'utf8',
          cb
        );
      }
      cb();
    }, cb);
    //
    // console.log('cache out', Date.now() - startCacheTime);
    // cb();
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
