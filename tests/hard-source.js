var fs = require('fs');

var expect = require('chai').expect;

var itCompilesChange = require('./util').itCompilesChange;

describe('hard-source features', function() {

  itCompilesChange('hard-source-confighash', {
    'config-hash': 'a',
    'fib.js': [
      'module.exports = function(n) {',
      '  return n + (n > 0 ? n - 1 : 0);',
      '};',
    ].join('\n'),
    'fib/index.js': null,
  }, {
    'config-hash': 'b',
    'fib.js': null,
    'fib/index.js': [
      'module.exports = function(n) {',
      '  return n + (n > 0 ? n - 2 : 0);',
      '};',
    ].join('\n'),
  }, function(output) {
    expect(fs.readdirSync(__dirname + '/fixtures/hard-source-confighash/tmp/cache'))
    .to.have.length(6);
  });

  itCompilesChange('hard-source-confighash-dir', {
    'config-hash': 'a',
    'fib.js': [
      'module.exports = function(n) {',
      '  return n + (n > 0 ? n - 1 : 0);',
      '};',
    ].join('\n'),
    'fib/index.js': null,
  }, {
    'config-hash': 'b',
    'fib.js': null,
    'fib/index.js': [
      'module.exports = function(n) {',
      '  return n + (n > 0 ? n - 2 : 0);',
      '};',
    ].join('\n'),
  }, function(output) {
    expect(fs.readdirSync(__dirname + '/fixtures/hard-source-confighash-dir/tmp/cache'))
    .to.have.length(2);
  });

});
