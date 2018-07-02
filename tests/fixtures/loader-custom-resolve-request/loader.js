module.exports = function(source) {
  this.cacheable && this.cacheable();
  return new Promise(
    (f, e) => this.resolve(this.context, './fab', (er, v) => er ? e(er) : f(v))
  )
  .then(v => JSON.stringify(v));
};
