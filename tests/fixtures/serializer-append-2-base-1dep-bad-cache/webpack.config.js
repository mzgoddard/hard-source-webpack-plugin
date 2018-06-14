var HardSourceWebpackPlugin = require('../../..');
var SerializerAppend2Plugin = require('../../../lib/SerializerAppend2Plugin');

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
    new SerializerAppend2Plugin(),
  ],
};
