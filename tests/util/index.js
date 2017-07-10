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
var mkdirp = require('mkdirp');

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
  var compiler = (options || {}).compiler ||
    webpack(callModule(vm.runInThisContext(
      wrapModule(fs.readFileSync(configPath, 'utf8')),
      {filename: configPath}
    ), configPath));

  compiler.inputFileSystem.purge();
  var outputfs = compiler.outputFileSystem = new MemoryFS();

  var readdir = Promise.promisify(outputfs.readdir, {context: outputfs});
  var readFile = Promise.promisify(outputfs.readFile, {context: outputfs});
  var stat = Promise.promisify(outputfs.stat, {context: outputfs});
  var fsReaddir = Promise.promisify(fs.readdir, {context: fs});
  var fsReadFile = Promise.promisify(fs.readFile, {context: fs});
  var fsStat = Promise.promisify(fs.stat, {context: fs});
  var run = Promise.promisify(compiler.run, {context: compiler});
  var watching = options && options.watching;
  var _watch = function() {
    return new Promise(function(resolve, reject) {
      watching = compiler.watch({}, function(err, stats) {
        if (err) {return reject(err);}
        resolve(stats);
      });
    });
  };
  var watchStart = _watch;
  var watchStop = function() {
    return new Promise(function(resolve, reject) {
      watching.close(function(err, stats) {
        watching = null;
        if (err) {return reject(err);}
        resolve(stats);
      });
    });
  };
  var watchStartStop = function() {
    return _watch()
    .then(function(stats) {
      watching.close();
      watching = null;
      return stats;
    });
  };
  var watchContinue = function() {
    return new Promise(function(resolve, reject) {
      watching.handler = function(err, stats) {
        if (err) {return reject(err);}
        resolve(stats);
      };
    });
  };

  var start;
  if (options && options.watch) {
    switch (options.watch) {
    case 'start':
      start = watchStart();
      break;
    case 'stop':
      start = watchStop();
      break;
    case 'startStop':
      start = watchStartStop();
      break;
    case 'continue':
      start = watchContinue();
      break;
    }
  }
  else {
    start = run();
  }

  return start
  .then(function(stats) {
    return Promise.all([
      readdir(compiler.options.output.path)
      .catch(function() {return [];})
      .map(function(name) {
        var fullname = path.join(compiler.options.output.path, name);
        return stat(fullname)
        .then(function(stat) {
          if (stat.isFile()) {
            return readFile(fullname, fullname.endsWith('.js') ? 'utf8' : '')
            .then(function(file) {return [name, file];});
          }
        });
      }),
      fsReaddir(compiler.options.output.path)
      .catch(function() {return [];})
      .map(function(name) {
        var fullname = path.join(compiler.options.output.path, name);
        return fsStat(fullname)
        .then(function(stat) {
          if (stat.isFile()) {
            return fsReadFile(fullname, fullname.endsWith('.js') ? 'utf8' : '')
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
      // console.log(stats.toJson());
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
          compiler: stats.compilation.compiler,
        };
      }
      if (options && options.watch) {
        return {
          out: carry,
          watching: watching,
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
  .catch(function() {return [];})
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

exports.itCompiles = function(name, fixturePath, fns, expectHandle) {
  if (!fns) {
    expectHandle = fixturePath;
    fixturePath = name;
    fns = [function() {}, function() {}];
  }
  else if (!expectHandle) {
    expectHandle = fns;
    fns = [function() {}, function() {}];
  }
  else if (arguments.length === 4) {
    expectHandle = arguments[3];
    fns = fns[arguments[2], arguments[2]];
  }
  else if (arguments.length > 4) {
    fns = [].slice.call(arguments, 2, arguments.length - 1);
    expectHandle = arguments[arguments.length - 1];
  }

  before(function() {
    return exports.clean(fixturePath);
  });

  it(name, function() {
    this.timeout(20000);
    this.slow(4000);
    var runs = [];
    var setups = [];
    var runIndex = 0;
    function doRun() {
      return Promise.resolve()
      .then(function() {})
      .then(function() {
        return fns[runIndex](runs[runIndex - 1]);
      })
      .then(function(_setup) {
        setups[runIndex] = _setup;
        return exports.compile(fixturePath, _setup);
      })
      .then(function(run) {
        runs[runIndex] = run;
        runIndex++;
        if (runIndex < fns.length) {
          return doRun();
        }
      });
    }
    return Promise.resolve()
    .then(function() {
      return doRun();
    })
    .then(function() {
      expectHandle({
        run1: runs[0],
        run2: runs[1],
        runs: runs,
        setup1: setups[0],
        setup2: setups[1],
        setups: setups,
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
  return Promise.promisify(rimraf)(tmpPath)
  .then(function() {
    return Promise.promisify(mkdirp)(tmpPath);
  });
};

exports.describeWP = function(version) {
  return function() {
    var wpVersion = Number(require('webpack/package.json').version[0]);
    if (wpVersion >= version) {
      describe.apply(null, arguments);
    }
    else {
      describe.skip.apply(null, arguments);
    }
  };
};

exports.describeWP2 = exports.describeWP(2);
