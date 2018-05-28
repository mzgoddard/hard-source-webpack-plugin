var HardSourceWebpackPlugin = require('hard-source-webpack-plugin');
var webpackIf = require('mocha-hard-source/webpack-if');

var plugins = webpackIf.webpackGte4([], function() {
  var UglifyJsPlugin = require('webpack').optimize.UglifyJsPlugin;
  return [
    new UglifyJsPlugin({
      sourceMap: false,
      compress: false,
    }),
  ];
});

var extendedOptions = webpackIf.webpackGte4({
  optimization: {
    minimize: true,
  },
});

module.exports = Object.assign(
  {
    context: __dirname,
    entry: './index.js',
    output: {
      path: __dirname + '/tmp',
      filename: 'main.js',
      libraryTarget: 'commonjs2',
    },
    plugins: [
      new HardSourceWebpackPlugin({
        cacheDirectory: 'cache',
        environmentHash: {
          root: __dirname + '/../../../..',
        },
      }),
    ].concat(plugins),
  },
  extendedOptions,
);
