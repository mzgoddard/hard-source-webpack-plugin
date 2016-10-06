var DllReferencePlugin = require('webpack').DllReferencePlugin;
var HardSourceWebpackPlugin = require('../../..');

var wpVersion = Number(require('webpack/package.json').version[0]);
var dllManifest;
if (wpVersion > 1) {
  dllManifest = require('./dll-webpack-2-manifest.json');
}
else {
  dllManifest = require('./dll-webpack-1-manifest.json');
}

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/tmp',
    filename: 'main.js',
    library: '[name]_[hash]',
  },
  recordsPath: __dirname + '/tmp/cache/records.json',
  plugins: [
    new HardSourceWebpackPlugin({
      cacheDirectory: 'cache',
      environmentPaths: {
        root: __dirname + '/../../..',
      },
    }),
    new DllReferencePlugin({
      manifest: dllManifest,
      context: __dirname,
    }),
  ],
};
