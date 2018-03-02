var expect = require('chai').expect;

var itCompilesTwice = require('./util').itCompilesTwice;
var itCompilesChange = require('./util').itCompilesChange;
var itCompilesHardModules = require('./util').itCompilesHardModules;
var describeWP = require('./util').describeWP;

describeWP(4)('basic webpack 4 use - compiles identically', function() {

  itCompilesTwice('base-es2015-json');
  itCompilesTwice('base-es2015-json', {exportStats: true});
  itCompilesHardModules('base-es2015-json', ['./b.json']);

});
