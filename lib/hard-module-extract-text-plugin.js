var path = require('path');

var extractTextNS, extractTextNS2;
try {
  extractTextNS = path.dirname(require.resolve('extract-text-webpack-plugin'));
}
catch (_) {}

var pluginCompat = require('./util/plugin-compat');

function HardModuleExtractTextPlugin() {}

HardModuleExtractTextPlugin.prototype.apply = function(compiler) {
  pluginCompat.tap(compiler, '_hardSourceAfterFreezeModule', 'HardModuleExtractTextPlugin', function(frozen, module, extra) {
    // Ignore the modules that kick off child compilers in extract text.
    // These modules must always be built so the child compilers run so
    // that assets get built.
    if (
      module[extractTextNS] ||
      !module.buildMeta && module.meta && module.meta[extractTextNS]
    ) {
      return null;
    }

    return frozen;
  });
};

module.exports = HardModuleExtractTextPlugin;
