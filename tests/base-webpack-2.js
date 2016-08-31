var expect = require('chai').expect;

var itCompilesTwice = require('./util').itCompilesTwice;
var itCompilesChange = require('./util').itCompilesChange;
var describeWP2 = require('./util').describeWP2;

describeWP2('basic webpack 2 use - compiles identically', function() {

  itCompilesTwice('base-es2015-module');

});

describeWP2('basic webpack 2 use - builds changes', function() {

  itCompilesChange('base-change-es2015-module', {
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
    expect(output.run1['main.js'].toString()).to.contain('"a" /* key */');
    expect(output.run1['main.js'].toString()).to.not.contain('exports["a"]');
    expect(output.run2['main.js'].toString()).to.contain('"a" /* fib */');
    expect(output.run2['main.js'].toString()).to.contain('__webpack_require__.d(exports, "a"');
    expect(output.run2['main.js'].toString()).to.contain('exports["a"]');
  });

  itCompilesChange('base-change-es2015-commonjs-module', {
    'index.js': [
      'import {key} from \'./obj\';',
      'console.log(key);',
    ].join('\n'),
  }, {
    'index.js': [
      'var fib = require(\'./obj\').fib;',
      'console.log(fib(3));',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.contain('"a" /* key */');
    expect(output.run1['main.js'].toString()).to.not.contain('exports["a"]');
    expect(output.run2['main.js'].toString()).to.contain('__webpack_require__(0).fib');
    expect(output.run2['main.js'].toString()).to.contain('__webpack_require__.d(exports, "fib"');
    expect(output.run2['main.js'].toString()).to.contain('exports["a"]');
  });

  itCompilesChange('base-change-es2015-export-module', {
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
    expect(output.run1['main.js'].toString()).to.contain('"a" /* key */');
    expect(output.run1['main.js'].toString()).to.not.contain('exports["a"]');
    expect(output.run2['main.js'].toString()).to.contain('"a" /* fib */');
    expect(output.run2['main.js'].toString()).to.contain('exports["a"]');
  });

  itCompilesChange('base-change-es2015-all-module', {
    'index.js': [
      'import {key} from \'./obj\';',
      'console.log(key);',
    ].join('\n'),
  }, {
    'index.js': [
      'import * as obj from \'./obj\';',
      'console.log(obj.fib(3));',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.contain('"a" /* key */');
    expect(output.run1['main.js'].toString()).to.not.contain('exports["a"]');
    expect(output.run2['main.js'].toString()).to.contain('"a" /* fib */');
    expect(output.run2['main.js'].toString()).to.contain('exports["a"]');
  });

  itCompilesChange('base-change-es2015-default-module', {
    'index.js': [
      'import {key} from \'./obj\';',
      'console.log(key);',
    ].join('\n'),
  }, {
    'index.js': [
      'import obj, {fib} from \'./obj\';',
      'console.log(obj.fib(3), fib(2));',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.contain('"a" /* key */');
    expect(output.run1['main.js'].toString()).to.contain('exports["a"]');
    expect(output.run2['main.js'].toString()).to.contain('"b" /* fib */');
    expect(output.run2['main.js'].toString()).to.contain('exports["a"]');
  });

  itCompilesChange('base-change-es2015-rename-module', {
    'index.js': [
      'import {rekey as key} from \'./obj\';',
      'console.log(key);',
    ].join('\n'),
  }, {
    'index.js': [
      'import {refib as fib} from \'./obj\';',
      'console.log(fib(3));',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.contain('"a" /* rekey */');
    expect(output.run1['main.js'].toString()).to.not.contain('exports["a"]');
    expect(output.run2['main.js'].toString()).to.contain('"a" /* refib */');
    expect(output.run2['main.js'].toString()).to.contain('exports["a"]');
  });

  itCompilesChange('base-change-es2015-module', {
    'index.js': [
      'import {fib} from \'./obj\';',
      'console.log(fib(3));',
    ].join('\n'),
  }, {
    'index.js': [
      'import {key} from \'./obj\';',
      'console.log(key);',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.contain('"a" /* fib */');
    expect(output.run1['main.js'].toString()).to.contain('exports["a"]');
    expect(output.run2['main.js'].toString()).to.contain('"a" /* key */');
    expect(output.run2['main.js'].toString()).to.not.contain('exports["a"]');
  });

  itCompilesChange('base-change-es2015-export-module', {
    'index.js': [
      'import {fib} from \'./obj\';',
      'console.log(fib(3));',
    ].join('\n'),
  }, {
    'index.js': [
      'import {key} from \'./obj\';',
      'console.log(key);',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.contain('"a" /* fib */');
    expect(output.run1['main.js'].toString()).to.contain('exports["a"]');
    expect(output.run2['main.js'].toString()).to.contain('"a" /* key */');
    expect(output.run2['main.js'].toString()).to.not.contain('exports["a"]');
  });

  itCompilesChange('base-change-es2015-all-module', {
    'index.js': [
      'import * as obj from \'./obj\';',
      'console.log(obj.fib(3));',
    ].join('\n'),
  }, {
    'index.js': [
      'import {key} from \'./obj\';',
      'console.log(key);',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.contain('"a" /* fib */');
    expect(output.run1['main.js'].toString()).to.contain('exports["a"]');
    expect(output.run2['main.js'].toString()).to.contain('"a" /* key */');
    expect(output.run2['main.js'].toString()).to.not.contain('exports["a"]');
  });

  itCompilesChange('base-change-es2015-default-module', {
    'index.js': [
      'import obj, {fib} from \'./obj\';',
      'console.log(obj.fib(3), fib(2));',
    ].join('\n'),
  }, {
    'index.js': [
      'import {key} from \'./obj\';',
      'console.log(key);',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.contain('"b" /* fib */');
    expect(output.run1['main.js'].toString()).to.contain('exports["a"]');
    expect(output.run2['main.js'].toString()).to.contain('"a" /* key */');
    expect(output.run2['main.js'].toString()).to.contain('exports["a"]');
  });

  itCompilesChange('base-change-es2015-rename-module', {
    'index.js': [
      'import {refib as fib} from \'./obj\';',
      'console.log(fib(3));',
    ].join('\n'),
  }, {
    'index.js': [
      'import {rekey as key} from \'./obj\';',
      'console.log(key);',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.contain('"a" /* refib */');
    expect(output.run1['main.js'].toString()).to.contain('exports["a"]');
    expect(output.run2['main.js'].toString()).to.contain('"a" /* rekey */');
    expect(output.run2['main.js'].toString()).to.not.contain('exports["a"]');
  });

});
