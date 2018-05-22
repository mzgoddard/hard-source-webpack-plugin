module.exports = function(source) {
  this.cacheable && this.cacheable();
  return [
    '// loader.js',
    source,
  ].join('\n');
};