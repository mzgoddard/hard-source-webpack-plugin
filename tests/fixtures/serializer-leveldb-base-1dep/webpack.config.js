var HardSourceWebpackPlugin = require('../../..');
var HardSourceLevelDbSerializerPlugin = require('../../../lib/SerializerLeveldbPlugin');

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
      environmentHash: {
        root: __dirname + '/../../..',
      },
    }),
    new HardSourceLevelDbSerializerPlugin(),
  ],
};
