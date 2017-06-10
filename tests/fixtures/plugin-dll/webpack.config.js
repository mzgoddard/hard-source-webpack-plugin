var DllPlugin = require('webpack').DllPlugin;
var HardSourceWebpackPlugin = require('../../..');

module.exports = {
  context: __dirname,
  entry: {
    'dll': ['./fib.js'],
  },
  output: {
    path: __dirname + '/tmp',
    filename: 'dll.js',
    library: '[name]_[hash]',
  },
  recordsPath: __dirname + '/tmp/cache/records.json',
  plugins: [
    new HardSourceWebpackPlugin({
      cacheDirectory: 'cache',
      environmentHash: {
        root: __dirname + '/../../..',
      },
    }),
    new DllPlugin({
      path: __dirname + '/tmp/dll-manifest.json',
      name: '[name]_[hash]',
      context: __dirname,
    }),
  ],
};
