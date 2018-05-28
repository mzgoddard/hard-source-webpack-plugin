var expect = require('chai').expect;

var util = require('mocha-hard-source');
var itCompiles = util.itCompiles;
var itCompilesTwice = util.itCompilesTwice;
var itCompilesChange = util.itCompilesChange;
var itCompilesHardModules = util.itCompilesHardModules;
var clean = util.clean;
var compile = util.compile;
var writeFiles = util.writeFiles;

describe('loader webpack use', function() {
  itCompilesTwice('loader-file');
  itCompilesTwice('loader-file-context');
  itCompilesTwice('loader-file-options');
  itCompilesTwice('loader-file-use');

  itCompilesHardModules('loader-file', ['./image.png']);
  // itCompilesHardModules('loader-file-context', ['./image.png']);
  itCompilesHardModules('loader-file-use', [
    './src/index.js',
    './src/image.png',
  ]);
});

describe('loader webpack use - builds changes', function() {
  itCompiles(
    'loader-file-move',
    'loader-file-move',
    function() {
      return writeFiles('loader-file-move', {
        'index.js': "require('./image.png');\n",
      }).then(function() {
        return {
          exportCompilation: true,
        };
      });
    },
    function(run1) {
      return new Promise(function(resolve) {
        setTimeout(resolve, 1000);
      })
        .then(function() {
          return writeFiles('loader-file-move', {
            'index.js': "// require('./image.png');\n",
          });
        })
        .then(function() {
          return {
            compiler: run1.compiler,
            exportCompilation: true,
          };
        });
    },
    function(run2) {
      return new Promise(function(resolve) {
        setTimeout(resolve, 1000);
      })
        .then(function() {
          return writeFiles('loader-file-move', {
            'index.js': "require('./image.png');\n",
          });
        })
        .then(function() {
          return {
            compiler: run2.compiler,
            exportCompilation: true,
          };
        });
    },
    function(output) {
      expect(output.runs[0].compiler).to.equal(output.runs[1].compiler);
      expect(output.runs[0].compiler).to.equal(output.runs[2].compiler);
      expect(output.runs[0].out).to.not.eql(output.runs[1].out);
      expect(output.runs[0].out).to.eql(output.runs[2].out);
    },
  );
});

describe('loader webpack use - watch mode', function() {
  it('loader-file-use: compiles in watch mode', function(done) {
    compile('loader-file-use', { watch: 'startStop' })
      .then(function(result) {
        return compile('loader-file-use', { watch: 'startStop' });
      })
      .then(function(result) {
        done();
      })
      .catch(done);
  });
});
