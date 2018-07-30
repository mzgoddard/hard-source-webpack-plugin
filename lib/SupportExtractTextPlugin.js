const path = require('path');

let extractTextNS;
let extractTextNS2;
try {
  extractTextNS = path.dirname(require.resolve('extract-text-webpack-plugin'));
} catch (_) {}

const pluginCompat = require('./util/plugin-compat');

class SupportExtractTextPlugin {
  apply(compiler) {
    pluginCompat.tap(
      compiler,
      '_hardSourceAfterFreezeModule',
      'SupportExtractTextPlugin',
      (frozen, module, extra) => {
        // Ignore the modules that kick off child compilers in extract text.
        // These modules must always be built so the child compilers run so
        // that assets get built.
        if (
          module[extractTextNS] ||
          (!module.factoryMeta && module.meta && module.meta[extractTextNS])
        ) {
          return null;
        }

        return frozen;
      },
    );
  }
}

module.exports = SupportExtractTextPlugin;
