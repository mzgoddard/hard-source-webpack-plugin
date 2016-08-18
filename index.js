var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var mkdirp = require('mkdirp');
var async = require('async');

var AsyncDependenciesBlock = require('webpack/lib/AsyncDependenciesBlock');
var ConstDependency = require('webpack/lib/dependencies/ConstDependency');
var ContextDependency = require('webpack/lib/dependencies/ContextDependency');
var DependenciesBlockVariable = require('webpack/lib/DependenciesBlockVariable');
var ModuleDependency = require('webpack/lib/dependencies/ModuleDependency');
var NormalModule = require('webpack/lib/NormalModule');
var NullDependency = require('webpack/lib/dependencies/NullDependency');
var NullDependencyTemplate = require('webpack/lib/dependencies/NullDependencyTemplate');
var NullFactory = require('webpack/lib/NullFactory');
var RawModule = require('webpack/lib/RawModule');

var RawSource = require('webpack-sources').RawSource;
var Source = require('webpack-sources').Source;

var SourceNode = require('source-map').SourceNode;
var SourceMapConsumer = require('source-map').SourceMapConsumer;

var fromStringWithSourceMap = require('source-list-map').fromStringWithSourceMap;

function RawModuleDependency(request) {
  ModuleDependency.call(this, request);
}
RawModuleDependency.prototype = Object.create(ModuleDependency.prototype);
RawModuleDependency.prototype.constructor = RawModuleDependency;
function RawModuleDependencyTemplate() {
}
RawModuleDependencyTemplate.prototype.apply = function() {};
RawModuleDependencyTemplate.prototype.applyAsTemplateArgument = function() {};

function HardHarmonyExportDependency(originModule, id, name, precedence) {
  NullDependency.call(this);
  this.originModule = originModule;
  this.id = id;
  this.name = name;
  this.precedence = precedence;
}
HardHarmonyExportDependency.prototype = Object.create(ModuleDependency.prototype);
HardHarmonyExportDependency.prototype.constructor = HardHarmonyExportDependency;
HardHarmonyExportDependency.prototype.describeHarmonyExport = function() {
  return {
    exportedName: this.name,
    precedence: this.precedence,
  }
};

