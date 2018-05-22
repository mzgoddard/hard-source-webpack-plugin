// FIB_PATH='./fib'

require.ensure([], function(require) {
  const fib = require(${FIB_PATH});
  console.log(fib(3));
});
