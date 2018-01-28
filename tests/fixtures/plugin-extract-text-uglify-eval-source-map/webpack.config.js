var ExtractTextPlugin = require('extract-text-webpack-plugin');
var ExtractTextVersion = require('extract-text-webpack-plugin/package.json').version;
var UglifyJsPlugin = require('webpack').optimize.UglifyJsPlugin;

var HardSourceWebpackPlugin = require('../../..');
var webpackVersion = require('webpack/package.json').version;

var extractOptions;
if (Number(ExtractTextVersion[0]) > 1) {
  extractOptions = [{
    fallback: 'style-loader',
    use: 'css-loader',
  }];
}
else {
  extractOptions = ['style-loader', 'css-loader'];
}

var moduleOptions;

if (Number(webpackVersion.split('.')[0]) > 1) {
  moduleOptions = {
    rules: [
      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract
        .apply(ExtractTextPlugin, extractOptions),
      },
    ],
  };
}
else {
  moduleOptions = {
    loaders: [
      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract
        .apply(ExtractTextPlugin, extractOptions),
      },
    ],
  };
}

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/tmp',
    filename: 'main.js',
  },
  devtool: 'eval-source-map',
  module: moduleOptions,
  plugins: [
    new ExtractTextPlugin('style.css'),
    new UglifyJsPlugin(),
    new HardSourceWebpackPlugin({
      cacheDirectory: 'cache',
      environmentHash: {
        root: __dirname + '/../../..',
      },
    }),
  ],
};
