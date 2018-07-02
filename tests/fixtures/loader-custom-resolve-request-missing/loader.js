module.exports = function(source) {
  this.cacheable && this.cacheable();
  const done = this.async();
  new Promise(
    (f, e) => this.resolve(this.context, './fab', (er, v) => (er ? f('unresolved') : f(v)))
  )
  .then(v => JSON.stringify(v))
  .then(v => done(null, v), done);
};
