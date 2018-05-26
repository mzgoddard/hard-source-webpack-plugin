const pluginCompat = require('./util/plugin-compat');

const mixinCssDependency = function(CssDependency) {
  const Dependency = Object.getPrototypeOf(CssDependency.prototype).constructor;
  CssDependency.prototype.updateHash = function(hash) {
    Dependency.prototype.updateHash.call(this, hash);
    hash.update(this.content);
  };
};

class SupportMiniCssExtractPlugin {
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
            mixinCssDependency(CssDependency);
            break;
          }
        }
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceFreezeDependency',
      'HardMiniCssExtractPlugin freeze',
      (frozen, dependency, extra) => {
        if (dependency.constructor === CssDependency) {
          return {
            type: 'CssDependency',
            line: {
              identifier: dependency.identifier,
              content: dependency.content,
              media: dependency.media,
              sourceMap: dependency.sourceMap,
            },
            context: dependency.context,
            identifierIndex: dependency.identifierIndex,
          };
        }
        return frozen;
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceThawDependency',
      'HardMiniCssExtractPlugin',
      (dependency, { type, line, context, identifierIndex }, extra) => {
        if (type === 'CssDependency') {
          return new CssDependency(line, context, identifierIndex);
        }
        return dependency;
      },
    );
  }
}

module.exports = SupportMiniCssExtractPlugin;
