const {writeFiles, template} = require('hard-source-webpack-test-generator');

writeFiles({
  'fib.js': template('fib/*/a.js'),
  'nest.js': template('split/*/index.js'),
  'index.js': template('split/*/index.js', {
    FIB_PATH='./nest',
  }),
  'webpack.config.js': template('fib/webpack.config.js'),
});

writeFiles({
  'fib.js': template('fib/*/b.js'),
});
