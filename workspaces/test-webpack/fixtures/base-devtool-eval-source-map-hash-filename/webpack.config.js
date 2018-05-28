var HardSourceWebpackPlugin = require('hard-source-webpack-plugin');

module.exports = {
  context: __dirname,
  entry: './index.js',
  devtool: 'eval-source-map',
  output: {
    path: __dirname + '/tmp',
    filename: '[hash].js',
  },
  plugins: [
    new HardSourceWebpackPlugin({
      cacheDirectory: 'cache',
    }),
  ],
};
