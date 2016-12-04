module.exports = function(source) {
  this.cacheable && this.cacheable();
  return source;
};
