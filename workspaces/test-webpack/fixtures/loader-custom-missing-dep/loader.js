var fs = require('fs');
var path = require('path');

module.exports = function(source) {
  this.cacheable && this.cacheable();
  this.addDependency(path.join(__dirname, 'fib.js'));
  return source;
};
