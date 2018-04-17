import(/* webpackChunkName: 'foo' */'./obj')
.then(({fib}) => {
  console.log(fib(3));
});
