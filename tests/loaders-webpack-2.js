var expect = require('chai').expect;

var util = require('./util');
var itCompilesTwice = util.itCompilesTwice;
var itCompilesChange = util.itCompilesChange;
var itCompilesHardModules = util.itCompilesHardModules;
var describeWP2 = util.describeWP2;
var clean = util.clean;
var compile = util.compile;

describeWP2('loader webpack 2 use - builds changes', function() {

  itCompilesChange('loader-custom-resolve-missing-vendor', {
    'vendor/fib': null,
    // A folder
    'vendor/loader': {},
  }, {
    // into a file
    'vendor/loader': [
      'module.exports = function(source) {',
      '  this.cacheable && this.cacheable();',
      '  return [',
      '    \'// vendor/loader\',',
      '    source,',
      '  ].join(\'\\n\');',
      '};',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/web_modules\/loader\/index\.js/);
    expect(output.run2['main.js'].toString()).to.match(/vendor\/loader\n/);
  });

  itCompilesChange('loader-custom-resolve-missing-vendor', {
    'vendor/fib': null,
    // A file
    'vendor/loader': [
      'module.exports = function(source) {',
      '  this.cacheable && this.cacheable();',
      '  return [',
      '    \'// vendor/loader\',',
      '    source,',
      '  ].join(\'\\n\');',
      '};',
    ].join('\n'),
  }, {
    // (use (non-standard-promised) js key ordering to delete the file)
    'vendor/loader': null,
    // into a folder
    'vendor/loader/index.js': [
      'module.exports = function(source) {',
      '  this.cacheable && this.cacheable();',
      '  return [',
      '    \'// vendor/loader/index.js\',',
      '    source,',
      '  ].join(\'\\n\');',
      '};',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/vendor\/loader\n/);
    expect(output.run2['main.js'].toString()).to.match(/vendor\/loader\/index\.js/);
  });

});
