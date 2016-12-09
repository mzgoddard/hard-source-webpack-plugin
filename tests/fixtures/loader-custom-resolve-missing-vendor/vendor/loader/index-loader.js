module.exports = function(source) {
  this.cacheable && this.cacheable();
  return [
    '// vendor/loader/index-loader.js',
    source,
  ].join('\n');
};