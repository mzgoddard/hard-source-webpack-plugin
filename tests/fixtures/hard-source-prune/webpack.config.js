var fs = require('fs');

var HardSourceWebpackPlugin = require('../../..');

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/tmp',
    filename: 'main.js',
  },
  plugins: [
    new HardSourceWebpackPlugin({
      cacheDirectory: 'cache/[confighash]',
      configHash: function(config) {
        return fs.readFileSync(__dirname + '/config-hash', 'utf8');
      },
      environmentHash: {
        root: __dirname + '/../../..',
      },
      cachePrune: {
        maxAge: -2000,
        sizeThreshold: 0,
      },
    }),
  ],
};
