var a = 0;
try {
  var context = require.context('./a');
  context.keys().forEach(function(m) {a += context(m);});
}
catch (_) {}

console.log(a + require('./b'));
