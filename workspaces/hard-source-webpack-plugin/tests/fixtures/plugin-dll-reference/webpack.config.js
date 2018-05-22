var DllReferencePlugin = require('webpack').DllReferencePlugin;
var HardSourceWebpackPlugin = require('../../..');

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/tmp',
    filename: 'main.js',
    library: '[name]_[hash]',
  },
  plugins: [
    new HardSourceWebpackPlugin({
      cacheDirectory: 'cache',
      environmentHash: {
        root: __dirname + '/../../..',
      },
    }),
    new DllReferencePlugin({
      context: __dirname,
      manifest: require('./dll-manifest.json'),
      // manifest: __dirname + '/dll-manifest.json',
    }),
  ],
};
