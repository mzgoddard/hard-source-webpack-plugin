const crypto = require('crypto');
const path = require('path');

const lodash = require('lodash');

const bulkFsTask = require('./util/bulk-fs-task');
const pluginCompat = require('./util/plugin-compat');
const promisify = require('./util/promisify');
const values = require('./util/Object.values');
const { parityCacheFromCache, pushParityWriteOps } = require('./util/parity');

class Md5Cache {
  apply(compiler) {
    let md5Cache = {};
    let parityCache = {};

    const fileMd5s = {};
    const cachedMd5s = {};
    let fileTimestamps = {};
    const contextMd5s = {};
    let contextTimestamps = {};

    let md5CacheSerializer;

    let latestStats = {};
    let latestMd5s = {};
    let unbuildMd5s = {};

    let fileDependencies = [];
    let contextDependencies = [];

    let stat;
    let readdir;
    let readFile;
    let mtime;
    let md5;
    let fileStamp;
    let contextStamp;
    let contextStamps;

    function bindFS() {
      stat = promisify(compiler.inputFileSystem.stat, {
        context: compiler.inputFileSystem,
      });
      // stat = promisify(fs.stat, {context: fs});

      readdir = promisify(compiler.inputFileSystem.readdir, {
        context: compiler.inputFileSystem,
      });

      readFile = promisify(compiler.inputFileSystem.readFile, {
        context: compiler.inputFileSystem,
      });

      mtime = file =>
        stat(file)
          .then(stat => +stat.mtime)
          .catch(() => 0);

      md5 = file =>
        readFile(file)
          .then(contents =>
            crypto
              .createHash('md5')
              .update(contents, 'utf8')
              .digest('hex'),
          )
          .catch(() => '');

      fileStamp = (file, stats) => {
        if (compiler.__hardSource_fileTimestamps[file]) {
          return compiler.__hardSource_fileTimestamps[file];
        } else {
          if (!stats[file]) {
            stats[file] = stat(file);
          }
          return stats[file].then(stat => {
            const mtime = +stat.mtime;
            compiler.__hardSource_fileTimestamps[file] = mtime;
            return mtime;
          });
        }
      };

      contextStamp = (dir, stats) => {
        const context = {};

        let selfTime = 0;

        function walk(dir) {
          return readdir(dir)
            .then(items =>
              Promise.all(
                items.map(item => {
                  const file = path.join(dir, item);
                  if (!stats[file]) {
                    stats[file] = stat(file);
                  }
                  return stats[file].then(
                    stat => {
                      if (stat.isDirectory()) {
                        return walk(path.join(dir, item)).then(items2 =>
                          items2.map(item2 => path.join(item, item2)),
                        );
                      }
                      if (+stat.mtime > selfTime) {
                        selfTime = +stat.mtime;
                      }
                      return item;
                    },
                    () => {
                      return;
                    },
                  );
                }),
              ),
            )
            .catch(() => [])
            .then(items =>
              items
                .reduce((carry, item) => carry.concat(item), [])
                .filter(Boolean),
            );
        }

        return walk(dir).then(items => {
          items.sort();
          const selfHash = crypto.createHash('md5');
          items.forEach(item => {
            selfHash.update(item);
          });
          context.mtime = selfTime;
          context.hash = selfHash.digest('hex');
          return context;
        });
      };

      contextStamps = (contextDependencies, stats) => {
        stats = stats || {};
        const contexts = {};
        contextDependencies.forEach(context => {
          contexts[context] = { files: [], mtime: 0, hash: '' };
        });

        const compilerContextTs = compiler.contextTimestamps;

        contextDependencies.forEach(contextPath => {
          const _context = contextStamp(contextPath, stats);
          if (!_context.then) {
            contexts[contextPath] = _context;
          } else {
            contexts[contextPath] = _context.then(context => {
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
    } else {
      pluginCompat.tap(
        compiler,
        'afterEnvironment',
        'HardSource - Md5Cache',
        bindFS,
      );
    }

    pluginCompat.tap(
      compiler,
      '_hardSourceCreateSerializer',
      'HardSource - Md5Cache',
      (cacheSerializerFactory, cacheDirPath) => {
        md5CacheSerializer = cacheSerializerFactory.create({
          name: 'md5',
          type: 'data',
          autoParse: true,
          cacheDirPath,
        });
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceResetCache',
      'HardSource - Md5Cache',
      () => {
        md5Cache = {};
        parityCache = {};
        fileTimestamps = {};
        contextTimestamps = {};
      },
    );

    pluginCompat.tapPromise(
      compiler,
      '_hardSourceReadCache',
      'HardSource - Md5Cache',
      ({ contextKeys, contextNormalPath }) =>
        md5CacheSerializer
          .read()
          .then(_md5Cache => {
            Object.keys(_md5Cache).forEach(key => {
              if (key.startsWith('__hardSource_parityToken')) {
                parityCache[key] = _md5Cache[key];
                delete _md5Cache[key];
              }
            });
            return _md5Cache;
          })
          .then(contextKeys(compiler, contextNormalPath))
          .then(_md5Cache => {
            Object.keys(_md5Cache).forEach(key => {
              if (typeof _md5Cache[key] === 'string') {
                _md5Cache[key] = JSON.parse(_md5Cache[key]);
              }

              if (_md5Cache[key] && _md5Cache[key].hash) {
                cachedMd5s[key] = _md5Cache[key].hash;
              }
            });
            md5Cache = _md5Cache;
          })
          .then(() => {
            const dependencies = Object.keys(md5Cache);
            fileDependencies = dependencies.filter(
              file => md5Cache[file].isFile,
            );
            contextDependencies = dependencies.filter(
              file => md5Cache[file].isDirectory,
            );
          }),
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceParityCache',
      'HardSource - Md5Cache',
      parityRoot => {
        parityCacheFromCache('Md5', parityRoot, parityCache);
      },
    );

    pluginCompat.tapPromise(
      compiler,
      '_hardSourceVerifyCache',
      'HardSource - Md5Cache',
      () => {
        latestStats = {};
        latestMd5s = {};
        unbuildMd5s = {};

        const stats = {};
        // var md5s = latestMd5s;

        // Prepare objects to mark md5s to delete if they are not used.
        for (const key in cachedMd5s) {
          unbuildMd5s[key] = null;
        }

        return Promise.all([
          (() => {
            const compilerFileTs = (compiler.__hardSource_fileTimestamps = {});
            const fileTs = (fileTimestamps = {});

            return bulkFsTask(fileDependencies, (file, task) => {
              if (compiler.__hardSource_fileTimestamps[file]) {
                return compiler.__hardSource_fileTimestamps[file];
              } else {
                compiler.inputFileSystem.stat(
                  file,
                  task((err, value) => {
                    if (err) {
                      return 0;
                    }

                    const mtime = +value.mtime;
                    compiler.__hardSource_fileTimestamps[file] = mtime;
                    return mtime;
                  }),
                );
              }
            }).then(mtimes => {
              const bulk = lodash.zip(fileDependencies, mtimes);
              return bulkFsTask(bulk, (item, task) => {
                const file = item[0];
                const mtime = item[1];

                fileTs[file] = mtime || 0;
                if (!compiler.__hardSource_fileTimestamps[file]) {
                  compiler.__hardSource_fileTimestamps[file] = mtime;
                }

                compiler.inputFileSystem.readFile(
                  file,
                  task(function(err, body) {
                    if (err) {
                      fileMd5s[file] = '';
                      return;
                    }

                    const hash = crypto
                      .createHash('md5')
                      .update(body, 'utf8')
                      .digest('hex');

                    fileMd5s[file] = hash;
                  }),
                );
              });
            });
          })(),
          (() => {
            compiler.contextTimestamps = compiler.contextTimestamps || {};
            const contextTs = (contextTimestamps = {});
            const contexts = contextStamps(contextDependencies, stats);
            return Promise.all(values(contexts)).then(function() {
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
        ]);
      },
    );

    pluginCompat.tap(
      compiler,
      'compilation',
      'HardSource - Md5Cache',
      compilation => {
        compilation.__hardSourceFileMd5s = fileMd5s;
        compilation.__hardSourceCachedMd5s = cachedMd5s;
        compilation.__hardSourceFileTimestamps = fileTimestamps;
      },
    );

    pluginCompat.tapPromise(
      compiler,
      '_hardSourceWriteCache',
      'HardSource - Md5Cache',
      (compilation, { relateNormalPath, contextNormalPath }) => {
        const moduleOps = [];
        const dataOps = [];
        const md5Ops = [];
        const assetOps = [];
        const moduleResolveOps = [];
        const missingOps = [];
        const resolverOps = [];

        let buildingMd5s = {};

        function buildMd5Ops(dependencies) {
          dependencies.forEach(file => {
            function updateMd5CacheItem(value) {
              if (
                !md5Cache[file] ||
                (md5Cache[file] && md5Cache[file].hash !== value.hash)
              ) {
                md5Cache[file] = value;
                cachedMd5s[file] = value.hash;

                md5Ops.push({
                  key: relateNormalPath(compiler, file),
                  value: value,
                });
              } else if (
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
            } else {
              buildingMd5s[file] = building.then(updateMd5CacheItem);
            }
          });
        }

        const fileDependencies = Array.from(compilation.fileDependencies).map(
          file => contextNormalPath(compiler, file),
        );

        const MD5_TIME_PRECISION_BUFFER = 2000;

        fileDependencies.forEach(file => {
          if (buildingMd5s[file]) {
            return;
          }
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
          } else {
            buildingMd5s[file] = md5(file).then(hash => ({
              mtime: Date.now() - MD5_TIME_PRECISION_BUFFER,
              hash,
              isFile: true,
              isDirectory: false,
            }));
          }
        });

        buildMd5Ops(fileDependencies);

        const contextDependencies = Array.from(
          compilation.contextDependencies,
        ).map(file => contextNormalPath(compiler, file));

        const contexts = contextStamps(contextDependencies);
        contextDependencies.forEach(file => {
          if (buildingMd5s[file]) {
            return;
          }
          delete unbuildMd5s[file];

          let context = contexts[file];
          if (!context.then) {
            // Subtract a small buffer from now for file systems that record lower
            // precision mtimes.
            context.mtime = Date.now() - MD5_TIME_PRECISION_BUFFER;
            context.isFile = false;
            context.isDirectory = true;
          } else {
            context = context.then(context => {
              context.mtime = Date.now() - MD5_TIME_PRECISION_BUFFER;
              context.isFile = false;
              context.isDirectory = true;
              return context;
            });
          }
          buildingMd5s[file] = context;
        });

        buildMd5Ops(contextDependencies);

        const writeMd5Ops = Promise.all(
          Object.keys(buildingMd5s).map(key => buildingMd5s[key]),
        ).then(() => {
          if (!compilation.compiler.parentCompilation) {
            for (const key in unbuildMd5s) {
              md5Ops.push({
                key: relateNormalPath(compiler, key),
                value: unbuildMd5s[key],
              });
            }
          }

          pushParityWriteOps(compilation, md5Ops);
        });

        return writeMd5Ops.then(() => md5CacheSerializer.write(md5Ops));
      },
    );
  }
}

module.exports = Md5Cache;
