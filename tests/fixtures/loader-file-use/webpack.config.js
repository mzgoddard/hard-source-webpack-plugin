var HardSourceWebpackPlugin = require('../../..');

module.exports = {
  context: __dirname,
  entry: './src/index.js',
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
    ],
  },
  plugins: [
    new HardSourceWebpackPlugin({
      cacheDirectory: 'cache',
    }),
  ],
};
