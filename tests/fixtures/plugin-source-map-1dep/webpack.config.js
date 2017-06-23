var SourceMapDevToolPlugin = require('webpack').SourceMapDevToolPlugin;

var HardSourceWebpackPlugin = require('../../..');

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/tmp',
    filename: 'main.js',
  },
  recordsPath: __dirname + '/tmp/cache/records.json',
  plugins: [
    new HardSourceWebpackPlugin({
      cacheDirectory: 'cache',
      environmentHash: {
        root: __dirname + '/../../..',
      },
    }),
    new SourceMapDevToolPlugin({
      filename: '[file].map[query]',
      moduleFilenameTemplate: undefined,
      fallbackModuleFilenameTemplate: undefined,
      append: null,
      module: true,
      columns: false,
      lineToLine: false,
      noSources: false,
      test: /\.(js|css)(\.out)?($|\?)/i,
    }),
  ],
};
