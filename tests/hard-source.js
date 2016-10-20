var fs = require('fs');

var expect = require('chai').expect;

var itCompilesChange = require('./util').itCompilesChange;
var itCompiles = require('./util').itCompiles;
var itCompilesWithCache = require('./util').itCompilesWithCache;
var writeFiles = require('./util').writeFiles;

describe('hard-source features', function() {

  describe('with identical content, but has changed', function() {
    context('with an update, but identical content', function() {
      itCompilesWithCache(
        'does not change the cache without a content change',
        'hard-source-md5',
        function() {
          return writeFiles('hard-source-md5', {
            'fib.js': [
              'module.exports = function(n) {',
              '  return n + (n > 0 ? n - 1 : 0);',
              '};',
            ].join('\n')
          })
        },
        function() {
          return writeFiles('hard-source-md5', {
            'fib.js': [
              'module.exports = function(n) {',
              '  return n + (n > 0 ? n - 1 : 0);',
              '};',
            ].join('\n')
          })
        },
        function(cache1, cache2) {
          expect(cache1).to.eql(cache2);
        }
      );
    });

    context('with an update and different content', function() {
      itCompilesWithCache(
        'does not change the cache without a content change',
        'hard-source-md5',
        function() {
          return writeFiles('hard-source-md5', {
            'fib.js': [
              'module.exports = function(n) {',
              '  return n + (n > 0 ? n - 1 : 0);',
              '};',
            ].join('\n')
          });
        },
        function() {
          return writeFiles('hard-source-md5', {
            'fib.js': [
              'module.exports = function(n) {',
              '  return 1;',
              '};',
            ].join('\n')
          });
        },
        function(cache1, cache2) {
          expect(cache1).to.not.eql(cache2);
        }
      );
    });
  });

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
