var NormalModule = require('webpack/lib/NormalModule');

var HardModule = require('./hard-module');

var cachePrefix = require('./util').cachePrefix;

function wrapSource(source, methods) {
  Object.keys(methods).forEach(function(key) {
    var _method = source[key];
    source[key] = function() {
      methods[key].apply(this, arguments);
      _method && _method.apply(this, arguments);
    };
  });
  return source;
}

function spyMethod(name, mods) {
  return function() {
    mods.push([name].concat([].slice.call(arguments)));
  };
}

function isEqual(a, b) {
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    return a.reduce(function(carry, value, index) {
      return carry && isEqual(value, b[index]);
    }, true);
  }
  else if (a === b) {
    return true;
  }
  return false;
}

function HardModuleConcatenationPlugin() {}

HardModuleConcatenationPlugin.prototype.apply = function(compiler) {
  var store, freeze;

  compiler.plugin('--hard-source-methods', function(methods) {
    store = methods.store;
    // fetch = methods.fetch;
    freeze = methods.freeze;
    // thaw = methods.thaw;
    // mapFreeze = methods.mapFreeze;
    // mapThaw = methods.mapThaw;
  });

  var needAdditionalPass = false;

  compiler.plugin('compilation', function(compilation) {
    compilation.plugin('before-chunk-assets', function() {
      compilation.modules.forEach(function(module) {
        if (module.modules) {
          module.modules.forEach(function(module) {
            if (module instanceof NormalModule) {
              var _source = module.__hardSource_sourceMethod || module.sourceBlock;
              module.__hardSource_sourceMethod = _source;
              module.sourceBlock = function(block, availableVars, dependencyTemplates, source, outputOptions, requestShortener) {
                // Store the source, and template replaces and inserts
                if (!module.__hardSource_concatedSource) {
                  var mods = module.__hardSource_sourceMods = [];
                  wrapSource(source, {
                    replace: spyMethod('replace', mods),
                    insert: spyMethod('insert', mods),
                  });
                  _source.apply(this, arguments);
                  module.__hardSource_concatedSource = source;
                }
                else {
                  _source.apply(this, arguments);
                }
              };
            }
            else if (module instanceof HardModule) {
              // Record replaces and inserts to check later if the module's
              // saved version are equal.
              var _source = module.__hardSource_sourceMethod || module.source;
              module.__hardSource_sourceMethod = _source;
              var mods = module.__hardSource_sourceModsCheck = [];
              module.source = function(dependencyTemplates, outputOptions, requestShortener) {
                try {
                var source = wrapSource(_source.apply(this, arguments), {
                  replace: spyMethod('replace', mods),
                  insert: spyMethod('insert', mods),
                });

                if (!module.cacheItem.concatenatedSourceMods) {
                  needAdditionalPass = true;
                  store('module', identifier, null);
                  return source;
                }

                // Walk blocks, variables, and dependencies and apply templates
                // to build up a array of source mods to check with.
                var walkDependencyBlock = function(block, callback) {
                  block.dependencies.forEach(callback);
                  block.variables.forEach(function(variable) {
                    variable.dependencies.forEach(callback);
                  });
                  block.blocks.forEach(function(block) {
                    walkDependencyBlock(block, callback);
                  });
                };

                var HarmonyImportDependency = require('webpack/lib/dependencies/HarmonyImportDependency');
                var HarmonyExportExpressionDependency = require('webpack/lib/dependencies/HarmonyExportExpressionDependency');
                var HarmonyExportHeaderDependency = require('webpack/lib/dependencies/HarmonyExportHeaderDependency');
                var HarmonyExportSpecifierDependency = require('webpack/lib/dependencies/HarmonyExportSpecifierDependency');
                var HarmonyImportSpecifierDependency = require('webpack/lib/dependencies/HarmonyImportSpecifierDependency');
                var HarmonyExportImportedSpecifierDependency = require('webpack/lib/dependencies/HarmonyExportImportedSpecifierDependency');
                var HarmonyCompatibilityDependency = require('webpack/lib/dependencies/HarmonyCompatibilityDependency');

                var HardHarmonyImportDependency = require('./dependencies').HardHarmonyImportDependency;
                var HardHarmonyExportExpressionDependency = require('./dependencies').HardHarmonyExportExpressionDependency;
                var HardHarmonyExportHeaderDependency = require('./dependencies').HardHarmonyExportHeaderDependency;
                var HardHarmonyExportSpecifierDependency = require('./dependencies').HardHarmonyExportSpecifierDependency;
                var HardHarmonyImportSpecifierDependency = require('./dependencies').HardHarmonyImportSpecifierDependency;
                var HardHarmonyExportImportedSpecifierDependency = require('./dependencies').HardHarmonyExportImportedSpecifierDependency;
                var HardHarmonyCompatibilityDependency = require('./dependencies').HardHarmonyCompatibilityDependency;

                var frozenDepMap = new Map();
                frozenDepMap.set(HardHarmonyImportDependency, HarmonyImportDependency);
                frozenDepMap.set(HardHarmonyExportExpressionDependency, HarmonyExportExpressionDependency);
                frozenDepMap.set(HardHarmonyExportHeaderDependency, HarmonyExportHeaderDependency);
                frozenDepMap.set(HardHarmonyExportSpecifierDependency, HarmonyExportSpecifierDependency);
                frozenDepMap.set(HardHarmonyImportSpecifierDependency, HarmonyImportSpecifierDependency);
                frozenDepMap.set(HardHarmonyExportImportedSpecifierDependency, HarmonyExportImportedSpecifierDependency);
                frozenDepMap.set(HardHarmonyCompatibilityDependency, HarmonyCompatibilityDependency);

                walkDependencyBlock(module, function(dependency) {
                  var template = dependencyTemplates.get(frozenDepMap.get(dependency.constructor));
                  template && template.apply(dependency, source, outputOptions, requestShortener, dependencyTemplates);
                });

                if (!isEqual(module.cacheItem.concatenatedSourceMods, mods)) {
                  needAdditionalPass = true;
                  var identifierPrefix = cachePrefix(compilation);
                  if (identifierPrefix === null) {
                    return;
                  }
                  var identifier = identifierPrefix + module.identifier();
                  store('module', identifier, null);
                }

                return source;
              } catch (e) {
                console.error(e.stack || e);
                throw e;
              }
              };
            }
          });
        }
      });
    });
  });

  compiler.plugin('need-additional-pass', function() {
    if (needAdditionalPass) {
      needAdditionalPass = false;
      return true;
    }
  });

  compiler.plugin('--hard-source-freeze-module', function(frozen, module, extra) {
    if (module.modules) {
      var compilation = extra.compilation;

      module.modules.forEach(function(module) {
        if (module.cacheable && module instanceof NormalModule) {
          var identifierPrefix = cachePrefix(compilation);
          if (identifierPrefix === null) {
            return;
          }
          var identifier = identifierPrefix + module.identifier();

          store('module', identifier, module, {
            id: identifier,
            compilation: compilation,
          });
        }
      });
    }

    return frozen;
  });

  compiler.plugin('--hard-source-after-freeze-module', function(frozen, module, extra) {
    if (frozen && module.__hardSource_concatedSource) {
      var source = module.__hardSource_concatedSource;
      frozen.source = source.source();
      frozen.sourceMap = freeze('source-map', null, source, {
        module: module,
        compilation: extra.compilation,
      });
      frozen.concatenatedSourceMods = module.__hardSource_sourceMods;
    }
    return frozen;
  });
};

module.exports = HardModuleConcatenationPlugin;
