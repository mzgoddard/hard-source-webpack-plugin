var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var level = require('level');
var lodash = require('lodash');
var mkdirp = require('mkdirp');
var Tapable = require('tapable');

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

var AMDDefineDependency = require('webpack/lib/dependencies/AMDDefineDependency');
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

var promisify = Promise.promisify;

var fsReadFile = Promise.promisify(fs.readFile, {context: fs});
var fsStat = Promise.promisify(fs.stat, {context: fs});
var fsWriteFile = Promise.promisify(fs.writeFile, {context: fs});

var NS, extractTextNS;

NS = fs.realpathSync(__dirname);

try {
  extractTextNS = path.dirname(require.resolve('extract-text-webpack-plugin'));
}
catch (_) {}

var cachePrefixNS = NS + '/cachePrefix';
var cachePrefixErrorOnce = true;

function cachePrefix(compilation) {
  if (typeof compilation[cachePrefixNS] === 'undefined') {
    var prefix = '';
    var nextCompilation = compilation;

    while (nextCompilation.compiler.parentCompilation) {
      var parentCompilation = nextCompilation.compiler.parentCompilation;
      if (!nextCompilation.cache) {
        if (cachePrefixErrorOnce) {
          cachePrefixErrorOnce = false;
          console.error([
            'A child compiler (' + compilation.compiler.name + ') does not',
            'have a memory cache. Enable a memory cache with webpack\'s',
            '`cache` configuration option. HardSourceWebpackPlugin will be',
            'disabled for this child compiler until then.',
          ].join('\n'));
        }
        prefix = null;
        break;
      }

      var cache = nextCompilation.cache;
      var parentCache = parentCompilation.cache;

      if (cache === parentCache) {
        nextCompilation = parentCompilation;
        continue;
      }

      var cacheKey;
      for (var key in parentCache) {
        if (key && parentCache[key] === cache) {
          cacheKey = key;
          break;
        }
      }

      if (!cacheKey) {
        if (cachePrefixErrorOnce) {
          cachePrefixErrorOnce = false;
          console.error([
            'A child compiler (' + compilation.compiler.name + ') has a',
            'memory cache but its cache name is unknown.',
            'HardSourceWebpackPlugin will be disabled for this child',
            'compiler.',
          ].join('\n'));
        }
        prefix = null;
        break;
      }
      else {
        prefix = cacheKey + prefix;
      }

      nextCompilation = parentCompilation;
    }

    compilation[cachePrefixNS] = prefix;
  }

  return compilation[cachePrefixNS];
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

function flattenPrototype(obj) {
  var copy = {};
  for (var key in obj) {
    copy[key] = obj[key];
  }
  return copy;
}

function CommonDependencyPlugin() {
}

CommonDependencyPlugin.prototype.apply = function(hardSource) {
  new CommonDependencyFreezePlugin().apply(hardSource);
  new CommonDependencyThawPlugin().apply(hardSource);

  hardSource.plugin('compiler', function(compiler) {
    compiler.plugin('compilation', function(compilation, params) {
      compilation.dependencyFactories.set(HardModuleDependency, params.normalModuleFactory);
      compilation.dependencyTemplates.set(HardModuleDependency, new NullDependencyTemplate);

      compilation.dependencyFactories.set(HardContextDependency, params.contextModuleFactory);
      compilation.dependencyTemplates.set(HardContextDependency, new NullDependencyTemplate);

      compilation.dependencyFactories.set(HardNullDependency, new NullFactory());
      compilation.dependencyTemplates.set(HardNullDependency, new NullDependencyTemplate);
    });
  });
};

function CommonDependencyFreezePlugin() {
}

CommonDependencyFreezePlugin.prototype.apply = function(hardSource) {
  hardSource.plugin('freeze-dependency', function(carry, dep) {
    if (dep instanceof ContextDependency) {
      return {
        contextDependency: dep instanceof ContextDependency,
        contextCritical: dep.critical,
        request: dep.request,
        recursive: dep.recursive,
        regExp: dep.regExp ? dep.regExp.source : null,
        loc: flattenPrototype(dep.loc),
      };
    }
    if (
      dep instanceof ConstDependency ||
      dep instanceof AMDDefineDependency
    ) {
      return {
        constDependency: true,
      };
    }
    if (dep.request) {
      return {
        request: dep.request,
        loc: flattenPrototype(dep.loc),
      };
    }
    return carry;
  });
};

function CommonDependencyThawPlugin() {
}

CommonDependencyThawPlugin.prototype.apply = function(hardSource) {
  hardSource.plugin('thaw-dependency', function(carry, req) {
    if (req.contextDependency) {
      var dep = new HardContextDependency(req.request, req.recursive, req.regExp ? new RegExp(req.regExp) : null);
      dep.critical = req.contextCritical;
      dep.loc = req.loc;
      return dep;
    }
    if (req.constDependency) {
      return new HardNullDependency();
    }

    var dep = new HardModuleDependency(req.request);
    dep.loc = req.loc;
    return dep;
  });
};

function HarmonyDependencyPlugin() {}

HarmonyDependencyPlugin.prototype.apply = function(hardSource) {
  new HarmonyDependencyFreezePlugin().apply(hardSource);
  new HarmonyDependencyThawPlugin().apply(hardSource);

  hardSource.plugin('compiler', function(compiler) {
    compiler.plugin('compilation', function(compilation, params) {
      compilation.dependencyFactories.set(HardHarmonyExportDependency, new NullFactory());
      compilation.dependencyTemplates.set(HardHarmonyExportDependency, new NullDependencyTemplate);

      compilation.dependencyFactories.set(HardHarmonyImportDependency, params.normalModuleFactory);
      compilation.dependencyTemplates.set(HardHarmonyImportDependency, new NullDependencyTemplate);

      compilation.dependencyFactories.set(HardHarmonyImportSpecifierDependency, new NullFactory());
      compilation.dependencyTemplates.set(HardHarmonyImportSpecifierDependency, new NullDependencyTemplate);

      compilation.dependencyFactories.set(HardHarmonyExportImportedSpecifierDependency, new NullFactory());
      compilation.dependencyTemplates.set(HardHarmonyExportImportedSpecifierDependency, new NullDependencyTemplate);
    });
  });
};

function HarmonyDependencyFreezePlugin() {
}

HarmonyDependencyFreezePlugin.prototype.apply = function(hardSource) {
  if (typeof HarmonyImportDependency === 'undefined') {
    return;
  }

  hardSource.plugin('freeze-dependency', function(carry, dep) {
    if (dep instanceof HarmonyImportDependency) {
      return {
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
        loc: dep.loc,
      };
    }
    if (dep.originModule) {
      return {
        harmonyExport: true,
        harmonyId: dep.id,
        harmonyName: dep.describeHarmonyExport().exportedName,
        harmonyPrecedence: dep.describeHarmonyExport().precedence,
      };
    }
    return carry;
  });
}

function HarmonyDependencyThawPlugin() {
}

HarmonyDependencyThawPlugin.prototype.apply = function(hardSource) {
  if (typeof HarmonyImportDependency === 'undefined') {
    return;
  }

  hardSource.plugin('thaw-dependency', function(carry, req, state) {
    if (req.harmonyExport) {
      return new HardHarmonyExportDependency(state.parent, req.harmonyId, req.harmonyName, req.harmonyPrecedence);
    }
    if (req.harmonyImport) {
      if (state.imports[req.request]) {
        return state.imports[req.request];
      }
      return state.imports[req.request] = new HardHarmonyImportDependency(req.request);
    }
    if (req.harmonyImportSpecifier) {
      var dep = new HardHarmonyImportSpecifierDependency(state.imports[req.harmonyRequest], req.harmonyId, req.harmonyName);
      dep.loc = req.loc;
      return dep;
    }
    if (req.harmonyExportImportedSpecifier) {
      if (!state.imports[req.harmonyRequest]) {
        state.imports[req.harmonyRequest] = new HardHarmonyImportDependency(req.harmonyRequest);
      }
      return new HardHarmonyExportImportedSpecifierDependency(state.parent, state.imports[req.harmonyRequest], req.harmonyId, req.harmonyName);
    }
    return carry;
  });
};

var CachePluginHelper = {
  thawObjectCache: function(cache) {
    Object.keys(cache).forEach(function(key) {
      if (typeof cache[key] === 'string') {
        cache[key] = JSON.parse(cache[key]);
      }
    });
  },

  writeObjectCache: function(cache, out, serializer, cb) {
    Object.keys(cache).forEach(function(key) {
      if (!cache[key] && !out[key]) {
        out[key] = null;
        delete cache[key];
      }
    });

    var ops = [];
    Object.keys(out).forEach(function(key) {
      var data = out[key];
      cache[key] = data;
      if (data) {
        ops.push({
          key: key,
          value: JSON.stringify(data),
        });
      }
      else {
        ops.push({
          key: key,
          value: null,
        });
      }
    });

    serializer.write(ops)
    .then(function() {cb();}, cb);
  },

  writeBufferCache: function(cache, out, serializer, cb) {
    Object.keys(cache).forEach(function(key) {
      if (!cache[key] && !out[key]) {
        out[key] = null;
        delete cache[key];
      }
    });

    var ops = [];
    Object.keys(out).forEach(function(key) {
      var data = out[key];
      cache[key] = data;
      if (data) {
        ops.push({
          key: key,
          value: data,
        });
      }
      else {
        ops.push({
          key: key,
          value: null,
        });
      }
    });

    serializer.write(ops)
    .then(function() {cb();}, cb);
  },
};

function AssetCachePlugin() {}

var AssetCachePluginNamespace = '__hardSourceAssetCachePlugin';

AssetCachePlugin.getCache = function(hardSource) {
  return hardSource[AssetCachePluginNamespace].cache;
};

AssetCachePlugin.prototype.apply = function(hardSource) {
  if (hardSource[AssetCachePluginNamespace]) {return;}

  hardSource[AssetCachePluginNamespace] = this;

  var _this = this;

  var cache = this.cache = {};
  var serializer;

  hardSource.plugin('create-cache', function() {
    serializer = new FileSerializer({
      cacheDirPath: hardSource.getCachePath('assets'),
    });
  });

  hardSource.plugin('reset', function() {
    cache = _this.cache = {};
  });

  hardSource.plugin('read-cache', function(cb) {
    serializer.read()
    .then(function(_cache) {
      cache = _this.cache = _cache;
    })
    .then(function() {cb();}, cb);
  });

  hardSource.plugin('thaw-cache', function() {
    hardSource.applyPlugins('thaw-asset-data', cache);
  });

  hardSource.plugin('freeze-cache', function(compilation) {
    var out = {};
    hardSource.applyPlugins('freeze-asset-data', out, compilation);
    compilation.__hardSourceAssetCacheOut = out;
  });

  hardSource.plugin('write-cache', function(compilation, cb) {
    var out = compilation.__hardSourceAssetCacheOut;

    CachePluginHelper.writeBufferCache(cache, out, serializer, cb);
  });
};

function DataCachePlugin() {}

var DataCachePluginNamespace = '__hardSourceDataCachePlugin';

DataCachePlugin.getCache = function(hardSource) {
  return hardSource[DataCachePluginNamespace].cache;
};

DataCachePlugin.prototype.apply = function(hardSource) {
  if (hardSource[DataCachePluginNamespace]) {return;}

  hardSource[DataCachePluginNamespace] = this;

  var _this = this;

  var cache = this.cache = {};
  var serializer;

  hardSource.plugin('create-cache', function() {
    serializer = new LevelDbSerializer({
      cacheDirPath: hardSource.getCachePath('data'),
    });
  });

  hardSource.plugin('reset', function() {
    cache = _this.cache = {};
  });

  hardSource.plugin('read-cache', function(cb) {
    serializer.read()
    .then(function(_cache) {
      cache = _this.cache = _cache;
    })
    .then(function() {cb();}, cb);
  });

  hardSource.plugin('thaw-cache', function() {
    CachePluginHelper.thawObjectCache(cache);

    hardSource.applyPlugins('thaw-compilation-data', cache);
  });

  hardSource.plugin('freeze-cache', function(compilation) {
    var out = {};
    hardSource.applyPlugins('freeze-compilation-data', out, compilation);
    compilation.__hardSourceDataCacheOut = out;
  });

  hardSource.plugin('write-cache', function(compilation, cb) {
    var out = compilation.__hardSourceDataCacheOut;

    CachePluginHelper.writeObjectCache(cache, out, serializer, cb);
  });
};

function ModuleCachePlugin() {
}

var ModuleCachePluginNamespace = '__hardSourceModuleCachePlugin';

ModuleCachePlugin.getCache = function(hardSource) {
  return hardSource[ModuleCachePluginNamespace].cache;
};

ModuleCachePlugin.prototype.apply = function(hardSource) {
  if (hardSource[ModuleCachePluginNamespace]) {return;}

  hardSource[ModuleCachePluginNamespace] = this;

  var _this = this;

  var cache = this.cache = {};
  var serializer;

  hardSource.plugin('create-cache', function() {
    serializer = new LevelDbSerializer({
      cacheDirPath: hardSource.getCachePath('modules'),
    });
  });

  hardSource.plugin('reset', function() {
    cache = _this.cache = {};
  });

  hardSource.plugin('read-cache', function(cb) {
    serializer.read()
    .then(function(_cache) {
      cache = _this.cache = _cache;
    })
    .then(function() {cb();}, cb);
  });

  hardSource.plugin('thaw-cache', function() {
    CachePluginHelper.thawObjectCache(cache);

    hardSource.applyPlugins('thaw-module-data', cache);
  });

  hardSource.plugin('freeze-cache', function(compilation) {
    var moduleOut = {};
    hardSource.applyPlugins('freeze-module-data', moduleOut, compilation);
    compilation.__hardSourceModuleCacheOut = moduleOut;
  });

  hardSource.plugin('write-cache', function(compilation, cb) {
    var moduleOut = compilation.__hardSourceModuleCacheOut;

    CachePluginHelper.writeObjectCache(cache, moduleOut, serializer, cb);
  });
};

function NormalModuleFreezePlugin() {
}

NormalModuleFreezePlugin.prototype.apply = function(hardSource) {
  new ModuleCachePlugin().apply(hardSource);

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
  function serializeDependencies(deps) {
    return deps
    .map(function(dep) {
      return hardSource.applyPluginsWaterfall('freeze-dependency', null, dep);
    })
    .filter(Boolean);
    // .filter(function(req) {
    //   return req.request || req.constDependency || req.harmonyExport || req.harmonyImportSpecifier || req.harmonyExportImportedSpecifier;
    // });
  }
  function serializeVariables(vars) {
    return vars.map(function(variable) {
      return {
        name: variable.name,
        expression: variable.expression,
        dependencies: serializeDependencies.call(hardSource, variable.dependencies),
      }
    });
  }
  function serializeBlocks(blocks) {
    return blocks.map(function(block) {
      return {
        async: block instanceof AsyncDependenciesBlock,
        name: block.chunkName,
        dependencies: serializeDependencies.call(hardSource, block.dependencies),
        variables: serializeVariables.call(hardSource, block.variables),
        blocks: serializeBlocks.call(hardSource, block.blocks),
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

  hardSource.plugin('freeze-module-data', function(moduleOut, compilation) {
    compilation.modules.forEach(function(module) {
      var devtoolOptions = hardSource.getDevtoolOptions();

      var identifierPrefix = cachePrefix(compilation);
      if (identifierPrefix === null) {
        return;
      }
      var identifier = identifierPrefix + module.identifier();

      var existingCacheItem = ModuleCachePlugin.getCache(hardSource)[identifier];

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
        moduleOut[identifier] = {
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
        if (module[extractTextNS] || module.meta[extractTextNS]) {
          delete moduleOut[identifier];
          return;
        }
      }
    });
  });

  hardSource.plugin('freeze-asset-data', function(assetOut, compilation) {
    compilation.modules.forEach(function(module, cb) {
      var identifierPrefix = cachePrefix(compilation);
      if (identifierPrefix === null) {
        return;
      }
      var identifier = identifierPrefix + module.identifier();

      var existingCacheItem = ModuleCachePlugin.getCache(hardSource)[identifier];

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
        if (module.assets) {
          Object.keys(module.assets).forEach(function(key) {
            var asset = module.assets[key];
            var frozen = asset.source();
            var frozenKey = requestHash(key);

            assetOut[frozenKey] = frozen;
          });
        }
      }
    });
  });
};

function NormalModuleThawPlugin() {}

NormalModuleThawPlugin.prototype.apply = function(hardSource) {
  new FileTimestampPlugin().apply(hardSource);
  new ModuleCachePlugin().apply(hardSource);
  new AssetCachePlugin().apply(hardSource);

  hardSource.plugin('compiler', function(compiler) {
    compiler.plugin('compilation', function(compilation, params) {
      var fileTimestamps = FileTimestampPlugin.getStamps(hardSource);
      var assetCache = AssetCachePlugin.getCache(hardSource);
      var moduleCache = ModuleCachePlugin.getCache(hardSource);

      params.normalModuleFactory.plugin('resolver', function(fn) {
        return function(request, cb) {
          fn.call(null, request, function(err, result) {
            if (err) {return cb(err);}

            var identifierPrefix = cachePrefix(compilation);
            if (identifierPrefix === null) {
              return cb(err, result);
            }
            var identifier = identifierPrefix + result.request;

            if (moduleCache[identifier]) {
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
                cacheItem.buildTimestamp,
                cacheItem.fileDependencies,
                cacheItem.contextDependencies,
                // [],
                fileTimestamps,
                compiler.contextTimestamps
              )) {
                var module = new HardModule(cacheItem);
                module[extractTextNS] = cacheItem.extractTextPluginMeta;
                return cb(null, module);
              }
            }
            return cb(null, result);
          });
        };
      });
    });
  });
};

function FileDependenciesPlugin() {}

var FileDependenciesPluginNamespace = '__fileDependenciesPlugin_' + Date.now();

FileDependenciesPlugin.getDependencies = function(hardSource) {
  return hardSource[FileDependenciesPluginNamespace].dependencies || [];
};

FileDependenciesPlugin.prototype.apply = function(hardSource) {
  if (hardSource[FileDependenciesPluginNamespace]) {return;}

  var _this = hardSource[FileDependenciesPluginNamespace] = this;

  new DataCachePlugin().apply(hardSource);

  _this.dependencies = [];

  hardSource.plugin('reset', function() {
    _this.dependencies = [];
  });

  hardSource.plugin('thaw-compilation-data', function(dataCache) {
    _this.dependencies = dataCache.fileDependencies;
  });

  hardSource.plugin('freeze-compilation-data', function(out, compilation) {
    var fileDependenciesDiff = lodash.difference(
      compilation.fileDependencies,
      _this.dependencies || []
    );
    if (fileDependenciesDiff.length) {
      _this.dependencies = (_this.dependencies || [])
      .concat(fileDependenciesDiff);

      out.fileDependencies = _this.dependencies;
    }
  });
};

function FileTimestampPlugin() {}

var FileTimestampPluginNamespace = '__fileTimestampPlugin_' + Date.now();

FileTimestampPlugin.getStamps = function(hardSource) {
  return hardSource[FileTimestampPluginNamespace].fileTimestamps;
};

FileTimestampPlugin.prototype.apply = function(hardSource) {
  if (hardSource[FileTimestampPluginNamespace]) {return;}

  var _this = hardSource[FileTimestampPluginNamespace] = this;

  new FileDependenciesPlugin().apply(hardSource);

  _this.fileTimestamps = {};

  var compiler;

  hardSource.plugin('reset', function() {
    _this.fileTimestamps = {};
  });

  hardSource.plugin('compiler', function(_compiler) {
    compiler = _compiler;

    compiler.plugin('compilation', function(compilation) {
      compilation.fileTimestamps = _this.fileTimestamps;
    });
  });

  hardSource.plugin('before-dependency-bust', function(cb) {
    // if(!this.cache.data.fileDependencies) return cb();
    // var fs = compiler.inputFileSystem;
    var fileTs = compiler.fileTimestamps = _this.fileTimestamps = {};
    var fileDependencies = FileDependenciesPlugin.getDependencies(hardSource);

    return Promise.all((fileDependencies).map(function(file) {
      return fsStat(file)
      .then(function(stat) {
        fileTs[file] = stat.mtime || Infinity;
      }, function(err) {
        fileTs[file] = 0;

        if (err.code === "ENOENT") {return;}
        throw err;
      });
    }))
    .then(function() {cb();}, cb);
  });
};

function ResolveCachePlugin() {}

var ResolveCachePluginNamespace = '__resolveCachePlugin_' + Date.now();

ResolveCachePlugin.getCache = function(hardSource) {
  return hardSource[ResolveCachePluginNamespace].resolveCache;
};

ResolveCachePlugin.prototype.apply = function(hardSource) {
  if (hardSource[ResolveCachePluginNamespace]) {return;}

  hardSource[ResolveCachePluginNamespace] = this;

  new FileTimestampPlugin().apply(hardSource);

  var resolveCache = this.resolveCache = {};
  var serializer;

  var _this = this;

  hardSource.plugin('create-cache', function() {
    serializer = new LevelDbSerializer({
      cacheDirPath: hardSource.getCachePath('resolve'),
    });
  });

  hardSource.plugin('read-cache', function(cb) {
    serializer.read()
    .then(function(_cache) {
      resolveCache = _this.resolveCache = _cache;
    })
    .then(function() {cb();}, cb);
  });

  hardSource.plugin('thaw-cache', function() {
    CachePluginHelper.thawObjectCache(resolveCache);
  });

  hardSource.plugin('write-cache', function(compilation, cb) {
    var resolveOut = compilation.__hardSourceResolveCachePluginChanges;

    CachePluginHelper.writeObjectCache(resolveCache, resolveOut, serializer, cb);
  });

  hardSource.plugin('reset', function() {
    resolveCache = _this.resolveCache = {};
  });

  // hardSource.plugin('thaw-compilation-data', function(dataCache) {
  //   resolveCache = _this.resolveCache = dataCache.resolve;
  // });
  //
  // hardSource.plugin('freeze-compilation-data', function(dataOut) {
  //   dataOut.resolve = resolveCache;
  // });

  hardSource.plugin('compiler', function(compiler) {
    compiler.plugin('compilation', function(compilation, params) {
      var fileTimestamps = FileTimestampPlugin.getStamps(hardSource);

      compilation.__hardSourceResolveCachePluginChanges = {};

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
                compilation.__hardSourceResolveCachePluginChanges[cacheId] = resolveCache[cacheId];
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

          if (resolveCache[cacheId]) {
            var userRequest = resolveCache[cacheId].userRequest;
            if (fileTimestamps[userRequest]) {
              return fromCache();
            }
            return fs.stat(userRequest, function(err) {
              if (!err) {
                return fromCache();
              }

              resolveCache[cacheId] = null;
              compilation.__hardSourceResolveCachePluginChanges[cacheId] = null;
              next();
            });
          }

          next();
        };
      });
    });
  });
};

