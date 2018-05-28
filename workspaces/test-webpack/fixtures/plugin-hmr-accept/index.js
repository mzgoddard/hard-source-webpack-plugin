var fib = require('./fib');

console.log(fib(3));

if (module.hot) {
  module.hot.accept(function() {});
}
