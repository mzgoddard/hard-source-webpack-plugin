// FILENAME='main.js'
// HARDSOURCE_OPTIONS={cacheDirectory: 'cache'}

const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/tmp',
    filename: FILENAME,
  },
  plugins: [
    new HardSourceWebpackPlugin(HARDSOURCE_OPTIONS),
  ],
};
