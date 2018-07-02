var expect = require('chai').expect;

var util = require('./util');
var describeWP = util.describeWP;
var itCompilesChange = util.itCompilesChange;
var itCompilesTwice = util.itCompilesTwice;

describeWP(3)('loader webpack 3 use', function() {

  itCompilesTwice('loader-worker-1dep');
  itCompilesTwice('loader-worker-1dep', {exportStats: true});

});

describeWP(3)('loader webpack 3 use - builds changes', function() {

  itCompilesChange('loader-custom-resolve-request', {
    'fab.js': null,
  }, {
    'fab.js': 'bar',
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/fab(\/|\\\\|\\\\\\\\)index\.js/);
    expect(output.run2['main.js'].toString()).to.match(/fab\.js/);
  });

  itCompilesChange('loader-custom-resolve-request', {
    'fab.js': 'bar',
  }, {
    'fab.js': null,
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/fab\.js/);
    expect(output.run2['main.js'].toString()).to.match(/fab(\/|\\\\|\\\\\\\\)index\.js/);
  });

});

