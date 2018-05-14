const NormalModule = require('webpack/lib/NormalModule');

const cachePrefix = require('./util').cachePrefix;
const pluginCompat = require('./util/plugin-compat');

function wrapSource(source, methods) {
  Object.keys(methods).forEach(key => {
    const _method = source[key];
    source[key] = function(...args) {
      methods[key].apply(this, args);
      _method && _method.apply(this, args);
    };
  });
  return source;
}

function spyMethod(name, mods) {
  return function(...args) {
    mods.push([name].concat([].slice.call(args)));
  };
}

function isEqual(a, b) {
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    return a.reduce(
      (carry, value, index) => carry && isEqual(value, b[index]),
      true,
    );
  } else if (a === b) {
    return true;
  }
  return false;
}

class HardModuleConcatenationPlugin {
  apply(compiler) {
    let store;
    let freeze;

    pluginCompat.tap(
      compiler,
      '_hardSourceMethods',
      'HardModuleConcatenationPlugin',
      methods => {
        store = methods.store;
        // fetch = methods.fetch;
        freeze = methods.freeze;
        // thaw = methods.thaw;
        // mapFreeze = methods.mapFreeze;
        // mapThaw = methods.mapThaw;
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceFreezeModule',
      'HardModuleConcatenationPlugin',
      (frozen, { modules }, extra) => {
        if (modules) {
          const compilation = extra.compilation;

          modules.forEach(module => {
            if (
              (module.cacheable ||
                (module.buildInfo && module.buildInfo.cacheable)) &&
              module instanceof NormalModule
            ) {
              const identifierPrefix = cachePrefix(compilation);
              if (identifierPrefix === null) {
                return;
              }
              const identifier = identifierPrefix + module.identifier();

              store('Module', identifier, module, {
                id: identifier,
                compilation,
              });
            }
          });
        }

        return frozen;
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceAfterFreezeModule',
      'HardModuleConcatenationPlugin',
      (frozen, module, { compilation }) => {
        return frozen;
        if (frozen && module.__hardSource_concatedSource) {
          const source = module.__hardSource_concatedSource;
          frozen.source = source.source();
          frozen.sourceMap = freeze('SourceMap', null, source, {
            module,
            compilation: compilation,
          });
          frozen.concatenatedSourceMods = module.__hardSource_sourceMods;
        }
        return frozen;
      },
    );
  }
}

module.exports = HardModuleConcatenationPlugin;
