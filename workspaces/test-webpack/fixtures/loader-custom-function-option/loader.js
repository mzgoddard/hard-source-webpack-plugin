var loaderUtils = require('loader-utils');

module.exports = function(source) {
  var options = loaderUtils.getOptions(this);
  return options.handle(source);
};
