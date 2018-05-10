define('./fib', function() {
  return function(n) {
    return n + (n > 0 ? n - 1 : 0);
  };
});

define(['./fib'], function(fib) {
  console.log(fib(3));
});
