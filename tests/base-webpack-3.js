var expect = require('chai').expect;

var itCompilesTwice = require('./util').itCompilesTwice;
var itCompilesChange = require('./util').itCompilesChange;
var itCompilesHardModules = require('./util').itCompilesHardModules;
var describeWP = require('./util').describeWP;

describeWP(3)('basic webpack 3 use - compiles identically', function() {

  itCompilesTwice('base-1dep-query');
  itCompilesTwice('base-1dep-query', {exportStats: true});
  itCompilesTwice('base-devtool-nosources-source-map');
  itCompilesTwice('base-devtool-nosources-source-map', {exportStats: true});
  itCompilesTwice('base-es2015-module-export-star');
  itCompilesTwice('base-es2015-module-export-star', {exportStats: true});
  itCompilesTwice('base-es2015-module-export-star-alt');
  itCompilesTwice('base-es2015-module-export-star-alt', {exportStats: true});

  itCompilesHardModules('base-es2015-module-export-star', ['./export.js', './fab.js', './fib.js', './index.js']);
  itCompilesHardModules('base-es2015-module-export-star-alt', ['./export.js', './fab.js', './fib.js', './index.js']);

});

describeWP(3)('basic webpack 3 use - builds changes', function() {

  itCompilesChange('base-es2015-module-export-star-some', {
    'index.js': [
      'import {fib} from \'./export\';',
      'export default fib(3);',
    ].join('\n'),
  }, {
    'index.js': [
      'import {fab} from \'./export\';',
      'export default fab(4);',
    ].join('\n'),
  }, function(output) {
    expect(eval(output.run1['main.js'].toString())).to.eql({default: 5});
    expect(eval(output.run2['main.js'].toString())).to.eql({default: 6});
    // expect(output.run1['main.js'].toString()).to.contain('__webpack_exports__["a"]');
    // expect(output.run2['main.js'].toString()).to.contain('"a" /* fab */');
    // expect(output.run2['main.js'].toString()).to.contain('__webpack_require__.d(__webpack_exports__, "a"');
    // expect(output.run2['main.js'].toString()).to.contain('__webpack_exports__["a"]');
  });

});
