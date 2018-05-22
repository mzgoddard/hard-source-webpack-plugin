test(() => {
  writeFiles({
    'fib.js': template`fib/*/a.js`,
    'index.js': template`fib/*/index.js`,
    'webpack.config.js': template`fib/webpack.config.js`,
  });

  writeFiles({
    'fib.js': template`fib/*/b.js`,
  });
});
