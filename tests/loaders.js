var expect = require('chai').expect;

var util = require('./util');
var itCompilesTwice = util.itCompilesTwice;
var itCompilesChange = util.itCompilesChange;
var itCompilesHardModules = util.itCompilesHardModules;
var clean = util.clean;
var compile = util.compile;

describe('loader webpack use', function() {

  itCompilesTwice('loader-css');
  itCompilesTwice('loader-file');
  itCompilesTwice('loader-custom-missing-dep');
  itCompilesTwice('loader-custom-no-dep');

  itCompilesHardModules('loader-css', ['./index.css']);
  itCompilesHardModules('loader-file', ['./image.png']);
  itCompilesHardModules('loader-custom-user-loader', ['./loader.js!./index.js']);
  itCompilesHardModules('loader-custom-no-dep', ['./index.js', './loader.js!./fib.js']);

});

describe('loader webpack warnings & errors', function() {

  var fixturePath = 'loader-warning';

  before(function() {
    return clean(fixturePath);
  });

  it('should cache errors & warnings from loader', function() {
    this.timeout(10000);
    return compile(fixturePath, {exportStats: true})
      .then(function(run1) {
        return Promise.all([run1, compile(fixturePath, {exportStats: true})])
      }).then(function(runs) {
        expect(runs[0].out).to.eql(runs[1].out);
        expect(runs[0].warnings.length).to.greaterThan(0);
        expect(runs[0].errors.length).to.greaterThan(0);
        expect(runs[1].warnings).to.eql(runs[0].warnings);
        expect(runs[1].errors).to.eql(runs[0].errors);
      });
  });

});

describe('loader webpack use - builds changes', function() {

  itCompilesChange('loader-custom-context-dep', {
    'dir/a': [
      '// a',
    ].join('\n'),
    'dir/b': null,
  }, {
    'dir/a': null,
    'dir/b': [
      '// b',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/\/\/ a/);
    expect(output.run2['main.js'].toString()).to.match(/\/\/ b/);
  });

  itCompilesChange('loader-custom-deep-context-dep', {
    'dir/dirdir': null,
    'dir/subdir/a': '// a',
    'dir/subdir/b': null,
  }, {
    'dir/dirdir/a': null,
    'dir/dirdir/b': '// b',
    'dir/subdir': null,
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/\/\/ subdir\/a/);
    expect(output.run2['main.js'].toString()).to.match(/\/\/ dirdir\/b/);
  });

  itCompilesChange('loader-custom-prepend-helper', {
    'loader-helper.js': [
      'function helper(a) {',
      '  console.log(a);',
      '}',
    ].join('\n'),
  }, {
    'loader-helper.js': [
      'function helper(b) {',
      '  console.log(b);',
      '}',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/console\.log\(a\)/);
    expect(output.run2['main.js'].toString()).to.match(/console\.log\(b\)/);
  });

  itCompilesChange('loader-custom-missing-dep-added', {
    'fib.js': null,
  }, {
    'fib.js': [
      'module.exports = function(n) {',
      '  return n + (n > 0 ? n - 1 : 0);',
      '};',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.not.match(/n - 1/);
    expect(output.run2['main.js'].toString()).to.match(/n - 1/);
  });

  itCompilesChange('loader-custom-missing-dep-added', {
    'fib.js': [
      'module.exports = function(n) {',
      '  return n + (n > 0 ? n - 1 : 0);',
      '};',
    ].join('\n'),
  }, {
    'fib.js': null,
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/n - 1/);
    expect(output.run2['main.js'].toString()).to.not.match(/n - 1/);
  });

  itCompilesChange('loader-custom-no-dep-moved', {
    'fib.js': '',
    'fib/index.js': null,
  }, {
    'fib.js': null,
    'fib/index.js': '',
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/fib\.js/);
    expect(output.run1['main.js'].toString()).to.not.match(/fib\/index\.js/);
    expect(output.run2['main.js'].toString()).to.match(/fib\/index\.js/);
    expect(output.run2['main.js'].toString()).to.not.match(/fib\.js/);
  });

});
