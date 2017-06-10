var ExtractTextPlugin = require('extract-text-webpack-plugin');
var ExtractTextVersion = require('extract-text-webpack-plugin/package.json').version;
var UglifyJsPlugin = require('webpack').optimize.UglifyJsPlugin;

var HardSourceWebpackPlugin = require('../../..');

var extractOptions;
if (Number(ExtractTextVersion[0]) > 1) {
  extractOptions = [{
    fallbackLoader: 'style-loader',
    loader: 'css-loader',
  }];
}
else {
  extractOptions = ['style-loader', 'css-loader'];
}

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/tmp',
    filename: 'main.js',
  },
  recordsPath: __dirname + '/tmp/cache/records.json',
  devtool: 'source-map',
  module: {
    loaders: [
      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract
        .apply(ExtractTextPlugin, extractOptions),
      },
    ],
  },
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
