var HardSourceWebpackPlugin = require('../../..');
var HardSourceJsonSerializerPlugin = require('../../../lib/hard-source-json-serializer-plugin');

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
    new HardSourceJsonSerializerPlugin(),
  ],
};
