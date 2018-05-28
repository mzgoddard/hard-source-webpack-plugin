module.exports = function(source) {
  this.cacheable && this.cacheable();
  return '// loader-b\n' + source;
};
