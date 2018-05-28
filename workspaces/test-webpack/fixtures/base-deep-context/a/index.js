var context = require.context('.', true, /\d/);

module.exports =
  context('./1') +
  context('./2') +
  context('./3') +
  context('./4') +
  context('./5') +
  context('./b/6') +
  context('./b/7') +
  context('./b/8') +
  context('./b/9') +
  context('./b/10');
