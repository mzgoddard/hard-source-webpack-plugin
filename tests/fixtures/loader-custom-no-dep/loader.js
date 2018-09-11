var fs = require('graceful-fs');
var path = require('path');

module.exports = function(source) {};

module.exports.pitch = function() {
  this.cacheable && this.cacheable();
  return '// no source';
};
