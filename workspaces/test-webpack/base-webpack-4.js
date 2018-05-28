var expect = require('chai').expect;

var itCompilesTwice = require('mocha-hard-source').itCompilesTwice;
var itCompilesChange = require('mocha-hard-source').itCompilesChange;
var itCompilesHardModules = require('mocha-hard-source').itCompilesHardModules;
var describeWP = require('mocha-hard-source').describeWP;

describeWP(4)('basic webpack 4 use - compiles identically', function() {

  itCompilesTwice('base-es2015-json');
  itCompilesTwice('base-es2015-json', {exportStats: true});
  itCompilesTwice('base-wasm');
  itCompilesTwice('base-wasm', {exportStats: true});
  itCompilesTwice('base-es2015-dynamic-import');
  itCompilesTwice('base-es2015-dynamic-import', {exportStats: true});
  
  itCompilesHardModules('base-es2015-json', ['./b.json']);
  itCompilesHardModules('base-wasm', ['./wasm.wasm']);

});
