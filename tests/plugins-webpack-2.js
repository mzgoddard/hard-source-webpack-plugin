var expect = require('chai').expect;

var itCompilesChange = require('./util').itCompilesChange;
var describeWP2 = require('./util').describeWP2;

describeWP2('plugin webpack 2 use - builds changes', function() {

  itCompilesChange('plugin-uglify-1dep-es2015', {
    'index.js': [
      'import {key} from \'./obj\';',
      'console.log(key);',
    ].join('\n'),
  }, {
    'index.js': [
      'import {fib} from \'./obj\';',
      'console.log(fib(3));',
    ].join('\n'),
  }, function(output) {
    var main1 = output.run1['main.js'].toString();
    var main2 = output.run2['main.js'].toString();
    var run1Ids = /var (\w)=(\w)\(\d\)/.exec(main1);
    var run2Ids = /var (\w)=(\w)\(\d\)/.exec(main2);
    var run1Module = run1Ids[1];
    var run1Require = run1Ids[2];
    var run2Module = run2Ids[1];
    var run2Require = run2Ids[2];
    expect(main1).to.contain(run1Module + '.a');
    expect(main1).to.not.match(new RegExp(run1Require + '\\.i\\(' + run1Module + '\\.a\\)\\(|' + run1Module + '\\.a\\('));
    expect(main1).to.not.match(/(\w\.a)=function/);
    expect(main2).to.match(new RegExp(run2Require + '\\.i\\(' + run2Module + '\\.a\\)\\(|' + run2Module + '\\.a\\('));
    expect(main2).to.match(/(\w\.a)=function/);
  });

  itCompilesChange('plugin-hmr-es2015', {
    'index.js': [
      'import {key} from \'./fib\';',
      'console.log(key);',
    ].join('\n'),
  }, {
    'index.js': [
      'import {fib} from \'./fib\';',
      'console.log(fib(3));',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/return key/);
    expect(output.run1['main.js'].toString()).to.match(/\/* key/);
    expect(output.run2['main.js'].toString()).to.match(/__webpack_exports__\["a"\]/);
    expect(output.run2['main.js'].toString()).to.match(/\/* fib/);
    expect(Object.keys(output.run2).filter(function(key) {
      return /\.hot-update\.json/.test(key);
    })).to.length.of(2);
  });

});
