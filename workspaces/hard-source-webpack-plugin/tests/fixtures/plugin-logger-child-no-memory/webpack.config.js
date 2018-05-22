var RawSource = require('webpack-sources/lib/RawSource');

var SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');

var HardSourceWebpackPlugin = require('../../..');
var pluginCompat = require('../../../lib/util/plugin-compat');

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/tmp',
    filename: '[name].js',
  },
  plugins: [
    new HardSourceWebpackPlugin({
      cacheDirectory: __dirname + '/tmp/cache',
      environmentHash: {
        root: __dirname + '/../../..',
      },
    }),
    {
      apply: function(compiler) {
        pluginCompat.tapAsync(compiler, 'make', 'NoMemoryCache', (compilation, cb) => {
          const child = compilation.createChildCompiler('noname', {}, []);
          pluginCompat.tap(child, 'make', 'NoMemoryCache', childCompilation => {
            childCompilation.cache = null;
          });
          new SingleEntryPlugin(compiler.options.context, compiler.options.entry, 'noname').apply(child);
          child.runAsChild(cb);
        });
      },
    },
    {
      apply: function(compiler) {
        var lines = [];
        pluginCompat.tap(compiler, 'hardSourceLog', 'NoMemoryCache', function(info) {
          if (info.level === 'error') {
            lines.push([info.level, info.from, info.message]);
          }
        });
        pluginCompat.tap(compiler, 'emit', 'NoMemoryCache', function(compilation) {
          compilation.assets['log.json'] = new RawSource(JSON.stringify(lines));
        });
      },
    },
  ],
};
