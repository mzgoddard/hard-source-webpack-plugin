var HardSourceWebpackPlugin = require('../../..');

module.exports = {
  context: __dirname,
  entry: './loader.js!./index.js',
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
  ],
};
