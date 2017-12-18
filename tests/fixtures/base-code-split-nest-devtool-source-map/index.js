require([], function() {
  var fib = require('./fib');
  require([], function() {
    var sq = require('./sq');

    console.log(fib(sq(3)));
  });
});