function CacheModule(cacheItem) {
  RawModule.call(this, cacheItem.source, cacheItem.identifier, cacheItem.identifier);

  this.context = cacheItem.context;
  this.request = cacheItem.request;
  // this.map = function() {return cacheItem.map;};
  var source = new RawSource(cacheItem.source);
  source.map = function() {
    return cacheItem.map;
  };
  source.node = function() {
    var node = SourceNode.fromStringWithSourceMap(
      cacheItem.source,
      new SourceMapConsumer(cacheItem.map)
    );
    // Rehydrate source keys, webpack 1 uses source-map 0.4 which needs an
    // appended $. webpack 2 uses source-map 0.5 which may append $. Either way
    // setSourceContent will provide the needed behaviour. This is pretty round
    // about and ugly but this is less prone to failure than trying to determine
    // whether we're in webpack 1 or 2 and if they are using webpack-core or
    // webpack-sources and the version of source-map in that.
    var setSourceContent = new RawModule('').source().node().setSourceContent;
    var sources = Object.keys(node.sourceContents);
    for (var i = 0; i < sources.length; i++) {
      var key = sources[i];
      var content = node.sourceContents[key];
      delete node.sourceContents[key];
      setSourceContent.call(node, key, content);
    }
    return node;
  };
  source.listMap = function() {
    return fromStringWithSourceMap(cacheItem.source, cacheItem.map);
  };
  this.source = function() {
    return source;
  };
  this.updateHash = function(hash) {
    hash.update(cacheItem.hashContent);
  };
  this.assets = Object.keys(cacheItem.assets).reduce(function(carry, key) {
    var source = cacheItem.assets[key];
    if (source.type === 'Buffer') {
      source = new Buffer(source);
    }
    carry[key] = new RawSource(source);
    return carry;
  }, {});
  this.isUsed = function(exportName) {
    return exportName ? exportName : false;
  };
  this.strict = cacheItem.strict;
  this.buildTimestamp = cacheItem.buildTimestamp;
  this.fileDependencies = cacheItem.fileDependencies;
  this.contextDependencies = cacheItem.contextDependencies;
  function deserializeDependencies(deps, parent) {
    return deps.map(function(req) {
      if (req.contextDependency) {
        return new ContextDependency(req.request, req.recursive, req.regExp ? new RegExp(req.regExp) : null);
      }
      if (req.constDependency) {
        return new NullDependency();
      }
      if (req.harmonyExport) {
        return new HardHarmonyExportDependency(parent, req.harmonyId, req.harmonyName, req.harmonyPrecedence);
      }
      return new RawModuleDependency(req.request);
    });
  }
  function deserializeVariables(vars, parent) {
    return vars.map(function(req) {
      return new DependenciesBlockVariable(req.name, req.expression, deserializeDependencies(req.dependencies, parent));
    });
  }
  function deserializeBlocks(blocks, parent) {
    blocks.map(function(req) {
      if (req.async) {
        var block = new AsyncDependenciesBlock(req.name, parent);
        block.dependencies = deserializeDependencies(req.dependencies, parent);
        block.variables = deserializeVariables(req.variables, parent);
        deserializeBlocks(req.blocks, block);
        return block;
      }
    })
    .filter(Boolean)
    .forEach(function(block) {
      parent.addBlock(block);
    });
  }
  this.dependencies = deserializeDependencies(cacheItem.dependencies, this);
  this.variables = deserializeVariables(cacheItem.variables, this);
  deserializeBlocks(cacheItem.blocks, this);
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
  var cacheDirPath = path.join(compiler.options.output.path, cacheDirName);
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
        var subcache = JSON.parse(json);
        var key = Object.keys(subcache)[0];
        moduleCache[key] = subcache[key];
        cb();
      });
    }, function() {
      var loading = moduleCacheLoading;
      moduleCacheLoading = null;
      for (var i = 0; i < loading.length; i++) {
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

    compilation.dependencyFactories.set(HardHarmonyExportDependency, new NullFactory());
    compilation.dependencyTemplates.set(HardHarmonyExportDependency, new NullDependencyTemplate);

    params.normalModuleFactory.plugin('resolver', function(fn) {
      return function(request, cb) {
        // if (request.request.indexOf('index.html') !== -1) {
        //   console.log('resolve cache', request.request);
        // }
        var cacheId = JSON.stringify([request.context, request.request]);
        if (resolveCache[cacheId]) {
          var result = Object.assign({}, resolveCache[cacheId]);
          result.dependencies = request.dependencies;
          result.parser = compilation.compiler.parser;
          return cb(null, result);
        }

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
    });

    params.normalModuleFactory.plugin('resolver', function(fn) {
      return function(request, cb) {
        fn.call(null, request, function(err, result) {
          if (err) {return cb(err);}
          // else if (moduleCacheLoading) {
          //   return moduleCacheLoading.push(function() {
          //     var cacheItem = moduleCache[result.request];
          //     if (!needRebuild(
          //       cacheItem.buildTimestamp,
          //       cacheItem.fileDependencies,
          //       // cacheItem.contextDependencies,
          //       [],
          //       fileTimestamps,
          //       compiler.contextTimestamps
          //     )) {
          //       var module = new CacheModule(cacheItem);
          //       return cb(null, module);
          //     }
          //     else {
          //       result.parser = compilation.compiler.parser;
          //       return cb(null, result);
          //     }
          //   });
          // }
          else if (moduleCache[result.request]) {
            var cacheItem = moduleCache[result.request];
            if (!needRebuild(
              cacheItem.buildTimestamp,
              cacheItem.fileDependencies,
              cacheItem.contextDependencies,
              // [],
              fileTimestamps,
              compiler.contextTimestamps
            )) {
              var module = new CacheModule(cacheItem);
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

  compiler.plugin('after-compile', function(compilation, cb) {
    if (!active) {return cb();}

    var startCacheTime = Date.now();
    fs.writeFileSync(resolveCachePath, JSON.stringify(resolveCache), 'utf8');

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

    var devtoolOptions;
  	if(compiler.options.devtool && (compiler.options.devtool.indexOf("sourcemap") >= 0 || compiler.options.devtool.indexOf("source-map") >= 0)) {
  		var hidden = compiler.options.devtool.indexOf("hidden") >= 0;
  		var inline = compiler.options.devtool.indexOf("inline") >= 0;
  		var evalWrapped = compiler.options.devtool.indexOf("eval") >= 0;
  		var cheap = compiler.options.devtool.indexOf("cheap") >= 0;
  		var moduleMaps = compiler.options.devtool.indexOf("module") >= 0;
  		var noSources = compiler.options.devtool.indexOf("nosources") >= 0;
  		var legacy = compiler.options.devtool.indexOf("@") >= 0;
  		var modern = compiler.options.devtool.indexOf("#") >= 0;
  		var comment = legacy && modern ? "\n/*\n//@ sourceMappingURL=[url]\n//# sourceMappingURL=[url]\n*/" :
  			legacy ? "\n/*\n//@ sourceMappingURL=[url]\n*/" :
  			modern ? "\n//# sourceMappingURL=[url]" :
  			null;
      devtoolOptions = {
  			filename: inline ? null : compiler.options.output.sourceMapFilename,
  			moduleFilenameTemplate: compiler.options.output.devtoolModuleFilenameTemplate,
  			fallbackModuleFilenameTemplate: compiler.options.output.devtoolFallbackModuleFilenameTemplate,
  			append: hidden ? false : comment,
  			module: moduleMaps ? true : cheap ? false : true,
  			columns: cheap ? false : true,
  			lineToLine: compiler.options.output.devtoolLineToLine,
  			noSources: noSources,
  		};
  	}

    moduleCache.fileDependencies = compilation.fileDependencies;
    fs.writeFileSync(
      path.join(cacheDirPath, 'file-dependencies.json'),
      JSON.stringify({fileDependencies: compilation.fileDependencies}),
      'utf8'
    );

    async.forEach(compilation.modules, function(module, cb) {
      if (module.request && module.cacheable && !(module instanceof CacheModule) && (module instanceof NormalModule)) {
        var source = module.source(
          compilation.dependencyTemplates,
          compilation.moduleTemplate.outputOptions, 
          compilation.moduleTemplate.requestShortener
        );
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
          strict: module.strict,

          source: source.source(),
          map: devtoolOptions && source.map(devtoolOptions),
          hashContent: serializeHashContent(module),

          dependencies: serializeDependencies(module.dependencies),
          variables: serializeVariables(module.variables),
          blocks: serializeBlocks(module.blocks),

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
