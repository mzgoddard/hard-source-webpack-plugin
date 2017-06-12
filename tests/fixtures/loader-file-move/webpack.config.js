var HardSourceWebpackPlugin = require('../../..');

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/tmp',
    filename: 'main.js',
  },
  cache: true,
  recordsPath: __dirname + '/tmp/cache/records.json',
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
