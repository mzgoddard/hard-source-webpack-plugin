var HardSourceWebpackPlugin = require('../../..');
var webpackVersion = require('webpack/package.json').version;

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/tmp',
    filename: 'main.js',
  },
  module: {
    rules: [
      {
        test: /\.png$/,
        loader: 'file-loader',
        options: {
          name: '[hash].[ext]',
          outputPath: name => `images/${name}`,
        },
      },
    ],
  },
  plugins: [
    new HardSourceWebpackPlugin({
      cacheDirectory: 'cache',
    }),
  ],
};
