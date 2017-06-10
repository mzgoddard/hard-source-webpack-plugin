var HardSourceWebpackPlugin = require('../../..');

module.exports = {
  context: __dirname,
  entry: './loader!./index.js',
  output: {
    path: __dirname + '/tmp',
    filename: 'main.js',
  },
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
      environmentHash: {
        root: __dirname + '/../../..',
      },
    }),
  ],
};
