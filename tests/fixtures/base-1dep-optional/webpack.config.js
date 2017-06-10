var HardSourceWebpackPlugin = require('../../..');
var webpackIf = require('../../util/webpack-if');

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/tmp',
    filename: 'main.js',
  },
  // Restrict extensions in this test to improve reducability. Since this test
  // tests resolve warnings having more extensions can produce different results
  // because of the order failing extensions are tried.
  resolve: {
    // Versions after webpack 1 do not allow empty string values.
    extensions: webpackIf.webpack1(['', '.js'], ['.js']),
  },
  recordsPath: __dirname + '/tmp/cache/records.json',
  plugins: [
    new HardSourceWebpackPlugin({
      cacheDirectory: 'cache',
      environmentHash: {
        root: __dirname + '/../../..',
      },
    }),
  ],
};
