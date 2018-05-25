var expect = require('chai').expect;

var describeWP = require('./util').describeWP;
var itCompilesTwice = require('./util').itCompilesTwice;
var itCompilesHardModules = require('./util').itCompilesHardModules;
var itCompilesChange = require('./util').itCompilesChange;

var c = require('./util/features');

describeWP(4)('plugin webpack 4 use', function() {

  itCompilesTwice.skipIf([c.miniCss])('plugin-mini-css-extract');
  itCompilesTwice.skipIf([c.miniCss])('plugin-mini-css-extract', {exportStats: true});
  itCompilesHardModules.skipIf([c.miniCss])('plugin-mini-css-extract', ['./index.css']);

});

describeWP(4)('plugin webpack 4 use - builds change', function() {

  itCompilesChange('plugin-mini-css-extract-change', {
    'index.css': [
      '.hello {',
      '  color: blue;',
      '}',
    ].join('\n'),
  }, {
    'index.css': [
      '.hello {',
      '  color: red;',
      '}',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.css'].toString()).to.match(/blue/);
    expect(output.run2['main.css'].toString()).to.match(/red/);
  });

});
