var HardSourceWebpackPlugin = require('../../..');

module.exports = {
  // The test process will have mode set by testing utilities. The forked
  // parallel processes will not have mode set. With a different configuration
  // the processes won't match and building should fallback to the test process.
  // mode: 'development',
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
    new (require('../../../lib/ParallelModulePlugin'))({
      minModules: 1,
    }),
  ],
};
