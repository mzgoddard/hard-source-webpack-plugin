var semver = require('semver');
var webpackVersion = require('webpack/package.json').version;

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
      manifest: semver.satisfies(webpackVersion, '>=4.27') ?
        require('./dll-manifest-4.27.json') :
        require('./dll-manifest.json'),
      // manifest: __dirname + '/dll-manifest.json',
    }),
  ],
};
