var fs = require('fs');
var path = require('path');

module.exports = function(source) {
  this.cacheable && this.cacheable();
  var file = path.join(__dirname, 'fib.js');
  try {
    fs.statSync(file);
    return [
      'var fib = require("./fib.js");',
      source,
    ].join('\n');
  }
  catch (_) {
    this.addDependency(file);
  }
  return source;
};
