module.exports = function(source) {
  var done = this.async();
  this.cacheable();
  this.emitWarning("This is a test warning");
  this.emitError("This is a test error");
  done(null, source);
};
