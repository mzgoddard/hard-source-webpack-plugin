var fib;
try {
  fib = require('./fib');
}
catch (_) {
  fib = function(v) {return v;};
}

console.log(fib(3));
