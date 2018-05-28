var context = require.context('.', false, /\d/);

module.exports = context.keys().reduce(function(carry, key) {
  return carry + context(key);
}, 0);
