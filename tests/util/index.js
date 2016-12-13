var fs = require('fs');
var path = require('path');
var vm = require('vm');

var expect = require('chai').expect;
var MemoryFS = require('memory-fs');

var LevelDbSerializer = require('../../lib/cache-serializers').LevelDbSerializer;
var mkdirp = require('mkdirp');
var Promise = require('bluebird');
var rimraf = require('rimraf');
var webpack = require('webpack');

function wrapModule(code) {
  return '(function(exports, require, module, __filename, __dirname) {' +
    code +
  '})';
}

function callModule(fn, filename) {
  var module = {exports: {}};
  fn(module.exports, Object.assign(function(modulename) {
    if (/\W/.test(modulename[0])) {
      return require(path.join(path.dirname(filename), modulename));
    }
    return require(modulename);
  }, require), module, filename, path.dirname(filename));
  return module.exports;
}

exports.compile = function(fixturePath, options) {
  var configPath = path.join(__dirname, '..', 'fixtures', fixturePath, 'webpack.config.js');
  var compiler = webpack(callModule(vm.runInThisContext(wrapModule(fs.readFileSync(configPath, 'utf8')), {filename: configPath}), configPath));
  var outputfs = compiler.outputFileSystem = new MemoryFS();
  var readdir = Promise.promisify(outputfs.readdir, {context: outputfs});
  var readFile = Promise.promisify(outputfs.readFile, {context: outputfs});
  var stat = Promise.promisify(outputfs.stat, {context: outputfs});
  var fsReaddir = Promise.promisify(fs.readdir, {context: fs});
  var fsReadFile = Promise.promisify(fs.readFile, {context: fs});
  var fsStat = Promise.promisify(fs.stat, {context: fs});
  var run = Promise.promisify(compiler.run, {context: compiler});

  return run()
  .then(function(stats) {
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
    })
    .reduce(function(carry, values) {
      if (values) {
        carry[values[0]] = values[1];
      }
      return carry;
    }, {})
    .then(function(carry) {
      if (options && options.exportStats) {
        var statsJson = stats.toJson({
          errors: true,
          warnings: true,
        });
        return {
          out: carry,
          warnings: statsJson.warnings,
          errors: statsJson.errors,
        };
      }
      if (options && options.exportCompilation) {
        return {
          out: carry,
          compilation: stats.compilation,
        };
      }
      else {
        return carry;
      }
    });
  })
  ;
};

exports.compileTwiceEqual = function(fixturePath, compileOptions) {
  var run1 = exports.compile(fixturePath, compileOptions);
  return run1
  .then(function() {
    var run2 = exports.compile(fixturePath, compileOptions);
    return Promise.all([run1, run2]);
  })
  .then(function(runs) {
    expect(runs[0]).to.eql(runs[1]);
  });
};

