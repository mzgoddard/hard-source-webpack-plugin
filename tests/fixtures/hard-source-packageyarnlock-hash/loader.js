module.exports = function(source) {
  return require('graceful-fs').readFileSync('./vendor/lib1.js') + source;
};
