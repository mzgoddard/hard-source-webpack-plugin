var expect = require('chai').expect;

var itCompilesTwice = require('./util').itCompilesTwice;
var describeWP2 = require('./util').describeWP2;

describeWP2('basic webpack 3 use - compiles identically', function() {

  itCompilesTwice('base-es2015-module-export-star');

});
