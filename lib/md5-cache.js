var crypto = require('crypto');
var path = require('path');

var lodash = require('lodash');

var pluginCompat = require('./util/plugin-compat');
var promisify = require('./util/promisify');
var values = require('./util/Object.values');
var bulkFsTask = require('./util/bulk-fs-task');

class Md5Cache {
  apply(compiler) {
    var md5Cache = {};

    var fileMd5s = {};
    var cachedMd5s = {};
    var fileTimestamps = {};
    var contextMd5s = {};
    var contextTimestamps = {};

    var md5CacheSerializer;

    var latestStats = {};
    var latestMd5s = {};
    var unbuildMd5s = {};

    var fileDependencies = [];
    var contextDependencies = [];

    var stat, readdir, readFile, mtime, md5, fileStamp, contextStamp, contextStamps;

    function bindFS() {
      stat = promisify(
        compiler.inputFileSystem.stat,
        {context: compiler.inputFileSystem}
      );
      // stat = promisify(fs.stat, {context: fs});

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
        .then(function(stat) {return +stat.mtime;})
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
        if (compiler.__hardSource_fileTimestamps[file]) {
          return compiler.__hardSource_fileTimestamps[file];
        }
        else {
          if (!stats[file]) {stats[file] = stat(file);}
          return stats[file]
          .then(function(stat) {
            var mtime = +stat.mtime;
            compiler.__hardSource_fileTimestamps[file] = mtime;
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
                if (+stat.mtime > selfTime) {
                  selfTime = +stat.mtime;
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
      pluginCompat.tap(compiler, 'afterEnvironment', 'HardSource - Md5Cache', bindFS);
    }

    pluginCompat.tap(compiler, '_hardSourceCreateSerializer', 'HardSource - Md5Cache', (cacheSerializerFactory, cacheDirPath) => {
      md5CacheSerializer = cacheSerializerFactory.create({
        name: 'md5',
        type: 'data',
        cacheDirPath: cacheDirPath,
      });
    });

    pluginCompat.tap(compiler, '_hardSourceResetCache', 'HardSource - Md5Cache', () => {
      md5Cache = {};
      fileTimestamps = {};
      contextTimestamps = {};
    });

    pluginCompat.tapPromise(compiler, '_hardSourceReadCache', 'HardSource - Md5Cache', ({
      contextKeys,
      contextNormalPath,
    }) => (
      md5CacheSerializer.read()
      .then(contextKeys(compiler, contextNormalPath))
      .then(function(_md5Cache) {
        Object.keys(_md5Cache).forEach(function(key) {
          if (typeof _md5Cache[key] === 'string') {
            _md5Cache[key] = JSON.parse(_md5Cache[key]);
          }

          cachedMd5s[key] = _md5Cache[key].hash;
        });
        md5Cache = _md5Cache;
      })
      .then(() => {
        const dependencies = Object.keys(md5Cache);
        fileDependencies = dependencies.filter(file => md5Cache[file].isFile);
        contextDependencies = dependencies.filter(file => md5Cache[file].isDirectory);
      })
    ));

    pluginCompat.tapPromise(compiler, '_hardSourceVerifyCache', 'HardSource - Md5Cache', () => {
      latestStats = {};
      latestMd5s = {};
      unbuildMd5s = {};

      var stats = {};
      // var md5s = latestMd5s;

      // Prepare objects to mark md5s to delete if they are not used.
      for (const key in cachedMd5s) {
        unbuildMd5s[key] = {
          mtime: 0,
          hash: '',
          isFile: false,
          isDirectory: false,
        };
      }

      return Promise.all([
        (function() {
          var compilerFileTs = compiler.__hardSource_fileTimestamps = {};
          var fileTs = fileTimestamps = {};

          return bulkFsTask(fileDependencies, function(file, task) {
            if (compiler.__hardSource_fileTimestamps[file]) {
              return compiler.__hardSource_fileTimestamps[file];
            }
            else {
              compiler.inputFileSystem.stat(file, task(function(err, value) {
                if (err) {
                  return 0;
                }

                var mtime = +value.mtime;
                compiler.__hardSource_fileTimestamps[file] = mtime;
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
              if (!compiler.__hardSource_fileTimestamps[file]) {
                compiler.__hardSource_fileTimestamps[file] = mtime;
              }

              // compiler.inputFileSystem.readFile(file, task(function(err, body) {
              //   if (err) {
              //     fileMd5s[file] = '';
              //     return;
              //   }
              //
              //   const hash = crypto.createHash('md5')
              //   .update(body, 'utf8').digest('hex');
              //
              //   fileMd5s[file] = hash;
              // }));

              task(function() {})();
            });
          });
        })(),
        (function() {
          compiler.contextTimestamps = compiler.contextTimestamps || {};
          var contextTs = contextTimestamps = {};
          // const contexts = contextStamps(contextDependencies, stats);
          // return Promise.all(values(contexts))
          // .then(function() {
          //   for (var contextPath in contexts) {
          //     var context = contexts[contextPath];
          //
          //     if (!compiler.contextTimestamps[contextPath]) {
          //       compiler.contextTimestamps[contextPath] = context.mtime;
          //     }
          //     contextTimestamps[contextPath] = context.mtime;
          //     fileMd5s[contextPath] = context.hash;
          //   }
          // });
        })(),
      ]);
    });

    pluginCompat.tap(compiler, 'compilation', 'HardSource - Md5Cache', compilation => {
      compilation.__hardSourceFileMd5s = fileMd5s;
      compilation.__hardSourceCachedMd5s = cachedMd5s;
      compilation.__hardSourceFileTimestamps = fileTimestamps;

      var stats = {};
      compilation.__hardSourceBuildHashes = (files, _contexts) => (
        Promise.all([
          files && bulkFsTask(files, (file, task) => {
            const fileMd5s = compilation.__hardSourceFileMd5s;
            if (fileMd5s[file]) {
              return task(() => {})();
            }
            compiler.inputFileSystem.readFile(file, task(function(err, body) {
              if (err) {
                fileMd5s[file] = '';
                return;
              }

              const hash = crypto.createHash('md5')
              .update(body, 'utf8').digest('hex');

              fileMd5s[file] = hash;
            }));
          }),
          _contexts && (() => {
            const contexts = contextStamps(_contexts, stats);
            return Promise.all(values(contexts))
            .then(function() {
              for (var contextPath in contexts) {
                var context = contexts[contextPath];

                if (!compiler.contextTimestamps[contextPath]) {
                  compiler.contextTimestamps[contextPath] = context.mtime;
                }
                contextTimestamps[contextPath] = context.mtime;
                fileMd5s[contextPath] = context.hash;
              }
            });
          })(),
        ])
      );
    });

    pluginCompat.tapPromise(compiler, '_hardSourceWriteCache', 'HardSource - Md5Cache', (compilation, {relateNormalPath}) => {
      var moduleOps = [];
      var dataOps = [];
      var md5Ops = [];
      var assetOps = [];
      var moduleResolveOps = [];
      var missingOps = [];
      var resolverOps = [];

      let buildingMd5s = {};

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
                key: relateNormalPath(compiler, file),
                value: JSON.stringify(value),
              });
            }
            else if (
              !value.mtime &&
              md5Cache[file] &&
              md5Cache[file].mtime !== value.mtime
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

      var fileDependencies = Array.from(compilation.fileDependencies);

      // if (!lodash.isEqual(fileDependencies, dataCache.fileDependencies)) {
      //   lodash.difference(dataCache.fileDependencies, fileDependencies).forEach(function(file) {
      //     buildingMd5s[file] = {
      //       mtime: 0,
      //       hash: '',
      //     };
      //   });
      //
      //   dataCache.fileDependencies = fileDependencies;
      //
      //   dataOps.push({
      //     key: 'fileDependencies',
      //     value: JSON.stringify(
      //       dataCache.fileDependencies
      //       .map(function(dep) {
      //         return relateNormalPath(compiler, dep);
      //       })
      //     ),
      //   });
      // }

      var MD5_TIME_PRECISION_BUFFER = 2000;

      fileDependencies.forEach(function(file) {
        if (buildingMd5s[file]) {return;}
        delete unbuildMd5s[file];

        if (fileMd5s[file]) {
          buildingMd5s[file] = {
            // Subtract a small buffer from now for file systems that record
            // lower precision mtimes.
            mtime: Date.now() - MD5_TIME_PRECISION_BUFFER,
            hash: fileMd5s[file],
            isFile: true,
            isDirectory: false,
          };
        }
        else {
          buildingMd5s[file] = md5(file)
          .then(function(hash) {
            return {
              mtime: Date.now() - MD5_TIME_PRECISION_BUFFER,
              hash: hash,
              isFile: true,
              isDirectory: false,
            };
          });
        }
      });

      buildMd5Ops(fileDependencies);

      var contextDependencies = Array.from(compilation.contextDependencies);

      // if (!lodash.isEqual(contextDependencies, dataCache.contextDependencies)) {
      //   lodash.difference(dataCache.contextDependencies, contextDependencies).forEach(function(file) {
      //     buildingMd5s[file] = {
      //       mtime: 0,
      //       hash: '',
      //     };
      //   });
      //
      //   dataCache.contextDependencies = contextDependencies;
      //
      //   dataOps.push({
      //     key: 'contextDependencies',
      //     value: JSON.stringify(
      //       dataCache.contextDependencies
      //       .map(function(dep) {
      //         return relateNormalPath(compiler, dep);
      //       })
      //     ),
      //   });
      // }

      const contexts = contextStamps(contextDependencies);
      contextDependencies.forEach(function(file) {
        if (buildingMd5s[file]) {return;}
        delete unbuildMd5s[file];

        var context = contexts[file];
        if (!context.then) {
          // Subtract a small buffer from now for file systems that record lower
          // precision mtimes.
          context.mtime = Date.now() - MD5_TIME_PRECISION_BUFFER;
          context.isFile = false;
          context.isDirectory = true;
        }
        else {
          context = context
          .then(function(context) {
            context.mtime = Date.now() - MD5_TIME_PRECISION_BUFFER;
            context.isFile = false;
            context.isDirectory = true;
            return context;
          });
        }
        buildingMd5s[file] = context;
      });

      buildMd5Ops(contextDependencies);

      var writeMd5Ops = Promise.all(Object.keys(buildingMd5s).map(function(key) {
        return buildingMd5s[key];
      }))
      .then(() => {
        if (!compilation.compiler.parentCompilation) {
          for (const key in unbuildMd5s) {
            md5Ops.push({
              key: relateNormalPath(compiler, key),
              value: JSON.stringify(unbuildMd5s[key]),
            });
          }
        }
      });

      return writeMd5Ops.then(function() {
        return md5CacheSerializer.write(md5Ops);
      });
    });
  }
}

module.exports = Md5Cache;
