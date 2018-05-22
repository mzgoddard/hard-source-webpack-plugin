var context = require.context('a', true, /\d/);

module.exports =
  context('./1') +
  context('./2') +
  context('./3') +
  context('./4') +
  context('./5');