var fs = require('graceful-fs');

var HardSourceWebpackPlugin = require('../../..');

var hardSourceConfig = eval(
  '(function() { return (' +
  require('graceful-fs')
  .readFileSync(__dirname + '/hard-source-config.js', 'utf8') +
  '); })'
)();

module.exports = {
  context: __dirname,
  entry: './loader.js!./index.js',
  output: {
    path: __dirname + '/tmp',
    filename: 'main.js',
  },
  plugins: [
    new HardSourceWebpackPlugin(hardSourceConfig),
  ],
};
