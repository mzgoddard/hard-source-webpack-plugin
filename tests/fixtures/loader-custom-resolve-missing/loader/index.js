module.exports = function(source) {
  this.cacheable && this.cacheable();
  return [
    '// loader/index.js',
    source,
  ].join('\n');
};
