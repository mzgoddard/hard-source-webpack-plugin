var expect = require('chai').expect;

var itCompilesTwice = require('./util').itCompilesTwice;
var itCompilesChange = require('./util').itCompilesChange;

describe('plugin webpack use', function() {

  itCompilesTwice('plugin-dll');
  itCompilesTwice('plugin-dll-reference');
  itCompilesTwice('plugin-extract-text');
  itCompilesTwice('plugin-uglify-1dep');
  itCompilesTwice('plugin-extract-text-uglify');
  itCompilesTwice('plugin-extract-text-uglify-source-map');
  itCompilesTwice('plugin-extract-text-uglify-eval-source-map');
  itCompilesTwice('plugin-extract-text-html-uglify');
  itCompilesTwice('plugin-isomorphic-tools');

});

describe('plugin webpack use - builds changes', function() {

  itCompilesChange('plugin-hmr', {
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
    expect(Object.keys(output.run2).filter(function(key) {
      return /\.hot-update\.json/.test(key);
    })).to.length.of(1);
  });

});
