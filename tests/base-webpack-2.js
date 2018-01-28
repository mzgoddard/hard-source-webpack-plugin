var expect = require('chai').expect;

var itCompiles = require('./util').itCompiles;
var itCompilesTwice = require('./util').itCompilesTwice;
var itCompilesChange = require('./util').itCompilesChange;
var itCompilesHardModules = require('./util').itCompilesHardModules;
var describeWP2 = require('./util').describeWP2;

describeWP2('basic webpack 2 use - compiles identically', function() {

  itCompilesTwice('base-es2015-module');
  itCompilesTwice('base-es2015-module', {exportStats: true});
  itCompilesTwice('base-es2015-module-compatibility');
  itCompilesTwice('base-es2015-module-compatibility', {exportStats: true});
  itCompilesTwice('base-es2015-module-export-before-import');
  itCompilesTwice('base-es2015-module-export-before-import', {exportStats: true});
  itCompilesTwice('base-es2015-module-use-before-import');
  itCompilesTwice('base-es2015-module-use-before-import', {exportStats: true});
  itCompilesTwice('base-es2015-rename-module');
  itCompilesTwice('base-es2015-rename-module', {exportStats: true});
  itCompilesTwice('base-es2015-system-context');
  itCompilesTwice('base-es2015-system-context', {exportStats: true});
  itCompilesTwice('base-es2015-system-module');
  itCompilesTwice('base-es2015-system-module', {exportStats: true});
  itCompilesTwice('base-warning-context');
  itCompilesTwice('base-warning-context', {exportStats: true});
  itCompilesTwice('base-warning-es2015');
  itCompilesTwice('base-warning-es2015', {exportStats: true});

  itCompilesHardModules('base-es2015-module', ['./index.js', './obj.js', './fib.js']);
  itCompilesHardModules('base-es2015-module-compatibility', ['./index.js', './obj.js', './fib.js']);
  itCompilesHardModules('base-es2015-module-export-before-import', ['./index.js', './obj.js', './fib.js']);
  itCompilesHardModules('base-es2015-module-use-before-import', ['./index.js', './obj.js', './fib.js']);

  itCompiles(
    'it includes compatibility dependency in base-es2015-module-compatibility', 
    'base-es2015-module-compatibility',
    function(output) {
      expect(output.run2['main.js'].toString()).to.contain('__esModule');
    }
  );

});

