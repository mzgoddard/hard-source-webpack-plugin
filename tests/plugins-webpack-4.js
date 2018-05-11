var expect = require('chai').expect;

var describeWP = require('./util').describeWP;
var itCompilesTwice = require('./util').itCompilesTwice;
var itCompilesHardModules = require('./util').itCompilesHardModules;

describeWP(4)('plugin webpack 4 use', function() {

  itCompilesTwice('plugin-mini-css-extract');
  itCompilesTwice('plugin-mini-css-extract', {exportStats: true});
  itCompilesHardModules('plugin-mini-css-extract', ['./index.css']);

});
