var expect = require('chai').expect;

var itCompilesTwice = require('mocha-hard-source').itCompilesTwice;
var itCompilesChange = require('mocha-hard-source').itCompilesChange;
var describeWP2 = require('mocha-hard-source').describeWP2;

var c = require('mocha-hard-source/features');

describeWP2('plugin webpack 2 use - builds changes', function() {

  itCompilesChange.skipIf([c.uglify])('plugin-uglify-1dep-es2015', {
    'index.js': [
      'import {key} from \'./obj\';',
      'export default key;',
    ].join('\n'),
  }, {
    'index.js': [
      'import {fib} from \'./obj\';',
      'export default fib(3);',
    ].join('\n'),
  }, function(output) {
    expect(eval(output.run1['main.js'].toString())).to.eql({default: 'obj'});
    expect(eval(output.run2['main.js'].toString())).to.eql({default: 5});
    // var main1 = output.run1['main.js'].toString();
    // var main2 = output.run2['main.js'].toString();
    // var run1Ids = /var (\w)=(\w)\(\d\)/.exec(main1);
    // var run2Ids = /var (\w)=(\w)\(\d\)/.exec(main2);
    // var run1Module = run1Ids[1];
    // var run1Require = run1Ids[2];
    // var run2Module = run2Ids[1];
    // var run2Require = run2Ids[2];
    // expect(main1).to.contain(run1Module + '.a');
    // expect(main1).to.not.match(new RegExp(
    //   // webpack 2.x
    //   run1Require + '\\.i\\(' + run1Module + '\\.a\\)\\(|' +
    //   // webpack <3.?
    //   run1Module + '\\.a\\(|' +
    //   // webpack 3.?
    //   'Object\\(' + run1Module + '\\.a\\)\\('
    // ));
    // expect(main1).to.not.match(/(\w\.a)=function/);
    // expect(main2).to.match(new RegExp(
    //   // webpack 2.x
    //   run2Require + '\\.i\\(' + run2Module + '\\.a\\)\\(|' +
    //   // webpack <3.?
    //   run2Module + '\\.a\\(|' +
    //   // webpack 3.?
    //   'Object\\(' + run2Module + '\\.a\\)\\('
    // ));
    // expect(main2).to.match(/(\w\.a)=function/);
  });

  itCompilesChange('plugin-hmr-es2015', {
    'index.js': [
      'import {key} from \'./fib\';',
      'export default key;',
    ].join('\n'),
  }, {
    'index.js': [
      'import {fib} from \'./fib\';',
      'export default fib(3);',
    ].join('\n'),
  }, function(output) {
    var window = {};
    expect(eval(output.run1['main.js'].toString())).to.eql({default: 'fib'});
    expect(eval(output.run2['main.js'].toString())).to.eql({default: 4});
    expect(Object.keys(output.run2).filter(function(key) {
      return /\.hot-update\.json/.test(key);
    })).to.length.of(1);
  });

});
