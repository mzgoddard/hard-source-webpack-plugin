var expect = require('chai').expect;

var itCompilesTwice = require('./util').itCompilesTwice;
var itCompilesChange = require('./util').itCompilesChange;
var itCompilesHardModules = require('./util').itCompilesHardModules;

describe('basic webpack use - compiles identically', function() {

  itCompilesTwice('base-1dep');
  itCompilesTwice('base-10deps-1nest');
  itCompilesTwice('base-context');
  itCompilesTwice('base-deep-context');
  itCompilesTwice('base-process-env');
  itCompilesTwice('base-code-split');
  itCompilesTwice('base-code-split-process');
  itCompilesTwice('base-code-split-nest');
  itCompilesTwice('base-devtool-eval');
  itCompilesTwice('base-devtool-eval-source-map');
  itCompilesTwice('base-devtool-source-map');
  itCompilesTwice('base-devtool-cheap-source-map');
  itCompilesTwice('base-target-node-1dep');
  itCompilesTwice('base-error-resolve');
  itCompilesTwice('base-amd-1dep');
  itCompilesTwice('base-amd-context');
  itCompilesTwice('base-amd-code-split');
  itCompilesTwice('base-external');
  itCompilesTwice('base-1dep-optional', {exportStats: true});
  itCompilesTwice('base-context-optional', {exportStats: true});

});

describe('basic webpack use - compiles hard modules', function() {

  itCompilesHardModules('base-1dep', ['./fib.js', './index.js']);
  itCompilesHardModules('base-context', ['./a nonrecursive \\d']);
  itCompilesHardModules('base-deep-context', ['./a \\d']);
  itCompilesHardModules('base-code-split', ['./fib.js', './index.js']);
  itCompilesHardModules('base-query-request', ['./fib.js?argument']);
  itCompilesHardModules('base-external', ['./index.js']);

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
      '  return n + (n > 0 ? n - 1 : 0);',
      '};',
    ].join('\n'),
  }, function(output) {
    var oldId = /var fib = __webpack_require__\((\d+)\)/
    .exec(output.run1['main.js'].toString())[1];
    expect(output.run2['main.js'].toString())
    .to.not.contain('__webpack_require__(' + oldId + ')');
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
      'module.exports = 6;',
    ].join('\n'),
    'b/7.js': null,
    'b/7/index.js': [
      'module.exports = 7;',
    ].join('\n'),
  }, function(output) {
    var oldId = /var b = module.exports =\n\s+__webpack_require__\((\d+)\)/
    .exec(output.run1['main.js'].toString())[1];
    expect(output.run2['main.js'].toString())
    .to.not.contain('__webpack_require__(' + oldId + ')');
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

});
