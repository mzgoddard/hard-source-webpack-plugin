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
    expect(output.run1['main.js'].toString()).to.contain('e.a');
    expect(output.run1['main.js'].toString()).to.not.contain('t.a');
    expect(output.run2['main.js'].toString()).to.contain('r.i(e.a)');
    expect(output.run2['main.js'].toString()).to.contain('t.a');
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
    expect(output.run2['main.js'].toString()).to.match(/exports\["a"\]/);
    expect(output.run2['main.js'].toString()).to.match(/\/* fib/);
    expect(Object.keys(output.run2).filter(function(key) {
      return /\.hot-update\.json/.test(key);
    })).to.length.of(2);
  });

});
