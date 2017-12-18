var path = require('path');
var crypto = require('crypto');

var lodash = require('lodash');

var promisify = require('./util/promisify');
var values = require('./util/Object.values');
var bulkFsTask = require('./util/bulk-fs-task');

var MD5_TIME_PRECISION_BUFFER = 2000;

module.exports = function FileStampCache(options) {
  var compiler = options.compiler;
  var cacheDirPath = options.cachePath;
  var serializerFactory = options.serializerFactory;

  var stat, readdir, readFile, mtime, md5, fileStamp, contextStamps;

  function bindFS() {
    stat = promisify(
      compiler.inputFileSystem.stat,
      {context: compiler.inputFileSystem}
    );

    readdir = promisify(
      compiler.inputFileSystem.readdir,
      {context: compiler.inputFileSystem}
    );

    readFile = promisify(
      compiler.inputFileSystem.readFile,
      {context: compiler.inputFileSystem}
    );

    mtime = function(file) {
      return stat(file)
      .then(function(stat) {return +stat.mtime + MD5_TIME_PRECISION_BUFFER;})
      .catch(function() {return 0;});
    };

    md5 = function(file) {
      return readFile(file)
      .then(function(contents) {
        return crypto.createHash('md5').update(contents, 'utf8').digest('hex');
      })
      .catch(function() {return '';});
    };

    fileStamp = function(file, stats) {
      if (compiler.fileTimestamps[file]) {
        return compiler.fileTimestamps[file];
      }
      else {
        if (!stats[file]) {stats[file] = stat(file);}
        return stats[file]
        .then(function(stat) {
          var mtime = +stat.mtime + MD5_TIME_PRECISION_BUFFER;
          compiler.fileTimestamps[file] = mtime;
          return mtime;
        });
      }
    };

    contextStamp = function(dir, stats) {
      var context = {};

      var selfTime = 0;

      function walk(dir) {
        return readdir(dir)
        .then(function(items) {
          return Promise.all(items.map(function(item) {
            var file = path.join(dir, item);
            if (!stats[file]) {stats[file] = stat(file);}
            return stats[file]
            .then(function(stat) {
              if (stat.isDirectory()) {
                return walk(path.join(dir, item))
                .then(function(items2) {
                  return items2.map(function(item2) {
                    return path.join(item, item2);
                  });
                });
              }
              var mtime = +stat.mtime + MD5_TIME_PRECISION_BUFFER;
              if (mtime > selfTime) {
                selfTime = mtime;
              }
              return item;
            }, function() {
              return;
            });
          }));
        })
        .catch(() => [])
        .then(function(items) {
          return items.reduce(function(carry, item) {
            return carry.concat(item);
          }, [])
          .filter(Boolean);
        });
      }

      return walk(dir)
      .then(function(items) {
        items.sort();
        var selfHash = crypto.createHash('md5');
        items.forEach(function(item) {
          selfHash.update(item);
        });
        context.mtime = selfTime;
        context.hash = selfHash.digest('hex');
        return context;
      });
    };

    contextStamps = function(contextDependencies, stats) {
      stats = stats || {};
      var contexts = {};
      contextDependencies.forEach(function(context) {
        contexts[context] = {files: [], mtime: 0, hash: ''};
      });

      var compilerContextTs = compiler.contextTimestamps;

      contextDependencies.forEach(function(contextPath) {
        const _context = contextStamp(contextPath, stats);
        if (!_context.then) {
          contexts[contextPath] = _context;
        }
        else {
          contexts[contextPath] = _context
          .then(function(context) {
            contexts[contextPath] = context;
            return context;
          });
        }
      });
      return contexts;
    };
  }

  if (compiler.inputFileSystem) {
    bindFS();
  }
  else {
    compiler.plugin('after-environment', bindFS);
  }

  var md5Cache, fileMd5s, cachedMd5s, fileTimestamps, fileDependencies, contextDependencies, buildingMd5s, md5Ops;

  // buildingMd5s = {};
  // md5Ops = [];

  this.reset = function() {
    md5Cache = {};
    fileMd5s = {};
    cachedMd5s = {};
    fileDependencies = [];
    contextDependencies = [];
  };

  var _serializer;
  var serializer = function() {
    if (!_serializer) {
      _serializer = serializerFactory.create({
        name: 'md5',
        type: 'data',
        cacheDirPath: cacheDirPath,
        autoParse: true,
      });
    }
    return _serializer;
  };

  this.read = function() {
    return serializer().read()
    .then(function(_md5Cache) {
      md5Cache = _md5Cache;
      fileMd5s = {};
      cachedMd5s = {};
      fileDependencies = [];
      contextDependencies = [];

      for (var key in md5Cache) {
        cachedMd5s[key] = md5Cache[key].hash;
        if (md5Cache[key].hash) {
          if (md5Cache[key].isFile) {
            fileDependencies.push(key);
          }
          else if (md5Cache[key].isContext) {
            contextDependencies.push(key);
          }
        }
      }
    });
  };

  this.times = function() {
    return fileTimestamps;
  };

  this.hashes = function() {
    return fileMd5s;
  };

  this.cachedHashes = function() {
    return cachedMd5s;
  };

  this.prepare = function() {
    compiler.fileTimestamps = compiler.fileTimestamps || {};
    compiler.contextTimestamps = compiler.fileTimestamps || {};
    var fileTs = fileTimestamps = {};

    var stats = {};
    return Promise.all([
      (function() {
        return bulkFsTask(fileDependencies, function(file, task) {
          if (compiler.fileTimestamps[file]) {
            return compiler.fileTimestamps[file];
          }
          else {
            compiler.inputFileSystem.stat(file, task(function(err, value) {
              if (err) {
                return 0;
              }

              var mtime = +value.mtime + MD5_TIME_PRECISION_BUFFER;
              compiler.fileTimestamps[file] = mtime;
              return mtime;
            }));
          }
        })
        .then(function(mtimes) {
          const bulk = lodash.zip(fileDependencies, mtimes);
          return bulkFsTask(bulk, function(item, task) {
            var file = item[0];
            var mtime = item[1];

            fileTs[file] = mtime || 0;
            if (!compiler.fileTimestamps[file]) {
              compiler.fileTimestamps[file] = mtime;
            }

            if (
              fileTs[file] &&
              md5Cache[file] &&
              fileTs[file] < md5Cache[file].mtime
            ) {
              fileTs[file] = md5Cache[file].mtime;
              fileMd5s[file] = md5Cache[file].hash;
            }
            else {
              compiler.inputFileSystem.readFile(file, task(function(err, body) {
                if (err) {
                  fileMd5s[file] = '';
                  return;
                }

                const hash = crypto.createHash('md5')
                .update(body, 'utf8').digest('hex');

                fileMd5s[file] = hash;
              }));
            }
          });
        });
      })(),
      (function() {
        const contexts = contextStamps(contextDependencies, stats);
        return Promise.all(values(contexts))
        .then(function() {
          for (var contextPath in contexts) {
            var context = contexts[contextPath];

            if (!compiler.contextTimestamps[contextPath]) {
              compiler.contextTimestamps[contextPath] = context.mtime;
            }
            fileTimestamps[contextPath] = context.mtime;
            fileMd5s[contextPath] = context.hash;
          }
        });
      })(),
    ]);
  };

  this.update = function(_fileDependencies, _contextDependencies) {
    buildingMd5s = {};
    md5Ops = [];

    if (!lodash.isEqual(_fileDependencies, fileDependencies)) {
      lodash.difference(fileDependencies, _fileDependencies)
      .forEach(function(file) {
        buildingMd5s[file] = {mtime: 0, hash: ''};
        md5Ops.push({
          key: file,
          value: {
            mtime: 0,
            hash: '',
            isFile: false,
            isContext: false,
          },
        });
      });
      fileDependencies = _fileDependencies;
    }

    if (!lodash.isEqual(_contextDependencies, contextDependencies)) {
      lodash.difference(contextDependencies, _contextDependencies)
      .forEach(function(file) {
        buildingMd5s[file] = {mtime: 0, hash: ''};
        md5Ops.push({
          key: file,
          value: {
            mtime: 0,
            hash: '',
            isFile: false,
            isContext: false,
          },
        });
      });
      contextDependencies = _contextDependencies;
    }

    function buildMd5Ops(dependencies) {
      dependencies.forEach(function(file) {
        function updateMd5CacheItem(value) {
          if (
            !md5Cache[file] ||
            (
              md5Cache[file] &&
              md5Cache[file].hash !== value.hash
            )
          ) {
            md5Cache[file] = value;
            cachedMd5s[file] = value.hash;

            md5Ops.push({
              key: file,
              value: value,
            });
          }
          else if (
            !value.mtime ||
            value.isContext ||
            value.isFile &&
            md5Cache[file] &&
            value.mtime > md5Cache[file].mtime
          ) {
            md5Cache[file] = value;
            cachedMd5s[file] = value.hash;
          }
        }

        const building = buildingMd5s[file];
        if (!building.then) {
          updateMd5CacheItem(building);
        }
        else {
          buildingMd5s[file] = building.then(updateMd5CacheItem);
        }
      });
    }

    fileDependencies.forEach(function(file) {
      function getValue(store, key, fn) {
        if (store[key]) {
          return store[key];
        }
        else {
          return fn(key);
        }
      }

      if (fileMd5s[file]) {
        buildingMd5s[file] = {
          // Subtract a small buffer from now for file systems that record
          // lower precision mtimes.
          mtime: Date.now() - MD5_TIME_PRECISION_BUFFER,
          hash: fileMd5s[file],
          isFile: true,
          isContext: false,
        };
      }
      else {
        buildingMd5s[file] = md5(file)
        .then(function(hash) {
          return {
            mtime: Date.now() - MD5_TIME_PRECISION_BUFFER,
            hash: hash,
            isFile: true,
            isContext: false,
          };
        });
      }
    });

    buildMd5Ops(fileDependencies);

    const contexts = contextStamps(contextDependencies);
    contextDependencies.forEach(function(file) {
      var context = contexts[file];
      if (!context.then) {
        // Subtract a small buffer from now for file systems that record lower
        // precision mtimes.
        context.mtime = Date.now() - MD5_TIME_PRECISION_BUFFER;
        context.isFile = false;
        context.isContext = true;
      }
      else {
        context = context
        .then(function(context) {
          context.mtime = Date.now() - MD5_TIME_PRECISION_BUFFER;
          context.isFile = false;
          context.isContext = true;
          return context;
        });
      }

      buildingMd5s[file] = context;
    });

    buildMd5Ops(contextDependencies);
  };

  this.write = function() {
    if (!buildingMd5s) {return;}
    var writeMd5Ops = Promise.all(values(buildingMd5s));
    return writeMd5Ops.then(function() {
      // Clear time stamps. We want to use times from watchpack if webpack sets
      // those. We do not want to use stall timestamps in the next build built
      // by hard-source.
      compiler.contextTimestamps = compiler.fileTimestamps = {};
      return serializer().write(md5Ops);
    });
  };
};
