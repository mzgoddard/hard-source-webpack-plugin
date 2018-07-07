const path = require('path');

const lodash = require('lodash');
const nodeObjectHash = require('node-object-hash');

const pluginCompat = require('./util/plugin-compat');
const promisify = require('./util/promisify');
const relateContext = require('./util/relate-context');
const serial = require('./util/serial');
const values = require('./util/Object.values');
const bulkFsTask = require('./util/bulk-fs-task');
const { parityCacheFromCache, pushParityWriteOps } = require('./util/parity');
const parseJson = require('./util/parseJson');

const serialNormalResolved = serial.created({
  result: serial.path,
  resourceResolveData: serial.objectAssign({
    context: serial.created({
      issuer: serial.request,
      resolveOptions: serial.identity,
    }),
    path: serial.path,
    descriptionFilePath: serial.path,
    descriptionFileRoot: serial.path,
  }),
});

class EnhancedResolveCache {
  apply(compiler) {
    let missingCacheSerializer;
    let resolverCacheSerializer;

    let missingCache = { normal: {}, loader: {}, context: {} };
    let resolverCache = { normal: {}, loader: {}, context: {} };
    let parityCache = {};

    const compilerHooks = pluginCompat.hooks(compiler);

    compilerHooks._hardSourceCreateSerializer.tap(
      'HardSource - EnhancedResolveCache',
      (cacheSerializerFactory, cacheDirPath) => {
        missingCacheSerializer = cacheSerializerFactory.create({
          name: 'missing-resolve',
          type: 'data',
          autoParse: true,
          cacheDirPath,
        });
        resolverCacheSerializer = cacheSerializerFactory.create({
          name: 'resolver',
          type: 'data',
          autoParse: true,
          cacheDirPath,
        });
      },
    );

    compilerHooks._hardSourceResetCache.tap(
      'HardSource - EnhancedResolveCache',
      () => {
        missingCache = { normal: {}, loader: {}, context: {} };
        resolverCache = { normal: {}, loader: {}, context: {} };
        parityCache = {};

        compiler.__hardSource_missingCache = missingCache;
      },
    );

    compilerHooks._hardSourceReadCache.tapPromise(
      'HardSource - EnhancedResolveCache',
      ({ contextNormalPath, contextNormalRequest }) => {
        return Promise.all([
          missingCacheSerializer.read().then(_missingCache => {
            missingCache = { normal: {}, loader: {}, context: {} };

            compiler.__hardSource_missingCache = missingCache;

            function contextNormalMissingKey(compiler, key) {
              const parsed = parseJson(key);
              return JSON.stringify([
                contextNormalPath(compiler, parsed[0]),
                contextNormalPath(compiler, parsed[1]),
              ]);
            }

            function contextNormalMissing(compiler, missing) {
              return missing.map(missed =>
                contextNormalRequest(compiler, missed),
              );
            }

            Object.keys(_missingCache).forEach(key => {
              let item = _missingCache[key];
              if (typeof item === 'string') {
                item = parseJson(item);
              }
              const splitIndex = key.indexOf('/');
              const group = key.substring(0, splitIndex);
              const keyName = contextNormalMissingKey(
                compiler,
                key.substring(splitIndex + 1),
              );
              missingCache[group] = missingCache[group] || {};
              missingCache[group][keyName] = contextNormalMissing(
                compiler,
                item,
              );
            });
          }),

          resolverCacheSerializer.read().then(_resolverCache => {
            resolverCache = { normal: {}, loader: {}, context: {} };
            parityCache = {};

            function contextNormalResolvedKey(compiler, key) {
              const parsed = parseJson(key);
              return JSON.stringify([
                contextNormalPath(compiler, parsed[0]),
                parsed[1],
              ]);
            }

            function contextNormalResolved(compiler, resolved) {
              return serialNormalResolved.thaw(resolved, resolved, {
                compiler,
              });
            }

            Object.keys(_resolverCache).forEach(key => {
              let item = _resolverCache[key];
              if (typeof item === 'string') {
                item = parseJson(item);
              }
              if (key.startsWith('__hardSource_parityToken')) {
                parityCache[key] = item;
                return;
              }
              const splitIndex = key.indexOf('/');
              const group = key.substring(0, splitIndex);
              const keyName = contextNormalResolvedKey(
                compiler,
                key.substring(splitIndex + 1),
              );
              resolverCache[group] = resolverCache[group] || {};
              resolverCache[group][keyName] = contextNormalResolved(
                compiler,
                item,
              );
            });
          }),
        ]);
      },
    );

    compilerHooks._hardSourceParityCache.tap(
      'HardSource - EnhancedResolveCache',
      parityRoot => {
        parityCacheFromCache('EnhancedResolve', parityRoot, parityCache);
      },
    );

    let missingVerifyResolve;
    compiler.__hardSource_missingVerify = new Promise(resolve => {
      missingVerifyResolve = resolve;
    });

    compilerHooks._hardSourceVerifyCache.tapPromise(
      'HardSource - EnhancedResolveCache',
      () =>
        (() => {
          compiler.__hardSource_missingVerify = new Promise(resolve => {
            missingVerifyResolve = resolve;
          });

          const bulk = lodash.flatten(
            Object.keys(missingCache).map(group =>
              lodash.flatten(
                Object.keys(missingCache[group])
                  .map(key => {
                    const missingItem = missingCache[group][key];
                    if (!missingItem) {
                      return;
                    }
                    return missingItem.map((missed, index) => [
                      group,
                      key,
                      missed,
                      index,
                    ]);
                  })
                  .filter(Boolean),
              ),
            ),
          );

          return bulkFsTask(bulk, (item, task) => {
            const group = item[0];
            const key = item[1];
            const missingItem = missingCache[group][key];
            const missed = item[2];
            const missedPath = missed.split('?')[0];
            const missedIndex = item[3];

            // The missed index is the resolved item. Invalidate if it does not
            // exist.
            if (missedIndex === missingItem.length - 1) {
              compiler.inputFileSystem.stat(
                missed,
                task((err, stat) => {
                  if (err) {
                    missingItem.invalid = true;
                    missingItem.invalidReason = 'resolved now missing';
                  }
                }),
              );
            } else {
              compiler.inputFileSystem.stat(
                missed,
                task((err, stat) => {
                  if (err) {
                    return;
                  }

                  if (stat.isDirectory()) {
                    if (group === 'context') {
                      missingItem.invalid = true;
                    }
                  }
                  if (stat.isFile()) {
                    if (group === 'loader' || group.startsWith('normal')) {
                      missingItem.invalid = true;
                      missingItem.invalidReason = 'missing now found';
                    }
                  }
                }),
              );
            }
          });
        })().then(missingVerifyResolve),
    );

    function bindResolvers() {
      function configureMissing(key, resolver) {
        // missingCache[key] = missingCache[key] || {};
        // resolverCache[key] = resolverCache[key] || {};

        const _resolve = resolver.resolve;
        resolver.resolve = function(info, context, request, cb, cb2) {
          let numArgs = 4;
          if (!cb) {
            numArgs = 3;
            cb = request;
            request = context;
            context = info;
          }
          let resolveContext;
          if (cb2) {
            numArgs = 5;
            resolveContext = cb;
            cb = cb2;
          }

          if (info && info.resolveOptions) {
            key = `normal-${new nodeObjectHash({ sort: false }).hash(
              info.resolveOptions,
            )}`;
            resolverCache[key] = resolverCache[key] || {};
            missingCache[key] = missingCache[key] || {};
          }

          const resolveId = JSON.stringify([context, request]);
          const absResolveId = JSON.stringify([
            context,
            relateContext.relateAbsolutePath(context, request),
          ]);
          const resolve =
            resolverCache[key][resolveId] || resolverCache[key][absResolveId];
          if (resolve && !resolve.invalid) {
            const missingId = JSON.stringify([context, resolve.result]);
            const missing = missingCache[key][missingId];
            if (missing && !missing.invalid) {
              return cb(
                null,
                [resolve.result].concat(request.split('?').slice(1)).join('?'),
                resolve.resourceResolveData,
              );
            } else {
              resolve.invalid = true;
              resolve.invalidReason = 'out of date';
            }
          }
          let localMissing = [];
          const callback = (err, result, result2) => {
            if (result) {
              const inverseId = JSON.stringify([context, result.split('?')[0]]);
              const resolveId = JSON.stringify([context, request]);

              // Skip recording missing for any dependency in node_modules.
              // Changes to them will be handled by the environment hash. If we
              // tracked the stuff in node_modules too, we'd be adding a whole
              // bunch of reduntant work.
              if (result.includes('node_modules')) {
                localMissing = localMissing.filter(
                  missed => !missed.includes('node_modules'),
                );
              }

              // In case of other cache layers, if we already have missing
              // recorded and we get a new empty array of missing, keep the old
              // value.
              if (localMissing.length === 0 && missingCache[key][inverseId]) {
                return cb(err, result, result2);
              }

              missingCache[key][inverseId] = localMissing
                .filter((missed, missedIndex) => {
                  const index = localMissing.indexOf(missed);
                  if (index === -1 || index < missedIndex) {
                    return false;
                  }
                  if (missed === result) {
                    return false;
                  }
                  return true;
                })
                .concat(result.split('?')[0]);
              missingCache[key][inverseId].new = true;
              resolverCache[key][resolveId] = {
                result: result.split('?')[0],
                resourceResolveData: result2,
                new: true,
              };
            }
            cb(err, result, result2);
          };
          const _missing =
            cb.missing || (resolveContext && resolveContext.missing);
          if (_missing) {
            callback.missing = {
              push(path) {
                localMissing.push(path);
                _missing.push(path);
              },
              add(path) {
                localMissing.push(path);
                _missing.add(path);
              },
            };
            if (resolveContext) {
              resolveContext.missing = callback.missing;
            }
          } else {
            callback.missing = Object.assign(localMissing, {
              add(path) {
                localMissing.push(path);
              },
            });
            if (resolveContext) {
              resolveContext.missing = callback.missing;
            }
          }

          if (numArgs === 3) {
            _resolve.call(this, context, request, callback);
          } else if (numArgs === 5) {
            _resolve.call(
              this,
              info,
              context,
              request,
              resolveContext,
              callback,
            );
          } else {
            _resolve.call(this, info, context, request, callback);
          }
        };
      }

      if (compiler.resolverFactory) {
        compiler.resolverFactory.hooks.resolver
          .for('normal')
          .tap('HardSource resolve cache', (resolver, options) => {
            const normalCacheId = `normal-${new nodeObjectHash({
              sort: false,
            }).hash(Object.assign({}, options, { fileSystem: null }))}`;
            resolverCache[normalCacheId] = resolverCache[normalCacheId] || {};
            missingCache[normalCacheId] = missingCache[normalCacheId] || {};
            configureMissing(normalCacheId, resolver);
            return resolver;
          });
        compiler.resolverFactory.hooks.resolver
          .for('loader')
          .tap('HardSource resolve cache', resolver => {
            configureMissing('loader', resolver);
            return resolver;
          });
        compiler.resolverFactory.hooks.resolver
          .for('context')
          .tap('HardSource resolve cache', resolver => {
            configureMissing('context', resolver);
            return resolver;
          });
      } else {
        configureMissing('normal', compiler.resolvers.normal);
        configureMissing('loader', compiler.resolvers.loader);
        configureMissing('context', compiler.resolvers.context);
      }
    }

    compilerHooks.afterPlugins.tap('HardSource - EnhancedResolveCache', () => {
      if (compiler.resolvers.normal) {
        bindResolvers();
      } else {
        compilerHooks.afterResolvers.tap(
          'HardSource - EnhancedResolveCache',
          bindResolvers,
        );
      }
    });

    compilerHooks._hardSourceWriteCache.tapPromise(
      'HardSource - EnhancedResolveCache',
      (compilation, { relateNormalPath, relateNormalRequest }) => {
        if (compilation.compiler.parentCompilation) {
          const resolverOps = [];
          pushParityWriteOps(compilation, resolverOps);

          return resolverCacheSerializer.write(resolverOps);
        }

        const missingOps = [];
        const resolverOps = [];

        function relateNormalMissingKey(compiler, key) {
          const parsed = parseJson(key);
          return JSON.stringify([
            relateNormalPath(compiler, parsed[0]),
            relateNormalPath(compiler, parsed[1]),
          ]);
        }

        function relateNormalMissing(compiler, missing) {
          return missing.map(missed => relateNormalRequest(compiler, missed));
        }

        Object.keys(missingCache).forEach(group => {
          Object.keys(missingCache[group]).forEach(key => {
            if (!missingCache[group][key]) {
              return;
            }
            if (missingCache[group][key].new) {
              missingCache[group][key].new = false;
              missingOps.push({
                key: `${group}/${relateNormalMissingKey(compiler, key)}`,
                value: JSON.stringify(
                  relateNormalMissing(compiler, missingCache[group][key]),
                ),
              });
            } else if (missingCache[group][key].invalid) {
              missingCache[group][key] = null;
              missingOps.push({
                key: `${group}/${relateNormalMissingKey(compiler, key)}`,
                value: null,
              });
            }
          });
        });

        function relateNormalResolvedKey(compiler, key) {
          const parsed = parseJson(key);
          return JSON.stringify([
            relateNormalPath(compiler, parsed[0]),
            relateContext.relateAbsolutePath(parsed[0], parsed[1]),
          ]);
        }

        function relateNormalResolved(compiler, resolved) {
          return serialNormalResolved.freeze(resolved, resolved, {
            compiler,
          });
        }

        Object.keys(resolverCache).forEach(group => {
          Object.keys(resolverCache[group]).forEach(key => {
            if (!resolverCache[group][key]) {
              return;
            }
            if (resolverCache[group][key].new) {
              resolverCache[group][key].new = false;
              resolverOps.push({
                key: `${group}/${relateNormalResolvedKey(compiler, key)}`,
                value: JSON.stringify(
                  relateNormalResolved(compiler, resolverCache[group][key]),
                ),
              });
            } else if (resolverCache[group][key].invalid) {
              resolverCache[group][key] = null;
              resolverOps.push({
                key: `${group}/${relateNormalResolvedKey(compiler, key)}`,
                value: null,
              });
            }
          });
        });

        pushParityWriteOps(compilation, resolverOps);

        return Promise.all([
          missingCacheSerializer.write(missingOps),
          resolverCacheSerializer.write(resolverOps),
        ]);
      },
    );
  }
}

module.exports = EnhancedResolveCache;
