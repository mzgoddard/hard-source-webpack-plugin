const {stringifyRequest} = require('loader-utils');

module.exports = function(source) {};

module.exports.pitch = function(remaining) {
  this.cacheable && this.cacheable();
  return `module.exports = require(${stringifyRequest(this, `./loader-2!${remaining}`)});`;
};
