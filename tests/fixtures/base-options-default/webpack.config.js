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
      environmentHash: {
        root: __dirname + '/../../..',
      },
    }),
  ],
};
