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
    return frozen;
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
