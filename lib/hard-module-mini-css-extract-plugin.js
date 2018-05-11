var pluginCompat = require('./util/plugin-compat');

function HardModuleMiniCssExtractPlugin() {}

HardModuleMiniCssExtractPlugin.prototype.apply = function(compiler) {
  let CssDependency;

  pluginCompat.tap(compiler, 'make', 'HardModuleMiniCssExtractPlugin', function(compilation) {
    const Dependencies = compilation.dependencyFactories.keys();
    for (const Dep of Dependencies) {
      if (Dep.name === 'CssDependency') {
        CssDependency = Dep;
        break;
      }
    }
  });

  pluginCompat.tap(compiler, '_hardSourceFreezeDependency', 'HardMiniCssExtractPlugin freeze', function(frozen, dependency, extra) {
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
        identifierIndex: dependency.identifierIndex
      };
    }
    return frozen;
  });

  pluginCompat.tap(compiler, '_hardSourceThawDependency', 'HardMiniCssExtractPlugin', function(dependency, frozen, extra) {
    if (frozen.type === 'CssDependency') {
      return new CssDependency(frozen.line, frozen.context, frozen.identifierIndex);
    }
    return dependency;
  });
};

module.exports = HardModuleMiniCssExtractPlugin;
