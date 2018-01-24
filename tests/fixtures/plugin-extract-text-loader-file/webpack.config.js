var ExtractTextPlugin = require('extract-text-webpack-plugin');
var ExtractTextVersion = require('extract-text-webpack-plugin/package.json').version;

var HardSourceWebpackPlugin = require('../../..');

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

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/tmp',
    filename: 'main.js',
  },
  module: {
    loaders: [
      {
        test: /\.png$/,
        loader: 'file-loader',
      },
      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract
        .apply(ExtractTextPlugin, extractOptions),
      },
    ],
  },
  plugins: [
    new ExtractTextPlugin('style.css'),
    new HardSourceWebpackPlugin({
      cacheDirectory: 'cache',
      environmentHash: {
        root: __dirname + '/../../..',
      },
    }),
  ],
};
