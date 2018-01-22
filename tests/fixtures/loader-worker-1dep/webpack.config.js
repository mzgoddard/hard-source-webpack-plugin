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
      cacheDirectory: 'cache',
      environmentHash: {
        root: __dirname + '/../../..',
      },
    }),
    {
      apply: function(compiler) {
        compiler.plugin('hard-source-log', function(info) {
          throw new Error('loader-worker-1dep fixture should not produce logs');
        });
      }
    },
  ],
};
