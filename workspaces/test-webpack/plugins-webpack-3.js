var expect = require('chai').expect;

var clean = require('mocha-hard-source').clean;
var compile = require('mocha-hard-source').compile;
var describeWP = require('mocha-hard-source').describeWP;
var itCompiles = require('mocha-hard-source').itCompiles;
var itCompilesTwice = require('mocha-hard-source').itCompilesTwice;
var itCompilesChange = require('mocha-hard-source').itCompilesChange;
var itCompilesHardModules = require('mocha-hard-source').itCompilesHardModules;

describeWP(3)('plugin webpack 3 use', function() {

  itCompilesTwice('plugin-concatenated-module');
  itCompilesHardModules('plugin-concatenated-module', function(out) {
    out.run2.compilation.modules.forEach(function(module) {
      if (module.modules) {
        expect(module.modules.length).to.equal(4);
        module.modules.forEach(function(usedModule) {
          expect(usedModule.cacheItem).to.be.ok;
        });
      }
    });
  });

});

describeWP(3)('plugin webpack 3 use - builds change', function() {

  itCompilesChange('plugin-concatenated-module-change', {
    'index.js': [
      'var fib = require(\'./obj\').fib;',
      'module.exports = fib(3);',
    ].join('\n'),
    'obj.js': [
      'import fib from \'./fib\';',
      'let key = \'obj\';',
      'export {key, fib};',
    ].join('\n'),
  }, {
    'index.js': [
      'var key = require(\'./obj\').key;',
      'module.exports = key;',
    ].join('\n'),
    'obj.js': [
      'let key = \'obj\';',
      'export {key};',
    ].join('\n'),
  }, function(output) {
    expect(eval(output.run1['main.js'].toString())).to.eql(5);
    expect(eval(output.run2['main.js'].toString())).to.eql('obj');
    // var main1 = output.run1['main.js'].toString();
    // var main2 = output.run2['main.js'].toString();
    // expect(main1).to.contain('fib');
    // expect(main2).to.not.contain('fib');
  });

});
