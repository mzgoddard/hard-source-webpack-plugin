module.exports = function(source) {
  this.cacheable && this.cacheable();
  return [
    '// web_modules/loader/index.js',
    source,
  ].join('\n');
};
