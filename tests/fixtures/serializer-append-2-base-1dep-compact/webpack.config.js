var HardSourceWebpackPlugin = require('../../..');
var HardSourceAppend2SerializerPlugin = require('../../../lib/hard-source-append-2-serializer-plugin');

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
    new HardSourceAppend2SerializerPlugin(),
  ],
};
