const AMDRequireContextDependency = require('webpack/lib/dependencies/AMDRequireContextDependency');
const CommonJsRequireContextDependency = require('webpack/lib/dependencies/CommonJsRequireContextDependency');
const RequireContextDependency = require('webpack/lib/dependencies/RequireContextDependency');
const RequireResolveContextDependency = require('webpack/lib/dependencies/RequireResolveContextDependency');

let ImportContextDependency;

try {
  ImportContextDependency = require('webpack/lib/dependencies/ImportContextDependency');
} catch (_) {}

const pluginCompat = require('./util/plugin-compat');

const HardContextModuleFactory = require('./hard-context-module-factory');

class HardContextModuleFactoryPlugin {
  constructor(options) {
    this.options = options;
  }

  apply(compiler) {
    const { caches } = this.options;

    pluginCompat.tap(
      compiler,
      'afterPlugins',
      'HardContextModuleFactoryPlugin',
      () => {
        pluginCompat.tap(
          compiler,
          'compilation',
          'HardContextModuleFactoryPlugin',
          (compilation, { contextModuleFactory }) => {
            const factories = compilation.dependencyFactories;
            const contextFactory =
              factories.get(RequireContextDependency) || contextModuleFactory;

            const {
              cachedMd5s,
              fileMd5s,
              fileTimestamps,
              moduleCache,
              moduleResolveCache,
              moduleResolveCacheChange,
            } = caches(compilation);

            const hardContextFactory = new HardContextModuleFactory({
              compilation,
              factory: contextFactory,

              cachedMd5s,
              fileMd5s,
              fileTimestamps,
              moduleCache,
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
          },
        );
      },
    );
  }
}

module.exports = HardContextModuleFactoryPlugin;
