var expect = require('chai').expect;

var itCompilesTwice = require('./util').itCompilesTwice;
var itCompilesChange = require('./util').itCompilesChange;
var itCompilesHardModules = require('./util').itCompilesHardModules;

describe('basic webpack use - compiles identically', function() {

  itCompilesTwice('base-10deps-1nest');
  itCompilesTwice('base-10deps-1nest', {exportStats: true});
  itCompilesTwice('base-1dep');
  itCompilesTwice('base-1dep', {exportStats: true});
  itCompilesTwice('base-1dep-hash-filename');
  itCompilesTwice('base-1dep-hash-filename', {exportStats: true});
  itCompilesTwice('base-1dep-optional');
  itCompilesTwice('base-1dep-optional', {exportStats: true});
  itCompilesTwice('base-amd-1dep');
  itCompilesTwice('base-amd-1dep', {exportStats: true});
  itCompilesTwice('base-amd-code-split');
  itCompilesTwice('base-amd-code-split', {exportStats: true});
  itCompilesTwice('base-amd-context');
  itCompilesTwice('base-amd-context', {exportStats: true});
  itCompilesTwice('base-code-split');
  itCompilesTwice('base-code-split', {exportStats: true});
  itCompilesTwice('base-code-split-devtool-source-map');
  itCompilesTwice('base-code-split-devtool-source-map', {exportStats: true});
  itCompilesTwice('base-code-split-nest');
  itCompilesTwice('base-code-split-nest', {exportStats: true});
  itCompilesTwice('base-code-split-nest-devtool-source-map');
  itCompilesTwice('base-code-split-nest-devtool-source-map', {exportStats: true});
  itCompilesTwice('base-code-split-process');
  itCompilesTwice('base-code-split-process', {exportStats: true});
  itCompilesTwice('base-context');
  itCompilesTwice('base-context', {exportStats: true});
  itCompilesTwice('base-context-devtool-source-map');
  itCompilesTwice('base-context-devtool-source-map', {exportStats: true});
  itCompilesTwice('base-context-optional');
  itCompilesTwice('base-context-optional', {exportStats: true});
  itCompilesTwice('base-deep-context');
  itCompilesTwice('base-deep-context', {exportStats: true});
  itCompilesTwice('base-deep-context-devtool-source-map');
  itCompilesTwice('base-deep-context-devtool-source-map', {exportStats: true});
  itCompilesTwice('base-devtool-cheap-source-map');
  itCompilesTwice('base-devtool-cheap-source-map', {exportStats: true});
  itCompilesTwice('base-devtool-eval');
  itCompilesTwice('base-devtool-eval', {exportStats: true});
  itCompilesTwice('base-devtool-eval-source-map');
  itCompilesTwice('base-devtool-eval-source-map', {exportStats: true});
  itCompilesTwice('base-devtool-eval-source-map-hash-filename');
  itCompilesTwice('base-devtool-eval-source-map-hash-filename', {exportStats: true});
  itCompilesTwice('base-devtool-inline-cheap-source-map');
  itCompilesTwice('base-devtool-inline-cheap-source-map', {exportStats: true});
  itCompilesTwice('base-devtool-inline-cheap-source-map-hash-filename');
  itCompilesTwice('base-devtool-inline-cheap-source-map-hash-filename', {exportStats: true});
  itCompilesTwice('base-devtool-source-map');
  itCompilesTwice('base-devtool-source-map', {exportStats: true});
  itCompilesTwice('base-devtool-source-map-hash-filename');
  itCompilesTwice('base-devtool-source-map-hash-filename', {exportStats: true});
  itCompilesTwice('base-error-resolve');
  itCompilesTwice('base-error-resolve', {exportStats: true});
  itCompilesTwice('base-external');
  itCompilesTwice('base-external', {exportStats: true});
  itCompilesTwice('base-path-info');
  itCompilesTwice('base-path-info', {exportStats: true});
  itCompilesTwice('base-process-env');
  itCompilesTwice('base-process-env', {exportStats: true});
  itCompilesTwice('base-records-json');
  itCompilesTwice('base-records-json', {exportStats: true});
  itCompilesTwice('base-target-node-1dep');
  itCompilesTwice('base-target-node-1dep', {exportStats: true});

});

describe('basic webpack use - compiles hard modules', function() {

  itCompilesHardModules('base-1dep', ['./fib.js', './index.js']);
  itCompilesHardModules('base-context', ['./a nonrecursive \\d', './a/index.js']);
  itCompilesHardModules('base-deep-context', ['./a \\d']);
  itCompilesHardModules('base-code-split', ['./fib.js', './index.js']);
  itCompilesHardModules('base-query-request', ['./fib.js?argument']);
  itCompilesHardModules('base-external', ['./index.js']);
  itCompilesHardModules('base-options-default', ['./fib.js', './index.js']);

});

