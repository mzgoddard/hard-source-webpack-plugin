var HardSourceWebpackPlugin = require('hard-source-webpack-plugin');
var webpackVersion = require('webpack/package.json').version;

var moduleOptions;

if (Number(webpackVersion.split('.')[0]) > 1) {
  moduleOptions = {
    rules: [
      {
        test: /\.js$/,
        loader: __dirname + '/loader',
      },
    ],
  };
} else {
  moduleOptions = {
    loaders: [
      {
        test: /\.js$/,
        loader: __dirname + '/loader',
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
  module: moduleOptions,
  plugins: [
    new HardSourceWebpackPlugin({
      cacheDirectory: 'cache',
    }),
  ],
};
