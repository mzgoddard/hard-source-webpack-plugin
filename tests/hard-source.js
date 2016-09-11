var fs = require('fs');

var expect = require('chai').expect;

var itCompilesChange = require('./util').itCompilesChange;
var itCompiles = require('./util').itCompiles;
var writeFiles = require('./util').writeFiles;

describe('hard-source features', function() {

  itCompiles('compiles hard-source-confighash with fresh cache', 'hard-source-confighash', function() {
    return writeFiles('hard-source-confighash', {
      'config-hash': 'a',
    });
  }, function() {
    return writeFiles('hard-source-confighash', {
      'config-hash': 'b',
    })
    .then(function() {
      return fs.readFileSync(__dirname + '/fixtures/hard-source-confighash/tmp/cache/stamp', 'utf8');
    });
  }, function(output) {
    var stamp = fs.readFileSync(__dirname + '/fixtures/hard-source-confighash/tmp/cache/stamp', 'utf8');
    expect(stamp).to.not.equal(output.setup2);
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
