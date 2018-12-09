var fs = require('graceful-fs');
var path = require('path');

module.exports = function(source) {};

module.exports.pitch = function(remainingRequest) {
  this.cacheable && this.cacheable();
  return '// ' + remainingRequest.replace(/\\/g, '/');
};
