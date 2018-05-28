module.exports = function(source) {
  return require('fs').readFileSync('./vendor/lib1.js') + source;
};
