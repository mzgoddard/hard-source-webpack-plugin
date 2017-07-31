var path = require('path');

var extractTextNS;
// Dirty hack: https://github.com/mzgoddard/hard-source-webpack-plugin/issues/158
var extractCssNS;
try {
  extractTextNS = path.dirname(require.resolve('extract-text-webpack-plugin'));
  extractCssNS = path.dirname(require.resolve('extract-css-chunks-webpack-plugin'));
}
catch (_) {}

function HardModuleExtractTextPlugin() {}

HardModuleExtractTextPlugin.prototype.apply = function(compiler) {
  compiler.plugin('--hard-source-after-freeze-module', function(frozen, module, extra) {
    // Ignore the modules that kick off child compilers in extract text.
    // These modules must always be built so the child compilers run so
    // that assets get built.
    if (
      module[extractTextNS] ||
      module[extractCssNS] || 
      module.meta && module.meta[extractTextNS]
    ) {
      return;
    }

    return frozen;
  });
};

module.exports = HardModuleExtractTextPlugin;