exports.itCompilesTwice = function(fixturePath, compileOptions) {
  before(function() {
    return exports.clean(fixturePath);
  });

  it('builds identical ' + fixturePath + ' fixture', function() {
    this.timeout(10000);
    return exports.compileTwiceEqual(fixturePath, compileOptions);
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
  fsRimraf = Promise.promisify(rimraf);

  return Promise.all(Object.keys(files).map(function(key) {
    if (files[key] === null) {
      return fsRimraf(path.join(configPath, key)).catch(function() {});
    }
    return fsWriteFile(path.join(configPath, key), files[key]);
  }));
};

exports.readFiles = function(outputPath) {
  outputPath = path.join(__dirname, '..', 'fixtures', outputPath);

  var fsReaddir = Promise.promisify(fs.readdir, {context: fs});
  var fsReadFile = Promise.promisify(fs.readFile, {context: fs});
  var fsStat = Promise.promisify(fs.stat, {context: fs});

  return fsReaddir(outputPath)
  .map(function(name) {
    var fullname = path.join(outputPath, name);
    return fsStat(fullname)
    .then(function(stat) {
      if (stat.isFile()) {
        return fsReadFile(fullname)
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

exports.itCompiles = function(name, fixturePath, fnA, fnB, expectHandle) {
  if (!fnA) {
    expectHandle = fixturePath;
    fixturePath = name;
    fnB = function() {};
    fnA = function() {};
  }
  if (!fnB) {
    expectHandle = fnA;
    fnB = function() {};
    fnA = function() {};
  }
  if (!expectHandle) {
    expectHandle = fnB;
    fnB = fnA;
  }

  before(function() {
    return exports.clean(fixturePath);
  });

  it(name, function() {
    this.timeout(20000);
    this.slow(4000);
    var run1;
    var setup1, setup2;
    return Promise.resolve()
    .then(function() {
      return fnA();
    })
    .then(function(_setup1) {
      setup1 = _setup1;
      run1 = exports.compile(fixturePath, setup1);
      return run1;
    })
    // Delay enough time so that file timestamps are different.
    .then(function() {
      // return new Promise(function(resolve) {setTimeout(resolve, 1000);});
    })
    .then(function() {
      return fnB();
    })
    .then(function(_setup2) {
      setup2 = _setup2;
      var run2 = exports.compile(fixturePath, setup2);
      return Promise.all([run1, run2]);
    })
    .then(function(runs) {
      expectHandle({
        run1: runs[0],
        run2: runs[1],
        setup1: setup1,
        setup2: setup2,
      });
    });
  });
};

exports.itCompilesWithCache = function(name, fixturePath, fnA, fnB, expectHandle) {
  before(function() {
    return exports.clean(fixturePath);
  });

  it(name, function() {
    this.timeout(20000);
    this.slow(4000);
    var cache1, cache2;
    return Promise.resolve()
    .then(function() {
      return fnA();
    })
    .then(function() {
      return exports.compile(fixturePath);
    })
    .then(function() {
      // return new Promise(function(resolve) {setTimeout(resolve, 1000);});
    })
    .then(function() {
      var serializer = new LevelDbSerializer({
        cacheDirPath: path.join(__dirname, '../', 'fixtures', fixturePath, 'tmp/cache/md5')
      });
      return serializer.read().then(function(_cache) { cache1 = _cache; });
    })
    .then(function() {
      return fnB();
    })
    .then(function() {
      return exports.compile(fixturePath);
    })
    .then(function() {
      // return new Promise(function(resolve) {setTimeout(resolve, 1000);});
    })
    .then(function() {
      var serializer = new LevelDbSerializer({
        cacheDirPath: path.join(__dirname, '../', 'fixtures', fixturePath, 'tmp/cache/md5')
      });
      return serializer.read().then(function(_cache) { cache2 = _cache; });
    })
    .then(function() {
      return expectHandle(cache1, cache2);
    });
  });
}

exports.itCompilesChange = function(fixturePath, filesA, filesB, expectHandle) {
  exports.itCompiles('builds changes in ' + fixturePath + ' fixture', fixturePath, function() {
    return exports.writeFiles(fixturePath, filesA);
  }, function() {
    return exports.writeFiles(fixturePath, filesB);
  }, expectHandle);
  before(function() {
    return exports.clean(fixturePath);
  });
};

exports.itCompilesHardModules = function(fixturePath, filesA, filesB, expectHandle) {
  if (typeof filesA === 'function' || Array.isArray(filesA)) {
    filesB = filesA;
    filesA = {};
  }
  if (typeof filesB === 'function' || Array.isArray(filesB)) {
    expectHandle = filesB;
    filesB = filesA;
  }
  exports.itCompiles('builds hard modules in ' + fixturePath + ' fixture', fixturePath, function() {
    return exports.writeFiles(fixturePath, filesA)
    .then(function() {return {exportCompilation: true};});
  }, function() {
    return exports.writeFiles(fixturePath, filesB)
    .then(function() {return {exportCompilation: true};});
  }, function(out) {
    var hardModules = [];
    var shortener = new (require('webpack/lib/RequestShortener'))(path.resolve(__dirname, '../fixtures', fixturePath));
    function walk(compilation) {
      compilation.modules.forEach(function(module) {
        if (module.isHard && module.isHard()) {
          hardModules.push(module.readableIdentifier(shortener));
        }
      });
      compilation.children.forEach(walk);
    }
    walk(out.run2.compilation);
    if (typeof expectHandle === 'function') {
      return expectHandle(out, hardModules);
    }
    else {
      // console.log(hardModules);
      expectHandle.forEach(function(handle) {
        if (handle instanceof RegExp) {
          expect(hardModules).to.satisfy(function(modules) {
            return modules.reduce(function(carry, module) {
              return carry || handle.test(module);
            }, false);
          });
        }
        else {
          expect(hardModules).to.include(handle);
        }
      });
    }
  });
  before(function() {
    return exports.clean(fixturePath);
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
