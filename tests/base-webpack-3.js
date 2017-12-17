var expect = require('chai').expect;

var itCompilesTwice = require('./util').itCompilesTwice;
var itCompilesChange = require('./util').itCompilesChange;
var itCompilesHardModules = require('./util').itCompilesHardModules;
var describeWP2 = require('./util').describeWP2;

describeWP2('basic webpack 3 use - compiles identically', function() {

  itCompilesTwice('base-es2015-module-export-star');
  itCompilesTwice('base-es2015-module-export-star', {exportStats: true});
  itCompilesTwice('base-es2015-module-export-star-alt');
  itCompilesTwice('base-es2015-module-export-star-alt', {exportStats: true});
  itCompilesTwice('base-devtool-nosources-source-map');
  itCompilesTwice('base-devtool-nosources-source-map', {exportStats: true});

  itCompilesHardModules('base-es2015-module-export-star', ['./export.js', './fab.js', './fib.js', './index.js']);
  itCompilesHardModules('base-es2015-module-export-star-alt', ['./export.js', './fab.js', './fib.js', './index.js']);

});

describeWP2('basic webpack 2 use - builds changes', function() {

  itCompilesChange('base-es2015-module-export-star-some', {
    'index.js': [
      'import {fib} from \'./export\';',
      'console.log(fib(3));',
    ].join('\n'),
  }, {
    'index.js': [
      'import {fab} from \'./export\';',
      'console.log(fab(4));',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.contain('"a" /* fib */');
    // expect(output.run1['main.js'].toString()).to.contain('__webpack_exports__["a"]');
    expect(output.run2['main.js'].toString()).to.contain('"a" /* fab */');
    // expect(output.run2['main.js'].toString()).to.contain('__webpack_require__.d(__webpack_exports__, "a"');
    // expect(output.run2['main.js'].toString()).to.contain('__webpack_exports__["a"]');
  });

});
