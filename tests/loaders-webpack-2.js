var expect = require('chai').expect;

var util = require('./util');
var describeWP2 = util.describeWP2;
var itCompilesChange = util.itCompilesChange;
var itCompilesTwice = util.itCompilesTwice;

describeWP2('loader webpack 2 use', function() {

  itCompilesTwice('loader-custom-function-option');

});

describeWP2('loader webpack 2 use - builds changes', function() {

  itCompilesChange('loader-custom-function-option', {
    'fib.js': 'foo',
  }, {
    'fib.js': 'bar',
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/foo/);
    expect(output.run2['main.js'].toString()).to.match(/bar/);
  });

});
