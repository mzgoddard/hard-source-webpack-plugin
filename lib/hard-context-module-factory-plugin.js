var AMDRequireContextDependency = require('webpack/lib/dependencies/AMDRequireContextDependency');
var CommonJsRequireContextDependency = require('webpack/lib/dependencies/CommonJsRequireContextDependency');
var RequireContextDependency = require('webpack/lib/dependencies/RequireContextDependency');
var RequireResolveContextDependency = require('webpack/lib/dependencies/RequireResolveContextDependency');

var ImportContextDependency;

try {
  ImportContextDependency = require('webpack/lib/dependencies/ImportContextDependency');
}
catch (_) {}

var pluginCompat = require('./util/plugin-compat');

var HardContextModuleFactory = require('./hard-context-module-factory');

class HardContextModuleFactoryPlugin {
  constructor(options) {
    this.options = options;
  }

  apply(compiler) {
    const {caches} = this.options;

    pluginCompat.tap(compiler, 'afterPlugins', 'HardContextModuleFactoryPlugin', () => {
      pluginCompat.tap(compiler, 'compilation', 'HardContextModuleFactoryPlugin', (compilation, params) => {
        var factories = compilation.dependencyFactories;
        var contextFactory = factories.get(RequireContextDependency) ||
          params.contextModuleFactory;

        const {
          cachedMd5s,
          fileMd5s,
          fileTimestamps,
          moduleCache,
          moduleResolveCache,
          moduleResolveCacheChange,
        } = caches();

        var hardContextFactory = new HardContextModuleFactory({
          compilation: compilation,
          factory: contextFactory,

          cachedMd5s: cachedMd5s,
          fileMd5s: fileMd5s,
          fileTimestamps: fileTimestamps,
          moduleCache: moduleCache,
          resolveCache: moduleResolveCache,
          resolveCacheChange: moduleResolveCacheChange,
        });

        factories.set(AMDRequireContextDependency, hardContextFactory);
        factories.set(CommonJsRequireContextDependency, hardContextFactory);
        factories.set(RequireContextDependency, hardContextFactory);
        factories.set(RequireResolveContextDependency, hardContextFactory);

        if (ImportContextDependency) {
          factories.set(ImportContextDependency, hardContextFactory);
        }
      });
    });
  }
}

module.exports = HardContextModuleFactoryPlugin;
