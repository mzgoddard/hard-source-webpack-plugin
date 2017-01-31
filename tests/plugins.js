var expect = require('chai').expect;

var clean = require('./util').clean;
var compile = require('./util').compile;
var itCompilesTwice = require('./util').itCompilesTwice;
var itCompilesChange = require('./util').itCompilesChange;
var itCompilesHardModules = require('./util').itCompilesHardModules;

describe('plugin webpack use', function() {

  itCompilesTwice('plugin-dll');
  itCompilesTwice('plugin-dll-reference');
  itCompilesTwice('plugin-dll-reference-scope');
  itCompilesTwice('plugin-html-lodash');
  itCompilesTwice('plugin-extract-text');
  itCompilesTwice('plugin-extract-text-loader-file');
  itCompilesTwice('plugin-uglify-1dep');
  itCompilesTwice('plugin-extract-text-uglify');
  itCompilesTwice('plugin-extract-text-uglify-source-map');
  itCompilesTwice('plugin-extract-text-uglify-eval-source-map');
  itCompilesTwice('plugin-extract-text-html-uglify');
  itCompilesTwice('plugin-isomorphic-tools');
  itCompilesTwice('plugin-hmr', {exportStats: true});
  itCompilesTwice('plugin-hmr-accept', {exportStats: true});
  itCompilesTwice('plugin-hmr-accept-dep', {exportStats: true});
  itCompilesTwice('plugin-hmr-process-env', {exportStats: true});
  itCompilesTwice('plugin-ignore-1dep');
  itCompilesTwice('plugin-ignore-context');
  itCompilesTwice('plugin-ignore-context-members');

  itCompilesHardModules('plugin-dll', ['./fib.js']);
  itCompilesHardModules('plugin-dll-reference', ['./index.js']);
  itCompilesHardModules('plugin-dll-reference-scope', ['./index.js']);
  itCompilesHardModules('plugin-html-lodash', [/lodash\/lodash\.js$/, /\!\.\/index\.html$/]);

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

  itCompilesChange('plugin-hmr-process-env', {
    'fib.js': [
      'module.exports = function(n) {',
      '  if (process.env.NODE_ENV !== "production") {',
      '    return n + (n > 0 ? n - 3 : 0);',
      '  }',
      '  else {',
      '    return n + (n > 0 ? n - 2 : 0);',
      '  }',
      '};',
    ].join('\n'),
    'fib/index.js': null,
  }, {
    'fib.js': null,
    'fib/index.js': [
      'module.exports = function(n) {',
      '  if (process.env.NODE_ENV !== "production") {',
      '    return n + (n > 0 ? n - 2 : 0);',
      '  }',
      '  else {',
      '    return n + (n > 0 ? n - 1 : 0);',
      '  }',
      '};',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/n - 3/);
    expect(output.run2['main.js'].toString()).to.match(/n - 1/);
    expect(Object.keys(output.run2).filter(function(key) {
      return /\.hot-update\.json/.test(key);
    })).to.length.of(1);
  });

  // before(function() {
  //   clean('plugin-hmr-process-env');
  // });
  //
  // it('plugin-hmr-process-env stats', function() {
  //   return compile('plugin-hmr-process-env')
  //   .then(function() {
  //     return compile('plugin-hmr-process-env', {outputStats: true});
  //   });
  // });

});
