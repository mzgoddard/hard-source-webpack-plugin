var path = require('path');

var extractTextNS;
try {
  extractTextNS = path.dirname(require.resolve('extract-text-webpack-plugin'));
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
      module.meta && module.meta[extractTextNS]
    ) {
      return;
    }

    return frozen;
  });
};

module.exports = HardModuleExtractTextPlugin;
