var join = require('path').join;

var HardSourceWebpackPlugin = require('../../..');

var ChildCompilationPlugin = require('./child-compilation-plugin');
var webpackIf = require('../../util/webpack-if');

var loaders = [
  {
    test: /\.js$/,
    loader: 'loader-a',
  },
];

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/tmp',
    filename: '[name].js',
  },
  recordsPath: __dirname + '/tmp/cache/records.json',

  module: webpackIf.removeEmptyValues({
    loaders: webpackIf.webpack1(loaders),
    rules: webpackIf.webpack2(loaders),
  }),

  resolveLoader: {
    alias: {
      'loader-a': join(__dirname, 'loader-a.js'),
      'loader-b': join(__dirname, 'loader-b.js'),
    },
  },

  plugins: [
    new ChildCompilationPlugin([
      {
        test: /\.js$/,
        loader: 'loader-b',
      },
    ]),
    new HardSourceWebpackPlugin({
      cacheDirectory: 'cache',
      environmentHash: {
        root: __dirname + '/../../..',
      },
    }),
  ],
};
