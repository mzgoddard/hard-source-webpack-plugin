var context = require.context('.', true, /\d/);

module.exports = context.keys()
  .reduce(function(carry, key) {
    return carry + context(key);
  }, 0);
