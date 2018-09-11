module.exports = function(source) {
  this.cacheable && this.cacheable();
  var helperPath = require.resolve('./loader-helper.js');
  this.addDependency(helperPath);
  return require('graceful-fs').readFileSync(helperPath, 'utf8') + source;
};
