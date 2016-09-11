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
      cacheDirectory: 'cache',
      recordsPath: 'cache/records.json',
      configHash: function(config) {
        return fs.readFileSync(__dirname + '/config-hash', 'utf8');
      },
      environmentPaths: {
        root: __dirname + '/../../..',
      },
    }),
  ],
};
