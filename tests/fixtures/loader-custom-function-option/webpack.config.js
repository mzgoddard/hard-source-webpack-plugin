var join = require('path').join;

var HardSourceWebpackPlugin = require('../../..');

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/tmp',
    filename: 'main.js',
  },
  recordsPath: __dirname + '/tmp/cache/records.json',
  module: {
    rules: [
      {
        test: /fib\.js$/,
        loader: join(__dirname, 'loader.js'),
        options: {
          handle: function(source) {
            return 'module.exports = ' + JSON.stringify(source) + ';';
          },
        },
      },
    ],
  },
  plugins: [
    new HardSourceWebpackPlugin({
      cacheDirectory: 'cache',
      environmentHash: {
        root: __dirname + '/../../..',
      },
    }),
  ],
};