function BustModuleByDependencyPlugin() {}

BustModuleByDependencyPlugin.prototype.apply = function(hardSource) {
  new FileTimestampPlugin().apply(hardSource);
  new ModuleCachePlugin().apply(hardSource);

  hardSource.plugin('dependency-bust', function() {
    var moduleCache = ModuleCachePlugin.getCache(hardSource);

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
    var fileTs = FileTimestampPlugin.getStamps(hardSource);
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
        validDepends = validDepends &&
        hardSource.applyPluginsBailResult('check-dependency', cacheDependency, cacheItem) !== false;
      });
      if (!validDepends) {
        cacheItem.invalid = true;
        moduleCache[key] = null;
      }
    });
  });
}

function CheckDependencyCanResolvePlugin() {
}

CheckDependencyCanResolvePlugin.prototype.apply = function(hardSource) {
  new FileTimestampPlugin().apply(hardSource);
  new ResolveCachePlugin().apply(hardSource);

  var fileTs, resolveCache;

  hardSource.plugin('before-dependency-bust', function(cb) {
    fileTs = null;
    resolveCache = null;
    cb();
  });

  hardSource.plugin('check-dependency', function(cacheDependency, cacheItem) {
    if (!fileTs) {
      fileTs = FileTimestampPlugin.getStamps(hardSource);
    }
    if (!resolveCache || Object.keys(resolveCache).length === 0) {
      resolveCache = ResolveCachePlugin.getCache(hardSource);
    }

    if (
      cacheDependency.contextDependency ||
      typeof cacheDependency.request === 'undefined'
    ) {
      return;
    }

    var resolveId = JSON.stringify(
      [cacheItem.context, cacheDependency.request]
    );
    var resolveItem = resolveCache[resolveId];
    if (
      !resolveItem ||
      !resolveItem.userRequest ||
      fileTs[resolveItem.userRequest] === 0
    ) {
      return false;
    }
  });
};

