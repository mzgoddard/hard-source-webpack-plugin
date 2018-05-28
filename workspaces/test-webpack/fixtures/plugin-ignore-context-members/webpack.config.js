var IgnorePlugin = require('webpack').IgnorePlugin;
var HardSourceWebpackPlugin = require('hard-source-webpack-plugin');

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
        root: __dirname + '/../../../..',
      },
    }),
    new IgnorePlugin(/\.\/a\/[1-5]/),
  ],
};
