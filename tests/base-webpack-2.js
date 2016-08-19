var expect = require('chai').expect;

var itCompilesTwice = require('./util').itCompilesTwice;
var describeWP2 = require('./util').describeWP2;

describeWP2('basic webpack 2 use', function() {

  itCompilesTwice('base-es2015-module');

});