function BustModulePlugin() {}

BustModulePlugin.prototype.apply = function(hardSource) {
  new ModuleCachePlugin().apply(hardSource);

  hardSource.plugin('module-bust', function() {
    var moduleCache = ModuleCachePlugin.getCache(hardSource);

    Object.keys(moduleCache).forEach(function(key) {
      var cacheItem = moduleCache[key];
      if (cacheItem) {
        if (hardSource.applyPluginsBailResult1('check-module', cacheItem) === false) {
          cacheItem.invalid = true;
          moduleCache[key] = null;
        }
      }
    });
  });
};

function CheckModuleUsedFlagPlugin() {
}

CheckModuleUsedFlagPlugin.prototype.apply = function(hardSource) {
  if (!NormalModule.prototype.isUsed) {return;}

  new ModuleCachePlugin().apply(hardSource);

  var _modules;
  function modules() {
    if (_modules) {return _modules;}

    var compilation = PreemptCompilerPlugin.getCompilation(hardSource);
    _modules = {};
    compilation.modules.forEach(function(module) {
      if (!(module instanceof HardModule)) {
        return;
      }

      _modules[module.identifier()] = module;
    });
    return _modules;
  }

  var needRebuild = false;

  hardSource.plugin('compiler', function(compiler) {
    compiler.plugin('compilation', function(compilation) {
      var _modules;
      function modules() {
        if (_modules) {return _modules;}

        _modules = {};
        compilation.modules.forEach(function(module) {
          if (!(module instanceof HardModule)) {
            return;
          }

          _modules[module.identifier()] = module;
        });
        return _modules;
      }

      var needAdditionalPass;

      compilation.plugin('after-seal', function(cb) {
        var moduleCache = ModuleCachePlugin.getCache(hardSource);
        needAdditionalPass = compilation.modules.reduce(function(carry, module) {

          var identifierPrefix = cachePrefix(compilation);
          if (identifierPrefix === null) {
            return;
          }
          var identifier = identifierPrefix + module.request;

          var cacheItem = moduleCache[identifier];
          // var module = modules()[cacheItem.identifier];
          if (cacheItem && (
            !lodash.isEqual(cacheItem.used, module.used) ||
            !lodash.isEqual(cacheItem.usedExports, module.usedExports)
          )) {
            cacheItem.invalid = true;

            moduleCache[identifier] = null;
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
    });
  });
};

function HardSourceWebpackPlugin(options) {
  Tapable.call(this);
  this.options = options;

  new CommonDependencyPlugin().apply(this);
  new HarmonyDependencyPlugin().apply(this);

  new FileTimestampPlugin().apply(this);
  new ResolveCachePlugin().apply(this);
  new BustModuleByDependencyPlugin().apply(this);
  new CheckDependencyCanResolvePlugin().apply(this);
  new BustModulePlugin().apply(this);
  new CheckModuleUsedFlagPlugin().apply(this);

  new NormalModuleFreezePlugin().apply(this);
  new NormalModuleThawPlugin().apply(this);

  this.apply = this.apply.bind(this);
}

module.exports = HardSourceWebpackPlugin;

HardSourceWebpackPlugin.prototype = Object.create(Tapable.prototype);
HardSourceWebpackPlugin.prototype.constructor = HardSourceWebpackPlugin;

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

HardSourceWebpackPlugin.prototype.applyPluginsPromise = function(name, args) {
  return Promise.promisify(this.applyPluginsAsync).apply(this, arguments);
};

HardSourceWebpackPlugin.prototype.applyPluginsParallelPromise = function(name, args) {
  return Promise.promisify(this.applyPluginsParallel).apply(this, arguments);
};

HardSourceWebpackPlugin.prototype.getModuleCache = function() {
  return this.moduleCache;
};

HardSourceWebpackPlugin.prototype.getAssetCache = function() {
  return this.assetCache;
};

HardSourceWebpackPlugin.prototype.getDataCache = function() {
  return this.dataCache;
};

HardSourceWebpackPlugin.prototype.getDevtoolOptions = function() {
  return this.devtoolOptions;
};

HardSourceWebpackPlugin.prototype.apply = function(compiler) {
  var _this = this;
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

  _this.applyPlugins('create-cache');

  // var moduleCache = this.moduleCache = {};
  var assetCache = this.assetCache = {};
  // var dataCache = this.dataCache = {};
  var currentStamp = '';

  var fileTimestamps = {};

  _this.applyPlugins('create-cache-serializer');

  // var assetCacheSerializer = this.assetCacheSerializer =
  //   new FileSerializer({cacheDirPath: path.join(cacheDirPath, 'assets')});
  // var moduleCacheSerializer = this.moduleCacheSerializer =
  //   new LevelDbSerializer({cacheDirPath: path.join(cacheDirPath, 'modules')});
  // var dataCacheSerializer = this.dataCacheSerializer =
  //   new LevelDbSerializer({cacheDirPath: path.join(cacheDirPath, 'data')});

  _this.applyPlugins('compiler', compiler);

  compiler.plugin('after-plugins', function() {
    if (
      !compiler.recordsInputPath || !compiler.recordsOutputPath
    ) {
      console.error('HardSourceWebpackPlugin requires recordsPath to be set.');
      active = false;
    }
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

      if (!configHashInDirectory && options.configHash) {
        hash += '_' + _this.configHash;
      }

      currentStamp = hash;
      if (!hash || hash !== stamp) {
        if (hash && stamp) {
          console.error('Environment has changed (node_modules or configuration was updated).\nHardSourceWebpackPlugin will reset the cache and store a fresh one.');
        }

        // Reset the cache, we can't use it do to an environment change.
        _this.applyPlugins('reset');
        // moduleCache = _this.moduleCache = {};
        // assetCache = _this.assetCache = {};
        // dataCache = _this.dataCache = {};
        return;
      }

      // if (Object.keys(moduleCache).length) {return Promise.resolve();}

      return _this.applyPluginsParallelPromise('read-cache')
      .then(function() {
        return _this.applyPlugins('thaw-cache');
      })
      // .then(function() {
      //   return Promise.all([
      //     assetCacheSerializer.read()
      //     .then(function(_assetCache) {assetCache = _this.assetCache = _assetCache;})
      //     .then(function() {
      //       _this.applyPlugins('thaw-asset-data', assetCache);
      //     }),
      //   ]);
      // })
      .then(function() {
        // console.log('cache in', Date.now() - start);
      });
    })
    .then(cb, cb);
  });

  compiler.plugin(['watch-run', 'run'], function(compiler, cb) {
    if (!active) {return cb();}

    return Promise.resolve()
    .then(function() {return _this.applyPluginsPromise('before-dependency-bust');})
    .then(function() {return _this.applyPlugins('dependency-bust');})
    .then(function() {return _this.applyPluginsPromise('after-dependency-bust');})
    .then(function() {return _this.applyPluginsPromise('before-module-bust');})
    .then(function() {return _this.applyPlugins('module-bust');})
    .then(function() {return _this.applyPluginsPromise('after-module-bust');})
    .then(function() {cb();}, cb);
  });

  compiler.plugin('compilation', function(compilation, params) {
    if (!active) {return;}

    compilation.__hardSource = _this;

    fileTimestamps = FileTimestampPlugin.getStamps(_this);

    // var needAdditionalPass;
    //
    // compilation.plugin('after-seal', function(cb) {
    //   needAdditionalPass = compilation.modules.reduce(function(carry, module) {
    //     var cacheItem = moduleCache[module.identifier()];
    //     if (cacheItem && (
    //       !lodash.isEqual(cacheItem.used, module.used) ||
    //       !lodash.isEqual(cacheItem.usedExports, module.usedExports)
    //     )) {
    //       cacheItem.invalid = true;
    //       moduleCache[module.request] = null;
    //       return true;
    //     }
    //     return carry;
    //   }, false);
    //   cb();
    // });
    //
    // compilation.plugin('need-additional-pass', function() {
    //   if (needAdditionalPass) {
    //     needAdditionalPass = false;
    //     return true;
    //   }
    // });
  });

  compiler.plugin('after-compile', function(compilation, cb) {
    if (!active) {return cb();}

    var startCacheTime = Date.now();

    var devtoolOptions = _this.devtoolOptions = makeDevtoolOptions(compiler.options);

    var moduleOps = [];
    var dataOps = [];
    var assetOps = [];

    _this.applyPlugins('freeze-cache', compilation);

    return Promise.all([
      fsWriteFile(path.join(cacheDirPath, 'stamp'), currentStamp, 'utf8'),
      _this.applyPluginsParallelPromise('write-cache', compilation),
      // assetCacheSerializer.write(assetOps),
      // moduleCacheSerializer.write(moduleOps),
      // dataCacheSerializer.write(dataOps),
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
