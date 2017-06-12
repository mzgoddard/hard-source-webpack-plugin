var RawSource;
try {
  RawSource = require('webpack-sources/lib/RawSource');
}
catch (_) {
  RawSource = require('webpack-core/lib/RawSource');
}

var SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');

var HardSourceWebpackPlugin = require('../../..');

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/tmp',
    filename: '[name].js',
  },
  recordsPath: __dirname + '/tmp/cache/records.json',
  plugins: [
    new HardSourceWebpackPlugin({
      cacheDirectory: __dirname + '/tmp/cache',
      recordsPath: __dirname + '/tmp/cache/records.json',
      environmentHash: {
        root: __dirname + '/../../..',
      },
    }),
    {
      apply: function(compiler) {
        var lines = [];
        compiler.plugin('hard-source-log', function(info) {
          lines.push([info.level, info.from, info.message]);
        });
        compiler.plugin('emit', function(compilation, cb) {
          compilation.assets['log.json'] = new RawSource(JSON.stringify(lines));
          cb();
        });
      },
    },
  ],
};
