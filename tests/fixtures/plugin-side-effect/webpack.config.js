var HardSourceWebpackPlugin = require('../../..');

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/tmp',
    filename: 'main.js',
  },
  optimization: {
    minimize: false,
    // concatenateModules: false,
    // sideEffects: false,
  },
  module: {
    rules: [
      {
        test: /obj/,
        // sideEffects: false,
      },
    ],
  },
  plugins: [
    new HardSourceWebpackPlugin({
      cacheDirectory: 'cache',
      environmentHash: {
        root: __dirname + '/../../..',
      },
    }),
  ],
};
