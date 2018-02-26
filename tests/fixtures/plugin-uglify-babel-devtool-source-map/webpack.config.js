var HardSourceWebpackPlugin = require('../../..');
var webpackIf = require('../../util/webpack-if');

var plugins = webpackIf.webpackGte4([], function() {
  var UglifyJsPlugin = require('webpack').optimize.UglifyJsPlugin;
  return [
    new UglifyJsPlugin({
      sourceMap: true,
    }),
  ];
});

var extendedOptions = webpackIf.webpackGte4({
  optimization: {
    minimize: true,
  },
});

module.exports = Object.assign({
  context: __dirname,
  entry: './index.js',
  devtool: 'source-map',
  output: {
    path: __dirname + '/tmp',
    filename: 'main.js',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        options: {
          presets: ['env'],
        },
      },
    ],
  },
  recordsPath: __dirname + '/tmp/cache/records.json',
  plugins: [
    new HardSourceWebpackPlugin({
      cacheDirectory: 'cache',
      environmentHash: {
        root: __dirname + '/../../..',
      },
    }),
  ].concat(plugins),
}, extendedOptions);
