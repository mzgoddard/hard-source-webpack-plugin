var expect = require('chai').expect;

var describeWP = require('mocha-hard-source').describeWP;
var itCompilesTwice = require('mocha-hard-source').itCompilesTwice;
var itCompilesHardModules = require('mocha-hard-source').itCompilesHardModules;
var itCompilesChange = require('mocha-hard-source').itCompilesChange;
var writeFiles = require('mocha-hard-source').writeFiles;
var compile = require('mocha-hard-source').compile;
var clean = require('mocha-hard-source').clean;

var c = require('mocha-hard-source/features');

describeWP(4)('plugin webpack 4 use', function() {
  itCompilesTwice.skipIf([c.miniCss])('plugin-mini-css-extract');
  itCompilesTwice.skipIf([
    c.miniCss,
  ])('plugin-mini-css-extract', { exportStats: true });
  itCompilesHardModules.skipIf([
    c.miniCss,
  ])('plugin-mini-css-extract', ['./index.css']);
});

describeWP(4)('plugin webpack 4 use - builds change', function() {
  itCompilesChange(
    'plugin-mini-css-extract-change',
    {
      'index.css': ['.hello {', '  color: blue;', '}'].join('\n'),
    },
    {
      'index.css': ['.hello {', '  color: red;', '}'].join('\n'),
    },
    function(output) {
      expect(output.run1['main.css'].toString()).to.match(/blue/);
      expect(output.run2['main.css'].toString()).to.match(/red/);
    },
  );
});

describeWP(4)('plugin webpack 4 use - watch mode', function() {
  it('plugin-mini-css-extract-watch: #339', function() {
    this.timeout(60000);

    return clean('plugin-mini-css-extract-watch')
      .then(function() {
        return writeFiles('plugin-mini-css-extract-watch', {
          'index.css': ['.hello {', '  color: blue;', '}'].join('\n'),
        });
      })
      .then(function() {
        return compile('plugin-mini-css-extract-watch', {
          watch: 'start',
        });
      })
      .then(function(result) {
        return writeFiles('plugin-mini-css-extract-watch', {
          'index.css': ['.hello {', '  color: red;', '}'].join('\n'),
        })
          .then(function() {
            return compile('plugin-mini-css-extract-watch', {
              watching: result.watching,
              watch: 'continue',
            });
          })
          .then(function(result) {
            return compile('plugin-mini-css-extract-watch', {
              watching: result.watching,
              watch: 'stop',
            });
          })
          .then(function() {
            return result;
          });
      })
      .then(function(result) {
        return compile('plugin-mini-css-extract-watch').then(function(result2) {
          return {
            result,
            result2,
          };
        });
      })
      .then(function(results) {
        expect(results.result2['main.css'].toString()).to.not.equal(
          results.result.out['main.css'].toString(),
        );
      });
  });
});