describe('basic webpack use - builds changes', function() {

  itCompilesChange('base-change-1dep', {
    'fib.js': [
      'module.exports = function(n) {',
      '  return n + (n > 0 ? n - 1 : 0);',
      '};',
    ].join('\n'),
    'fib/index.js': null,
  }, {
    'fib.js': null,
    'fib/index.js': [
      'module.exports = function(n) {',
      '  return n + (n > 0 ? n - 2 : 0);',
      '};',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/n - 1/);
    expect(output.run2['main.js'].toString()).to.match(/n - 2/);
  });

  itCompilesChange('base-move-1dep', {
    'fib.js': [
      'module.exports = function(n) {',
      '  return n + (n > 0 ? n - 1 : 0);',
      '};',
    ].join('\n'),
    'fib/index.js': null,
  }, {
    'fib.js': null,
    'fib/index.js': [
      'module.exports = function(n) {',
      '  return n + (n > 0 ? n - 2 : 0);',
      '};',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/n - 1/);
    expect(output.run1['main.js'].toString()).to.not.match(/n - 2/);
    expect(output.run2['main.js'].toString()).to.match(/n - 2/);
    expect(output.run2['main.js'].toString()).to.not.match(/n - 1/);
  });

  itCompilesChange('base-change-context', {
    'a/1.js': 'module.exports = 1;\n',
    'a/11.js': null,
  }, {
    'a/1.js': null,
    'a/11.js': 'module.exports = 11;\n',
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/ = 1;/);
    expect(output.run1['main.js'].toString()).to.not.match(/ = 11;/);
    expect(output.run2['main.js'].toString()).to.match(/ = 11;/);
    expect(output.run2['main.js'].toString()).to.not.match(/ = 1;/);
  });

  itCompilesChange('base-move-context', {
    'a/1/index.js': null,
    'a/1.js': 'module.exports = 1;\n',
  }, {
    'a/1/index.js': 'module.exports = 1;\n',
    'a/1.js': null,
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/1\.js/);
    expect(output.run2['main.js'].toString()).to.match(/1\/index\.js/);
  });

  itCompilesChange('base-move-10deps-1nest', {
    'b/6.js': [
      'module.exports = 6;',
    ].join('\n'),
    'b/6/index.js': null,
    // Change a second file make sure multiple invalidations don't
    // break everything.
    'b/7.js': [
      'module.exports = 7;',
    ].join('\n'),
    'b/7/index.js': null,
  }, {
    'b/6.js': null,
    'b/6/index.js': [
      'module.exports = 60;',
    ].join('\n'),
    'b/7.js': null,
    'b/7/index.js': [
      'module.exports = 70;',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/ = 6;/);
    expect(output.run1['main.js'].toString()).to.not.match(/ = 60;/);
    expect(output.run2['main.js'].toString()).to.match(/ = 60;/);
    expect(output.run2['main.js'].toString()).to.not.match(/ = 6;/);
  });

  itCompilesChange('base-deep-context', {
    'a/b/11.js': null,
    'a/b/11-2.js': null,
  }, {
    'a/b/11.js': 'module.exports = 11;',
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.not.match(/11\.js/);
    expect(output.run1['main.js'].toString()).to.not.match(/exports = 11/);
    expect(output.run2['main.js'].toString()).to.match(/11\.js/);
    expect(output.run2['main.js'].toString()).to.match(/exports = 11/);
  });

  itCompilesChange('base-deep-context', {
    'a/b/11.js': 'module.exports = 11;',
    'a/b/11-2.js': null,
  }, {
    'a/b/11.js': null,
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/11\.js/);
    expect(output.run1['main.js'].toString()).to.match(/exports = 11/);
    expect(output.run2['main.js'].toString()).to.not.match(/11\.js/);
    expect(output.run2['main.js'].toString()).to.not.match(/exports = 11/);
  });

  itCompilesChange('base-deep-context', {
    'a/b/11.js': 'module.exports = 11;',
    'a/b/11-2.js': null,
  }, {
    'a/b/11.js': null,
    'a/b/11-2.js': 'module.exports = 11;',
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/11\.js/);
    expect(output.run1['main.js'].toString()).to.not.match(/11-2\.js/);
    expect(output.run1['main.js'].toString()).to.match(/exports = 11/);
    expect(output.run2['main.js'].toString()).to.not.match(/11\.js/);
    expect(output.run2['main.js'].toString()).to.match(/11-2\.js/);
    expect(output.run2['main.js'].toString()).to.match(/exports = 11/);
  });

  itCompilesChange('base-deep-context', {
    'a/b/c/12.js': null,
  }, {
    'a/b/c/12.js': 'module.exports = 12;',
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.not.match(/c\/12\.js/);
    expect(output.run1['main.js'].toString()).to.not.match(/exports = 12/);
    expect(output.run2['main.js'].toString()).to.match(/c\/12\.js/);
    expect(output.run2['main.js'].toString()).to.match(/exports = 12/);
  });

  itCompilesChange('base-deep-context', {
    'a/b/c/12.js': 'module.exports = 12;',
  }, {
    'a/b/c': null,
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/c\/12\.js/);
    expect(output.run1['main.js'].toString()).to.match(/exports = 12/);
    expect(output.run2['main.js'].toString()).to.not.match(/c\/12\.js/);
    expect(output.run2['main.js'].toString()).to.not.match(/exports = 12/);
  });

  itCompilesChange('base-context-move', {
    'vendor/a/1.js': 'module.exports = 1;',
    'vendor/a/2.js': 'module.exports = 2;',
    'vendor/a/3.js': 'module.exports = 3;',
    'vendor/a/4.js': 'module.exports = 4;',
    'vendor/a/5.js': 'module.exports = 5;',
    'web_modules/a': null,
  }, {
    'web_modules/a/1.js': 'module.exports = 11;',
    'web_modules/a/2.js': 'module.exports = 12;',
    'web_modules/a/3.js': 'module.exports = 13;',
    'web_modules/a/4.js': 'module.exports = 14;',
    'web_modules/a/5.js': 'module.exports = 15;',
    'vendor/a': null,
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/exports = 1;/);
    expect(output.run1['main.js'].toString()).to.not.match(/exports = 11;/);
    expect(output.run2['main.js'].toString()).to.match(/exports = 11;/);
    expect(output.run2['main.js'].toString()).to.not.match(/exports = 1;/);
  });

  itCompilesChange('base-resolve-missing', {
    'fib.js': null,
  }, {
    'fib.js': [
      'module.exports = function(n) {',
      '  return n + (n > 0 ? n - 2 : 0);',
      '};',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/n - 1/);
    expect(output.run2['main.js'].toString()).to.match(/n - 2/);
  });

});
