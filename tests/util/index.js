var fs = require('fs');
var path = require('path');

var expect = require('chai').expect;
var MemoryFS = require('memory-fs');
var mkdirp = require('mkdirp');
var Promise = require('bluebird');
var rimraf = require('rimraf');
var webpack = require('webpack');

exports.compile = function(fixturePath) {
  var configPath = path.join(__dirname, '..', 'fixtures', fixturePath, 'webpack.config');
  var compiler = webpack(require(configPath));
  var outputfs = compiler.outputFileSystem = new MemoryFS();
  var readdir = Promise.promisify(outputfs.readdir, {context: outputfs});
  var readFile = Promise.promisify(outputfs.readFile, {context: outputfs});
  var stat = Promise.promisify(outputfs.stat, {context: outputfs});
  var fsReaddir = Promise.promisify(fs.readdir, {context: fs});
  var fsReadFile = Promise.promisify(fs.readFile, {context: fs});
  var fsStat = Promise.promisify(fs.stat, {context: fs});
  var run = Promise.promisify(compiler.run, {context: compiler});

  return run()
  .then(function() {
    return Promise.all([
      readdir(compiler.options.output.path)
      .map(function(name) {
        var fullname = path.join(compiler.options.output.path, name);
        return stat(fullname)
        .then(function(stat) {
          if (stat.isFile()) {
            return readFile(fullname)
            .then(function(file) {return [name, file];});
          }
        });
      }),
      fsReaddir(compiler.options.output.path)
      .map(function(name) {
        var fullname = path.join(compiler.options.output.path, name);
        return fsStat(fullname)
        .then(function(stat) {
          if (stat.isFile()) {
            return fsReadFile(fullname)
            .then(function(file) {return [name, file];});
          }
        });
      }),
    ])
    .then(function(files) {
      return files[0].concat(files[1]);
    });
  })
  .reduce(function(carry, values) {
    if (values) {
      carry[values[0]] = values[1];
    }
    return carry;
  }, {});
};

exports.compileTwiceEqual = function(fixturePath) {
  var run1 = exports.compile(fixturePath);
  return run1
  .then(function() {
    var run2 = exports.compile(fixturePath);
    return Promise.all([run1, run2]);
  })
  .then(function(runs) {
    expect(runs[0]).to.eql(runs[1]);
  });
};

exports.itCompilesTwice = function(fixturePath) {
  before(function() {
    return exports.clean(fixturePath);
  });

  it('builds identical ' + fixturePath + ' fixture', function() {
    this.timeout(10000);
    return exports.compileTwiceEqual(fixturePath);
  });
};

exports.writeFiles = function(fixturePath, files) {
  var configPath = path.join(__dirname, '..', 'fixtures', fixturePath);

  fsUnlink = Promise.promisify(fs.unlink, {context: fs});
  _fsWriteFile = Promise.promisify(fs.writeFile, {context: fs});
  fsMkdirp = Promise.promisify(mkdirp);
  fsWriteFile = function(file, content, encode) {
    return fsMkdirp(path.dirname(file))
    .then(function() {
      return _fsWriteFile(file, content, encode);
    });
  };

  return Promise.all(Object.keys(files).map(function(key) {
    if (!files[key]) {
      return fsUnlink(path.join(configPath, key)).catch(function() {});
    }
    return fsWriteFile(path.join(configPath, key), files[key]);
  }));
};

exports.itCompilesChange = function(fixturePath, filesA, filesB, expectHandle) {
  before(function() {
    return exports.clean(fixturePath);
  });

  it('builds changes in ' + fixturePath + ' fixture', function() {
    this.timeout(10000);
    var run1;
    return Promise.resolve()
    .then(function() {
      return exports.writeFiles(fixturePath, filesA);
    })
    .then(function() {
      run1 = exports.compile(fixturePath);
      return run1;
    })
    .then(function() {
      return exports.writeFiles(fixturePath, filesB);
    })
    .then(function() {
      var run2 = exports.compile(fixturePath);
      return Promise.all([run1, run2]);
    })
    .then(function(runs) {
      expectHandle({
        run1: runs[0],
        run2: runs[1],
      });
    });
  });
};

exports.clean = function(fixturePath) {
  var tmpPath = path.join(__dirname, '..', 'fixtures', fixturePath, 'tmp');
  return Promise.promisify(rimraf)(tmpPath);
};

exports.describeWP2 = function() {
  var wpVersion = Number(require('webpack/package.json').version[0]);
  if (wpVersion > 1) {
    describe.apply(null, arguments);
  }
  else {
    describe.skip.apply(null, arguments);
  }
};
