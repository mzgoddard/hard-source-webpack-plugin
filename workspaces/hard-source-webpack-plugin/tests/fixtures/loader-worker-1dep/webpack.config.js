var pluginCompat = require('../../../lib/util/plugin-compat');
var HardSourceWebpackPlugin = require('../../..');

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/tmp',
    filename: 'main.js',
  },
  plugins: [
    new HardSourceWebpackPlugin({
      cacheDirectory: 'cache',
      environmentHash: {
        root: __dirname + '/../../..',
      },
    }),
    {
      apply(compiler) {
        pluginCompat.tap(compiler, 'hardSourceLog', 'loader-worker-1dep test', info => {
          if (info.level !== 'log') {
            throw new Error('loader-worker-1dep fixture should not produce logs');
          }
        });
      },
    },
  ],
};
