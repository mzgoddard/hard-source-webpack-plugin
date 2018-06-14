const pluginCompat = require('./util/plugin-compat');

/**
 * Exclude modules with CssDependency. These modules are what mini-css keys
 * child compilations on. Excluding them the child compilations and their
 * assets are built every build. This has a minor performance cost as the bulk
 * of the work for css is still cached.
 */
class ExcludeMiniCssModulePlugin {
  apply(compiler) {
    let CssDependency;

    pluginCompat.tap(
      compiler,
      'make',
      'SupportMiniCssExtractPlugin',
      ({ dependencyFactories }) => {
        const Dependencies = dependencyFactories.keys();
        for (const Dep of Dependencies) {
          if (Dep.name === 'CssDependency') {
            CssDependency = Dep;
            break;
          }
        }
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceAfterFreezeModule',
      'HardMiniCssExtractPlugin',
      (frozen, module, extra) => {
        if (
          CssDependency &&
          module.dependencies.some(dep => dep instanceof CssDependency)
        ) {
          return null;
        }
        return frozen;
      },
    );
  }
}

module.exports = ExcludeMiniCssModulePlugin;
