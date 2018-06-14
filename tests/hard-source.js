var fs = require('fs');

var expect = require('chai').expect;

var itCompiles = require('./util').itCompiles;
var itCompilesChange = require('./util').itCompilesChange;
var itCompilesHardModules = require('./util').itCompilesHardModules;
var itCompilesTwice = require('./util').itCompilesTwice;
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
          delete cache1.__hardSource_parityToken_root;
          delete cache2.__hardSource_parityToken_root;
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

  function itCompilesEnvironmentHashDisabled(key, config, config2) {
    itCompiles('compiles hard-source-environmenthash-' + key + ' with out of date vendor when environment paths disabled', 'hard-source-environmenthash', function() {
      return writeFiles('hard-source-environmenthash', {
        'hard-source-config.js': config.join('\n'),
        'vendor/lib1.js': 'console.log("a");\n',
      });
    }, function() {
      return writeFiles('hard-source-environmenthash', {
        'hard-source-config.js': (config2 || config).join('\n'),
        'vendor/lib1.js': 'console.log("b");\n',
      });
    }, function(output) {
      expect(output.run1).to.eql(output.run2);
      expect(output.run2['main.js']).to.not.match(/"b"/);
    });
  }

  function itCompilesEnvironmentHash(key, config, config2) {
    itCompiles('compiles hard-source-environmenthash-' + key + ' with fresh cache', 'hard-source-environmenthash', function() {
      return writeFiles('hard-source-environmenthash', {
        'hard-source-config.js': config.join('\n'),
        'vendor/lib1.js': 'console.log("a");\n',
        'env-hash': 'a',
      });
    }, function() {
      return writeFiles('hard-source-environmenthash', {
        'hard-source-config.js': (config2 || config).join('\n'),
        'vendor/lib1.js': 'console.log("b");\n',
        'env-hash': 'b',
      })
      .then(function() {
        return fs.readFileSync(__dirname + '/fixtures/hard-source-environmenthash/tmp/cache/stamp', 'utf8');
      });
    }, function(output) {
      var stamp = fs.readFileSync(__dirname + '/fixtures/hard-source-environmenthash/tmp/cache/stamp', 'utf8');
      expect(stamp).to.not.equal(output.setup2);
    });
  }

  itCompilesEnvironmentHashDisabled('false', [
    '{',
    '  cacheDirectory: "cache",',
    '  environmentHash: false,',
    '}',
  ], [
    '{',
    '  cacheDirectory: "cache",',
    '  environmentHash: false,',
    '}',
  ]);

  itCompilesEnvironmentHash('string', [
    '{',
    '  cacheDirectory: "cache",',
    '  environmentHash: "a",',
    '}',
  ], [
    '{',
    '  cacheDirectory: "cache",',
    '  environmentHash: "b",',
    '}',
  ]);

  itCompilesEnvironmentHash('envhash', [
    '{',
    '  cacheDirectory: "cache",',
    '  environmentHash: {',
    '    root: __dirname,',
    '    directories: ["vendor"],',
    '    files: [],',
    '  },',
    '}',
  ]);

  itCompilesEnvironmentHash('envhash-files', [
    '{',
    '  cacheDirectory: "cache",',
    '  environmentHash: {',
    '    root: __dirname,',
    '    directories: ["vendor"],',
    '    files: ["env-hash"],',
    '  },',
    '}',
  ]);

  itCompilesEnvironmentHash('function', [
    '{',
    '  cacheDirectory: "cache",',
    '  environmentHash: function(config) {',
    '    return fs.readFileSync(__dirname + "/env-hash", "utf8");',
    '  },',
    '}',
  ]);

  itCompilesEnvironmentHash('function-promise', [
    '{',
    '  cacheDirectory: "cache",',
    '  environmentHash: function(config) {',
    '    return new Promise(function(resolve, reject) {',
    '      fs.readFile(__dirname + "/env-hash", "utf8", function(err, src) {',
    '        if (err) {return reject(err);}',
    '        resolve(src);',
    '      });',
    '    });',
    '  },',
    '}',
  ]);

  var _packageYarnLockHashConfig = [
    '{',
    '  cacheDirectory: "cache",',
    '  environmentHash: {',
    '    root: __dirname,',
    '  },',
    '}',
  ];

  function itCompilesPackageYarnLockHash(key, files1, files2) {
    itCompiles('compiles hard-source-packageyarnlock-hash ' + key + ' with fresh cache', 'hard-source-packageyarnlock-hash', function() {
      return writeFiles('hard-source-packageyarnlock-hash', Object.assign({
        'hard-source-config.js': _packageYarnLockHashConfig.join('\n'),
      }, files1));
    }, function() {
      return writeFiles('hard-source-packageyarnlock-hash', Object.assign({
        'hard-source-config.js': _packageYarnLockHashConfig.join('\n'),
      }, files2))
      .then(function() {
        return fs.readFileSync(__dirname + '/fixtures/hard-source-packageyarnlock-hash/tmp/cache/stamp', 'utf8');
      });
    }, function(output) {
      var stamp = fs.readFileSync(__dirname + '/fixtures/hard-source-packageyarnlock-hash/tmp/cache/stamp', 'utf8');
      expect(stamp).to.not.equal(output.setup2);
    });
  }

  itCompilesPackageYarnLockHash('package-lock', {
    'package-lock.json': 'a',
    'yarn.lock': null,
  }, {
    'package-lock.json': 'b',
    'yarn.lock': null,
  });

  itCompilesPackageYarnLockHash('yarn-lock', {
    'package-lock.json': null,
    'yarn.lock': 'a',
  }, {
    'package-lock.json': null,
    'yarn.lock': 'b',
  });

  itCompilesPackageYarnLockHash('package-yarn-lock', {
    'package-lock.json': 'a',
    'yarn.lock': 'b',
  }, {
    'package-lock.json': 'a',
    'yarn.lock': 'c',
  });

  itCompilesPackageYarnLockHash('package-yarn-lock-2', {
    'package-lock.json': 'a',
    'yarn.lock': 'b',
  }, {
    'package-lock.json': 'c',
    'yarn.lock': 'b',
  });

  itCompilesTwice('hard-source-exclude-plugin');
  itCompilesHardModules('hard-source-exclude-plugin', ['./index.js', '!./fib.js']);

});
