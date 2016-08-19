var path = require('path');

var expect = require('chai').expect;
var MemoryFS = require('memory-fs');
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
  var run = Promise.promisify(compiler.run, {context: compiler});

  return run()
  .then(function() {return readdir(compiler.options.output.path);})
  .map(function(name) {
    var fullname = path.join(compiler.options.output.path, name);
    return stat(fullname)
    .then(function(stat) {
      if (stat.isFile()) {
        return readFile(fullname)
        .then(function(file) {return [name, file];});
      }
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
    return exports.compileTwiceEqual(fixturePath);
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
