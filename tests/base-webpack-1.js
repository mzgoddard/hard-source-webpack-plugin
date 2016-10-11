var expect = require('chai').expect;

var itCompilesTwice = require('./util').itCompilesTwice;
var itCompilesChange = require('./util').itCompilesChange;

describe('basic webpack use - compiles identically', function() {

  itCompilesTwice('base-1dep');
  itCompilesTwice('base-10deps-1nest');
  itCompilesTwice('base-context');
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

});
