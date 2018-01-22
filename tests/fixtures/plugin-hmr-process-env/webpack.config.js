var HotModuleReplacementPlugin = require('webpack').HotModuleReplacementPlugin;
var HardSourceWebpackPlugin = require('../../..');
var ForceWriteRecords = require('../../util/force-write-records');

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/tmp',
    filename: 'main.js',
  },
  recordsPath: __dirname + '/tmp/cache/records.json',
  plugins: [
    new ForceWriteRecords(),
    new HotModuleReplacementPlugin(),
    new HardSourceWebpackPlugin({
      cacheDirectory: __dirname + '/tmp/cache',
      environmentHash: {
        root: __dirname + '/../../..',
      },
    }),
  ],
};
