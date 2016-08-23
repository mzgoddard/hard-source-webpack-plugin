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

function HardModuleDependency(request) {
  ModuleDependency.call(this, request);
}
HardModuleDependency.prototype = Object.create(ModuleDependency.prototype);
HardModuleDependency.prototype.constructor = HardModuleDependency;

function HardContextDependency(request, recursive, regExp) {
  ContextDependency.call(this, request, recursive, regExp);
}
HardContextDependency.prototype = Object.create(ContextDependency.prototype);
HardContextDependency.prototype.constructor = HardContextDependency;

function HardNullDependency() {
  NullDependency.call(this);
}
HardNullDependency.prototype = Object.create(NullDependency.prototype);
HardNullDependency.prototype.constructor = HardNullDependency;

function HardModuleDependencyTemplate() {
}
HardModuleDependencyTemplate.prototype.apply = function() {};
HardModuleDependencyTemplate.prototype.applyAsTemplateArgument = function() {};

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

function HardSource(cacheItem) {
  RawSource.call(this, cacheItem.source);
  this.cacheItem = cacheItem;
}
HardSource.prototype = Object.create(RawSource.prototype);
HardSource.prototype.constructor = HardSource;

function chooseMap(options, cacheItem) {
  if (options && Object.keys(options).length) {
    return cacheItem.map;
  }
  else {
    return cacheItem.baseMap;
  }
}

HardSource.prototype.map = function(options) {
  return chooseMap(options, this.cacheItem);
};

// We need a function to help rehydrate source keys, webpack 1 uses source-map
// 0.4 which needs an appended $. webpack 2 uses source-map 0.5 which may append
// $. Either way setSourceContent will provide the needed behaviour. This is
// pretty round about and ugly but this is less prone to failure than trying to
// determine whether we're in webpack 1 or 2 and if they are using webpack-core
// or webpack-sources and the version of source-map in that.
var SourceNode_setSourceContent = new RawModule('')
.source().node().setSourceContent;

HardSource.prototype.node = function(options) {
  var node = SourceNode.fromStringWithSourceMap(
    this.cacheItem.source,
    new SourceMapConsumer(chooseMap(options, this.cacheItem))
  );
  var sources = Object.keys(node.sourceContents);
  for (var i = 0; i < sources.length; i++) {
    var key = sources[i];
    var content = node.sourceContents[key];
    delete node.sourceContents[key];
    SourceNode_setSourceContent.call(node, key, content);
  }
  return node;
};

HardSource.prototype.listMap = function(options) {
  return fromStringWithSourceMap(
    this.cacheItem.source,
    chooseMap(options, this.cacheItem)
  );
};

function HardModule(cacheItem) {
  RawModule.call(this, cacheItem.source, cacheItem.identifier, cacheItem.readableIdentifier);

  this.cacheItem = cacheItem;

  this.context = cacheItem.context;
  this.request = cacheItem.request;

  this.strict = cacheItem.strict;
  this.meta = cacheItem.meta;
  this.buildTimestamp = cacheItem.buildTimestamp;
  this.fileDependencies = cacheItem.fileDependencies;
  this.contextDependencies = cacheItem.contextDependencies;
}
HardModule.prototype = Object.create(RawModule.prototype);
HardModule.prototype.constructor = HardModule;

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
HardModule.prototype.needRebuild = function(fileTimestamps, contextTimestamps) {
  return needRebuild(this.buildTimestamp, this.fileDependencies, this.contextDependencies, fileTimestamps, contextTimestamps);
};

HardModule.prototype.source = function() {
  return this._renderedSource;
};

HardModule.prototype.updateHash = function(hash) {
  hash.update(this.cacheItem.hashContent);
};

HardModule.prototype.isUsed = function(exportName) {
  return exportName ? exportName : false;
};

HardModule.prototype.build = function build(options, compilation, resolver, fs, callback) {
  function deserializeDependencies(deps, parent) {
    return deps.map(function(req) {
      if (req.contextDependency) {
        return new HardContextDependency(req.request, req.recursive, req.regExp ? new RegExp(req.regExp) : null);
      }
      if (req.constDependency) {
        return new HardNullDependency();
      }
      if (req.harmonyExport) {
        return new HardHarmonyExportDependency(parent, req.harmonyId, req.harmonyName, req.harmonyPrecedence);
      }
      return new HardModuleDependency(req.request);
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

  // Non-rendered source used by Stats.
  if (this.cacheItem.rawSource) {
    this._source = new RawSource(this.cacheItem.rawSource);
  }
  // Rendered source used in built output.
  this._renderedSource = new HardSource(this.cacheItem);

  this.dependencies = deserializeDependencies(this.cacheItem.dependencies, this);
  this.variables = deserializeVariables(this.cacheItem.variables, this);
  deserializeBlocks(this.cacheItem.blocks, this);

  var cacheItem = this.cacheItem;
  this.assets = Object.keys(cacheItem.assets).reduce(function(carry, key) {
    var source = cacheItem.assets[key];
    if (source.type === 'Buffer') {
      source = new Buffer(source);
    }
    carry[key] = new RawSource(source);
    return carry;
  }, {});

  callback();
};

function requestHash(request) {
  return crypto.createHash('sha1').update(request).digest().hexSlice();
}

var fsReadFile = Promise.promisify(fs.readFile, {context: fs});
var fsReaddir = Promise.promisify(fs.readdir, {context: fs});
var fsStat = Promise.promisify(fs.stat, {context: fs});
var fsWriteFile = Promise.promisify(fs.writeFile, {context: fs});

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
            if (!needRebuild(
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
    var devtool = compiler.options.devtool || compiler.options.devTool;
    if(devtool && (devtool.indexOf("sourcemap") >= 0 || devtool.indexOf("source-map") >= 0)) {
      var hidden = devtool.indexOf("hidden") >= 0;
      var inline = devtool.indexOf("inline") >= 0;
      var evalWrapped = devtool.indexOf("eval") >= 0;
      var cheap = devtool.indexOf("cheap") >= 0;
      var moduleMaps = devtool.indexOf("module") >= 0;
      var noSources = devtool.indexOf("nosources") >= 0;
      var legacy = devtool.indexOf("@") >= 0;
      var modern = devtool.indexOf("#") >= 0;
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
