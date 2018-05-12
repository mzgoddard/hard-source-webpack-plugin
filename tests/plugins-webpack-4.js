var expect = require('chai').expect;

var describeWP = require('./util').describeWP;
var itCompilesTwice = require('./util').itCompilesTwice;
var itCompilesHardModules = require('./util').itCompilesHardModules;

var c = require('./util/features');

describeWP(4)('plugin webpack 4 use', function() {

  itCompilesTwice.skipIf([c.miniCss])('plugin-mini-css-extract');
  itCompilesTwice.skipIf([c.miniCss])('plugin-mini-css-extract', {exportStats: true});
  itCompilesHardModules.skipIf([c.miniCss])('plugin-mini-css-extract', ['./index.css']);

});