describeWP2('basic webpack 2 use - builds changes', function() {

  itCompilesChange('base-change-es2015-module', {
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
    // expect(output.run1['main.js'].toString()).to.contain('"a" /* key */');
    // expect(output.run1['main.js'].toString()).to.not.contain('__webpack_exports__["a"]');
    // expect(output.run2['main.js'].toString()).to.contain('"a" /* fib */');
    // expect(output.run2['main.js'].toString()).to.contain('__webpack_require__.d(__webpack_exports__, "a"');
    // expect(output.run2['main.js'].toString()).to.contain('__webpack_exports__["a"]');
  });

  itCompilesChange('base-change-es2015-commonjs-module', {
    'index.js': [
      'import {key} from \'./obj\';',
      'export default key;',
    ].join('\n'),
  }, {
    'index.js': [
      'var fib = require(\'./obj\').fib;',
      'module.exports = fib(3);',
    ].join('\n'),
  }, function(output) {
    const result1 = eval(output.run1['main.js'].toString()).default;
    expect(result1).to.eql('obj');
    const result2 = eval(output.run2['main.js'].toString());
    expect(result2).to.eql(5);
    // expect(output.run1['main.js'].toString()).to.contain('"a" /* key */');
    // expect(output.run1['main.js'].toString()).to.not.contain('__webpack_exports__["a"]');
    // expect(output.run2['main.js'].toString()).to.match(/__webpack_require__\(\d\)\.fib/);
    // expect(output.run2['main.js'].toString()).to.contain('__webpack_require__.d(__webpack_exports__, "fib"');
    // expect(output.run2['main.js'].toString()).to.contain('__webpack_exports__["a"]');
  });

  itCompilesChange('base-change-es2015-export-module', {
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
    const result1 = eval(output.run1['main.js'].toString()).default;
    expect(result1).to.eql('obj');
    const result2 = eval(output.run2['main.js'].toString()).default;
    expect(result2).to.eql(5);
    // expect(output.run1['main.js'].toString()).to.contain('"a" /* key */');
    // expect(output.run1['main.js'].toString()).to.not.contain('__webpack_exports__["a"]');
    // expect(output.run2['main.js'].toString()).to.contain('"a" /* fib */');
    // expect(output.run2['main.js'].toString()).to.contain('__webpack_exports__["a"]');
  });

  itCompilesChange('base-change-es2015-export-order-module', {
    'other.js': [
      'import {fib, key} from \'./obj\';',
      'export default [fib, key];',
    ].join('\n'),
  }, {
    'other.js': [
      'import {fib, key} from \'./obj\';',
      'export default [key, fib];',
    ].join('\n'),
  }, function(output) {
    const result1 = eval(output.run1['main.js'].toString()).default;
    expect(result1[0][0](3)).to.eql(5);
    expect(result1[0][1]).to.eql('obj');
    expect(result1[1][0](3)).to.eql(5);
    expect(result1[1][1]).to.eql(undefined);
    const result2 = eval(output.run2['main.js'].toString()).default;
    expect(result2[0][0](3)).to.eql(5);
    expect(result2[0][1]).to.eql('obj');
    expect(result2[1][0]).to.eql(undefined);
    expect(result2[1][1](3)).to.eql(5);
    // var run1FibId = /__webpack_exports__\["(\w)"\] = fib/.exec(output.run1['main.js'].toString())[1];
    // var run1KeyId = run1FibId === 'a' ? 'b' : 'a';
    // expect(output.run1['main.js'].toString()).to.contain('console.log(__WEBPACK_IMPORTED_MODULE_0__obj__["' + run1FibId + '" /* fib */], __WEBPACK_IMPORTED_MODULE_0__obj__["' + run1KeyId + '" /* key */]);');
    // var run2FibId = /__webpack_exports__\["(\w)"\] = fib/.exec(output.run2['main.js'].toString())[1];
    // var run2KeyId = run2FibId === 'a' ? 'b' : 'a';
    // expect(output.run2['main.js'].toString()).to.contain('console.log(__WEBPACK_IMPORTED_MODULE_0__obj__["' + run2FibId + '" /* fib */], __WEBPACK_IMPORTED_MODULE_0__obj__["' + run2KeyId + '" /* key */]);');
  });

  itCompilesChange('base-change-es2015-export-order-module', {
    'other.js': [
      'import {fib, key} from \'./obj\';',
      'export default [fib, key];',
    ].join('\n'),
    'obj.js': [
      'import \'./other\';',
      'export function fib(n) {',
      '  return n + (n > 0 ? n - 1 : 0);',
      '}',
      'export var key = \'obj\';',
    ].join('\n'),
  }, {
    'other.js': [
      'import {fib, key} from \'./obj\';',
      'export default [key, fib];',
    ].join('\n'),
    'obj.js': [
      'import \'./other\';',
      'export var key = \'obj\';',
      'export function fib(n) {',
      '  return n + (n > 0 ? n - 1 : 0);',
      '}',
    ].join('\n'),
  }, function(output) {
    const result1 = eval(output.run1['main.js'].toString()).default;
    expect(result1[0][0](3)).to.eql(5);
    expect(result1[0][1]).to.eql('obj');
    expect(result1[1][0](3)).to.eql(5);
    expect(result1[1][1]).to.eql(undefined);
    const result2 = eval(output.run2['main.js'].toString()).default;
    expect(result2[0][0](3)).to.eql(5);
    expect(result2[0][1]).to.eql('obj');
    expect(result2[1][0]).to.eql(undefined);
    expect(result2[1][1](3)).to.eql(5);
    // var run1FibId = /__webpack_exports__\["(\w)"\] = fib/.exec(output.run1['main.js'].toString())[1];
    // var run1KeyId = run1FibId === 'a' ? 'b' : 'a';
    // expect(output.run1['main.js'].toString()).to.contain('console.log(__WEBPACK_IMPORTED_MODULE_0__obj__["' + run1FibId + '" /* fib */], __WEBPACK_IMPORTED_MODULE_0__obj__["' + run1KeyId + '" /* key */]);');
    // var run2FibId = /__webpack_exports__\["(\w)"\] = fib/.exec(output.run2['main.js'].toString())[1];
    // var run2KeyId = run2FibId === 'a' ? 'b' : 'a';
    // expect(output.run2['main.js'].toString()).to.contain('console.log(__WEBPACK_IMPORTED_MODULE_0__obj__["' + run2FibId + '" /* fib */], __WEBPACK_IMPORTED_MODULE_0__obj__["' + run2KeyId + '" /* key */]);');
  });

  itCompilesChange('base-change-es2015-all-module', {
    'index.js': [
      'import {key} from \'./obj\';',
      'export default key;',
    ].join('\n'),
  }, {
    'index.js': [
      'import * as obj from \'./obj\';',
      'export default obj.fib(3);',
    ].join('\n'),
  }, function(output) {
    expect(eval(output.run1['main.js'].toString())).to.eql({default: 'obj'});
    expect(eval(output.run2['main.js'].toString())).to.eql({default: 5});
    // expect(output.run1['main.js'].toString()).to.contain('"a" /* key */');
    // expect(output.run1['main.js'].toString()).to.not.contain('__webpack_exports__["a"]');
    // expect(output.run2['main.js'].toString()).to.contain('"a" /* fib */');
    // expect(output.run2['main.js'].toString()).to.contain('__webpack_exports__["a"]');
  });

  itCompilesChange('base-change-es2015-default-module', {
    'index.js': [
      'import {key} from \'./obj\';',
      'export default key;',
    ].join('\n'),
  }, {
    'index.js': [
      'import obj, {fib} from \'./obj\';',
      'export default [obj.fib(3), fib(2)];',
    ].join('\n'),
  }, function(output) {
    expect(eval(output.run1['main.js'].toString())).to.eql({default: 'obj'});
    expect(eval(output.run2['main.js'].toString())).to.eql({default: [5, 3]});
    // expect(output.run1['main.js'].toString()).to.contain('"a" /* key */');
    // expect(output.run1['main.js'].toString()).to.contain('__webpack_exports__["a"]');
    // expect(output.run2['main.js'].toString()).to.contain('"b" /* fib */');
    // expect(output.run2['main.js'].toString()).to.contain('__webpack_exports__["a"]');
  });

  itCompilesChange('base-change-es2015-rename-module', {
    'index.js': [
      'import {rekey as key} from \'./obj\';',
      'export default key;',
    ].join('\n'),
  }, {
    'index.js': [
      'import {refib as fib} from \'./obj\';',
      'export default fib(3);',
    ].join('\n'),
  }, function(output) {
    expect(eval(output.run1['main.js'].toString())).to.eql({default: 'obj'});
    expect(eval(output.run2['main.js'].toString())).to.eql({default: 5});
    // expect(output.run1['main.js'].toString()).to.contain('"a" /* rekey */');
    // expect(output.run1['main.js'].toString()).to.not.contain('__webpack_exports__["a"]');
    // expect(output.run2['main.js'].toString()).to.contain('"a" /* refib */');
    // expect(output.run2['main.js'].toString()).to.contain('__webpack_exports__["a"]');
  });

  itCompilesChange('base-change-es2015-module', {
    'index.js': [
      'import {fib} from \'./obj\';',
      'export default fib(3);',
    ].join('\n'),
  }, {
    'index.js': [
      'import {key} from \'./obj\';',
      'export default key;',
    ].join('\n'),
  }, function(output) {
    expect(eval(output.run1['main.js'].toString())).to.eql({default: 5});
    expect(eval(output.run2['main.js'].toString())).to.eql({default: 'obj'});
    // expect(output.run1['main.js'].toString()).to.contain('"a" /* fib */');
    // expect(output.run1['main.js'].toString()).to.contain('__webpack_exports__["a"]');
    // expect(output.run2['main.js'].toString()).to.contain('"a" /* key */');
    // expect(output.run2['main.js'].toString()).to.not.contain('__webpack_exports__["a"]');
  });

  itCompilesChange('base-change-es2015-export-module', {
    'index.js': [
      'import {fib} from \'./obj\';',
      'export default fib(3);',
    ].join('\n'),
  }, {
    'index.js': [
      'import {key} from \'./obj\';',
      'export default key;',
    ].join('\n'),
  }, function(output) {
    expect(eval(output.run1['main.js'].toString())).to.eql({default: 5});
    expect(eval(output.run2['main.js'].toString())).to.eql({default: 'obj'});
    // expect(output.run1['main.js'].toString()).to.contain('"a" /* fib */');
    // expect(output.run1['main.js'].toString()).to.contain('__webpack_exports__["a"]');
    // expect(output.run2['main.js'].toString()).to.contain('"a" /* key */');
    // expect(output.run2['main.js'].toString()).to.not.contain('__webpack_exports__["a"]');
  });

  itCompilesChange('base-change-es2015-all-module', {
    'index.js': [
      'import * as obj from \'./obj\';',
      'export default obj.fib(3);',
    ].join('\n'),
  }, {
    'index.js': [
      'import {key} from \'./obj\';',
      'export default key;',
    ].join('\n'),
  }, function(output) {
    expect(eval(output.run1['main.js'].toString())).to.eql({default: 5});
    expect(eval(output.run2['main.js'].toString())).to.eql({default: 'obj'});
    // expect(output.run1['main.js'].toString()).to.contain('"a" /* fib */');
    // expect(output.run1['main.js'].toString()).to.contain('__webpack_exports__["a"]');
    // expect(output.run2['main.js'].toString()).to.contain('"a" /* key */');
    // expect(output.run2['main.js'].toString()).to.not.contain('__webpack_exports__["a"]');
  });

  itCompilesChange('base-change-es2015-default-module', {
    'index.js': [
      'import obj, {fib} from \'./obj\';',
      'export default [obj.fib(3), fib(2)];',
    ].join('\n'),
  }, {
    'index.js': [
      'import {key} from \'./obj\';',
      'export default key;',
    ].join('\n'),
  }, function(output) {
    expect(eval(output.run1['main.js'].toString())).to.eql({default: [5, 3]});
    expect(eval(output.run2['main.js'].toString())).to.eql({default: 'obj'});
    // expect(output.run1['main.js'].toString()).to.contain('"b" /* fib */');
    // expect(output.run1['main.js'].toString()).to.contain('__webpack_exports__["a"]');
    // expect(output.run2['main.js'].toString()).to.contain('"a" /* key */');
    // expect(output.run2['main.js'].toString()).to.contain('__webpack_exports__["a"]');
  });

  itCompilesChange('base-change-es2015-rename-module', {
    'index.js': [
      'import {refib as fib} from \'./obj\';',
      'export default fib(3);',
    ].join('\n'),
  }, {
    'index.js': [
      'import {rekey as key} from \'./obj\';',
      'export default key;',
    ].join('\n'),
  }, function(output) {
    expect(eval(output.run1['main.js'].toString())).to.eql({default: 5});
    expect(eval(output.run2['main.js'].toString())).to.eql({default: 'obj'});
    // expect(output.run1['main.js'].toString()).to.contain('"a" /* refib */');
    // expect(output.run1['main.js'].toString()).to.contain('__webpack_exports__["a"]');
    // expect(output.run2['main.js'].toString()).to.contain('"a" /* rekey */');
    // expect(output.run2['main.js'].toString()).to.not.contain('__webpack_exports__["a"]');
  });

});
