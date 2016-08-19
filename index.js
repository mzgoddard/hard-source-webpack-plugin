var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var async = require('async');
var level = require('level');
var lodash = require('lodash');
var mkdirp = require('mkdirp');

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
  // Non-rendered source used by Stats.
  if (cacheItem.rawSource) {
    this._source = new RawSource(cacheItem.rawSource);
  }
  // Rendered source used in built output.
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
  this.meta = cacheItem.meta;
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

function requestHash(request) {
  return crypto.createHash('sha1').update(request).digest().hexSlice();
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

    (function() {
      if (options.environmentPaths === false) {
        return Promise.resolve('');
      }
      else {
        return envHash(options.environmentPaths);
      }
    })()
    .then(function(hash) {
      fs.readFile(path.join(cacheDirPath, 'stamp'), 'utf8', function(err, stamp) {
        if (err) {
          stamp = '';
        }
        currentStamp = hash;
        if (hash && hash === stamp) {
          if (Object.keys(moduleCache).length) {return cb();}

          async.parallel([
            function(cb) {
              fs.readFile(resolveCachePath, 'utf8', function(err, resolveJson) {
                if (err) {return cb(err);}
                try {
                  resolveCache = JSON.parse(resolveJson);
                }
                catch (err) {
                  cb(err);
                }
                cb();
              });
            },
            function(cb) {
              async.each(fs.readdirSync(cacheAssetDirPath), function(name, cb) {
                fs.readFile(path.join(cacheAssetDirPath, name), function(err, asset) {
                  if (err) {return cb();}
                  assets[name] = asset;
                  cb();
                });
              }, cb);
            },
            function(cb) {
              var start = Date.now();
              level(path.join(cacheDirPath, 'modules'), function(err, db) {
                if (err) {return cb(err);}
                db.createReadStream()
                .on('data', function(data) {
                  var value = data.value;
                  if (!moduleCache[data.key]) {
                    moduleCache[data.key] = value;
                  }
                })
                .on('end', function() {
                  db.close(function(err) {
                    if (err) {return cb(err);}
                    // console.log('cache in - modules', Date.now() - start);
                    if (typeof moduleCache.fileDependencies === 'string') {
                      moduleCache.fileDependencies = JSON.parse(moduleCache.fileDependencies);
                    }
                    cb();
                  });
                });
              });
            },
          ], function() {
            // console.log('cache in', Date.now() - start);
            cb();
          });
        }
        else {
          if (hash && stamp) {
            console.error('Environment has changed (node_modules or configuration was updated).\nHardSourceWebpackPlugin will reset the cache and store a fresh one.');
          }

          // Reset the cache, we can't use it do to an environment change.
          resolveCache = {};
          moduleCache = {};
          assets = {};
          fileTimestamps = {};

          cb();
        }
      });
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

  var leveldbLock = Promise.resolve();

  // compiler.plugin('this-compilation', function() {
  //   leveldbLock = Promise.resolve();
  // });

  compiler.plugin('after-compile', function(compilation, cb) {
    if (!active) {return cb();}

    var startCacheTime = Date.now();

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
      if (module.request && module.cacheable && !(module instanceof CacheModule) && (module instanceof NormalModule)) {
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
          assets: Object.keys(module.assets || {}),
          buildTimestamp: module.buildTimestamp,
          strict: module.strict,
          meta: module.meta,

          rawSource: module._source ? module._source.source() : null,
          source: source.source(),
          map: devtoolOptions && source.map(devtoolOptions),
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

    async.parallel([
      function(cb) {
        fs.writeFile(path.join(cacheDirPath, 'stamp'), currentStamp, 'utf8', cb);
      },
      function(cb) {
        fs.writeFile(resolveCachePath, JSON.stringify(resolveCache), 'utf8', cb);
      },
      function(cb) {
        async.each(assetOps, function(asset, callback) {
          var assetPath = path.join(cacheAssetDirPath, asset[0]);
          fs.writeFile(
            assetPath,
            asset[1],
            callback
          );
        }, cb);
      },
      function(cb) {
        if (ops.length === 0) {
          return cb();
        }
        leveldbLock = leveldbLock
        .then(function() {
          return new Promise(function(resolve, reject) {
            level(path.join(cacheDirPath, 'modules'), {valueEncoding: 'json'}, function(err, db) {
              if (err) {return reject(err);}
              db.batch(ops, function(err) {
                if (err) {return reject(err);}
                db.close(function(err) {
                  if (err) {return reject(err);}
                  resolve();
                });
              });
            });
          });
        })
        .then(function() {cb();}, cb);
      },
    ], function() {
      // console.log('cache out', Date.now() - startCacheTime);
      cb();
    });
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
