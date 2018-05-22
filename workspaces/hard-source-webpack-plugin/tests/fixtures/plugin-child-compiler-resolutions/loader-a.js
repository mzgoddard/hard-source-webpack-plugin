module.exports = function(source) {
  this.cacheable && this.cacheable();
  return '// loader-a\n' + source;
};
