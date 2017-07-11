var expect = require('chai').expect;

var util = require('./util');
var itCompiles = util.itCompiles;
var itCompilesTwice = util.itCompilesTwice;
var itCompilesChange = util.itCompilesChange;
var itCompilesHardModules = util.itCompilesHardModules;
var clean = util.clean;
var compile = util.compile;
var writeFiles = util.writeFiles;

describe('loader webpack use', function() {

  itCompilesTwice('loader-css');
  itCompilesTwice('loader-file');
  itCompilesTwice('loader-file-use');
  itCompilesTwice('loader-custom-missing-dep');
  itCompilesTwice('loader-custom-no-dep');

  itCompilesHardModules('loader-css', ['./index.css']);
  itCompilesHardModules('loader-file', ['./image.png']);
  itCompilesHardModules('loader-file-use', ['./src/index.js', './src/image.png']);
  itCompilesHardModules('loader-custom-user-loader', ['./loader.js!./index.js']);
  itCompilesHardModules('loader-custom-no-dep', ['./index.js', './loader.js!./fib.js']);

});

describe('loader webpack warnings & errors', function() {

  var fixturePath = 'loader-warning';

  before(function() {
    return clean(fixturePath);
  });

  it('should cache errors & warnings from loader', function() {
    this.timeout(10000);
    return compile(fixturePath, {exportStats: true})
      .then(function(run1) {
        return Promise.all([run1, compile(fixturePath, {exportStats: true})])
      }).then(function(runs) {
        expect(runs[0].out).to.eql(runs[1].out);
        expect(runs[0].warnings.length).to.greaterThan(0);
        expect(runs[0].errors.length).to.greaterThan(0);
        expect(runs[1].warnings).to.eql(runs[0].warnings);
        expect(runs[1].errors).to.eql(runs[0].errors);
      });
  });

});

describe('loader webpack use - builds changes', function() {

  itCompilesChange('loader-custom-context-dep', {
    'dir/a': [
      '// a',
    ].join('\n'),
    'dir/b': null,
  }, {
    'dir/a': null,
    'dir/b': [
      '// b',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/\/\/ a/);
    expect(output.run2['main.js'].toString()).to.match(/\/\/ b/);
  });

  itCompilesChange('loader-custom-deep-context-dep', {
    'dir/dirdir': null,
    'dir/subdir/a': '// a',
    'dir/subdir/b': null,
  }, {
    'dir/dirdir/a': null,
    'dir/dirdir/b': '// b',
    'dir/subdir': null,
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/\/\/ subdir\/a/);
    expect(output.run2['main.js'].toString()).to.match(/\/\/ dirdir\/b/);
  });

  itCompilesChange('loader-custom-prepend-helper', {
    'loader-helper.js': [
      'function helper(a) {',
      '  console.log(a);',
      '}',
    ].join('\n'),
  }, {
    'loader-helper.js': [
      'function helper(b) {',
      '  console.log(b);',
      '}',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/console\.log\(a\)/);
    expect(output.run2['main.js'].toString()).to.match(/console\.log\(b\)/);
  });

  itCompilesChange('loader-custom-missing-dep-added', {
    'fib.js': null,
  }, {
    'fib.js': [
      'module.exports = function(n) {',
      '  return n + (n > 0 ? n - 1 : 0);',
      '};',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.not.match(/n - 1/);
    expect(output.run2['main.js'].toString()).to.match(/n - 1/);
  });

  itCompilesChange('loader-custom-missing-dep-added', {
    'fib.js': [
      'module.exports = function(n) {',
      '  return n + (n > 0 ? n - 1 : 0);',
      '};',
    ].join('\n'),
  }, {
    'fib.js': null,
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/n - 1/);
    expect(output.run2['main.js'].toString()).to.not.match(/n - 1/);
  });

  itCompilesChange('loader-custom-no-dep-moved', {
    'fib.js': '',
    'fib/index.js': null,
  }, {
    'fib.js': null,
    'fib/index.js': '',
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/fib\.js/);
    expect(output.run1['main.js'].toString()).to.not.match(/fib\/index\.js/);
    expect(output.run2['main.js'].toString()).to.match(/fib\/index\.js/);
    expect(output.run2['main.js'].toString()).to.not.match(/fib\.js/);
  });

  itCompilesChange('loader-custom-resolve-missing', {
    'fib.js': null,
    'loader.js': null,
  }, {
    'fib.js': [
      'module.exports = function(n) {',
      '  return n + (n > 0 ? n - 2 : 0);',
      '};',
    ].join('\n'),
    'loader.js': null,
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/n - 1/);
    expect(output.run2['main.js'].toString()).to.match(/n - 2/);
  });

  itCompilesChange('loader-custom-resolve-missing', {
    'loader.js': null,
  }, {
    'loader.js': [
      'module.exports = function(source) {',
      '  this.cacheable && this.cacheable();',
      '  return [',
      '    \'// loader.js\',',
      '    source,',
      '  ].join(\'\\n\');',
      '};',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/loader\/index\.js/);
    expect(output.run2['main.js'].toString()).to.match(/loader\.js/);
  });

  itCompilesChange('loader-custom-resolve-missing-query', {
    'fib.js': null,
    'loader.js': null,
  }, {
    'fib.js': [
      'module.exports = function(n) {',
      '  return n + (n > 0 ? n - 2 : 0);',
      '};',
    ].join('\n'),
    'loader.js': null,
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/n - 1/);
    expect(output.run2['main.js'].toString()).to.match(/n - 2/);
  });

  itCompiles('loader-file-move', 'loader-file-move',
    function() {
      return writeFiles('loader-file-move', {
        'index.js': 'require(\'./image.png\');\n',
      })
      .then(function() {
        return {
          exportCompilation: true,
        };
      });
    },
    function(run1) {
      return new Promise(function(resolve) {setTimeout(resolve, 1000);})
      .then(function() {
        return writeFiles('loader-file-move', {
          'index.js': '// require(\'./image.png\');\n',
        })
      })
      .then(function() {
        return {
          compiler: run1.compiler,
          exportCompilation: true,
        };
      });
    },
    function(run2) {
      return new Promise(function(resolve) {setTimeout(resolve, 1000);})
      .then(function() {
        return writeFiles('loader-file-move', {
          'index.js': 'require(\'./image.png\');\n',
        })
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
    }
  );

});

describe('loader webpack use - watch mode', function() {

  it('loader-file-use: compiles in watch mode', function(done) {
    compile('loader-file-use', {watch: 'startStop'})
    .then(function(result) {
      return compile('loader-file-use', {watch: 'startStop'});
    })
    .then(function(result) {
      done();
    })
    .catch(done);
  });

});
