var expect = require('chai').expect;

var util = require('./util');
var describeWP = util.describeWP;
var itCompilesChange = util.itCompilesChange;
var itCompilesTwice = util.itCompilesTwice;

describeWP(3)('loader webpack 3 use', function() {

  itCompilesTwice('loader-worker-1dep');
  itCompilesTwice('loader-worker-1dep', {exportStats: true});

});
