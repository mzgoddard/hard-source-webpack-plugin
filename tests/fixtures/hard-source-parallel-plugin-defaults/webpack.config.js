var HardSourceWebpackPlugin = require('../../..');

module.exports = {
  mode: 'development',
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
    new (require('../../../lib/ParallelModulePlugin'))(),
  ],
};
