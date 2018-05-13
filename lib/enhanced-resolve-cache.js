var path = require('path');

var lodash = require('lodash');
var nodeObjectHash = require('node-object-hash');

var pluginCompat = require('./util/plugin-compat');
var promisify = require('./util/promisify');
var relateContext = require('./util/relate-context');
var values = require('./util/Object.values');
var bulkFsTask = require('./util/bulk-fs-task');

class EnhancedResolveCache {
  apply(compiler) {
    var missingCacheSerializer;
    var resolverCacheSerializer;

    var missingCache = {normal: {}, loader: {}, context: {}};
    var resolverCache = {normal: {}, loader: {}, context: {}};

    var compilerHooks = pluginCompat.hooks(compiler);

    compilerHooks._hardSourceCreateSerializer.tap('HardSource - EnhancedResolveCache', (cacheSerializerFactory, cacheDirPath) => {
      missingCacheSerializer = cacheSerializerFactory.create({
        name: 'missing-resolve',
        type: 'data',
        cacheDirPath: cacheDirPath,
      });
      resolverCacheSerializer = cacheSerializerFactory.create({
        name: 'resolver',
        type: 'data',
        cacheDirPath: cacheDirPath,
      });
    });

    compilerHooks._hardSourceResetCache.tap('HardSource - EnhancedResolveCache', () => {
      missingCache = {normal: {}, loader: {}, context: {}};
      resolverCache = {normal: {}, loader: {}, context: {}};

      compiler.__hardSource_missingCache = missingCache;
    });

    compilerHooks._hardSourceReadCache.tapPromise('HardSource - EnhancedResolveCache', ({
      contextNormalPath,
      contextNormalRequest,
    }) => {
      return Promise.all([
        missingCacheSerializer.read()
        .then(function(_missingCache) {
          missingCache = {normal: {},loader: {}, context: {}};

          compiler.__hardSource_missingCache = missingCache;

          function contextNormalMissingKey(compiler, key) {
            var parsed = JSON.parse(key);
            return JSON.stringify([
              contextNormalPath(compiler, parsed[0]),
              contextNormalPath(compiler, parsed[1])
            ]);
          }

          function contextNormalMissing(compiler, missing) {
            return missing.map(function(missed) {
              return contextNormalRequest(compiler, missed);
            });
          }

          Object.keys(_missingCache).forEach(function(key) {
            var item = _missingCache[key];
            if (typeof item === 'string') {
              item = JSON.parse(item);
            }
            var splitIndex = key.indexOf('/');
            var group = key.substring(0, splitIndex);
            var keyName = contextNormalMissingKey(compiler, key.substring(splitIndex + 1));
            missingCache[group] = missingCache[group] || {};
            missingCache[group][keyName] = contextNormalMissing(compiler, item);
          });
        }),

        resolverCacheSerializer.read()
        .then(function(_resolverCache) {
          resolverCache = {normal: {}, loader: {}, context: {}};

          function contextNormalResolvedKey(compiler, key) {
            var parsed = JSON.parse(key);
            return JSON.stringify([contextNormalPath(compiler, parsed[0]), parsed[1]]);
          }

          function contextNormalResolved(compiler, resolved) {
            return Object.assign({}, resolved, {
              result: contextNormalPath(compiler, resolved.result),
            });
          }

          Object.keys(_resolverCache).forEach(function(key) {
            var item = _resolverCache[key];
            if (typeof item === 'string') {
              item = JSON.parse(item);
            }
            var splitIndex = key.indexOf('/');
            var group = key.substring(0, splitIndex);
            var keyName = contextNormalResolvedKey(compiler, key.substring(splitIndex + 1));
            resolverCache[group] = resolverCache[group] || {};
            resolverCache[group][keyName] = contextNormalResolved(compiler, item);
          });
        }),
      ]);
    });

    compilerHooks._hardSourceVerifyCache.tapPromise('HardSource - EnhancedResolveCache', () => (
      (function() {
        var bulk = lodash.flatten(Object.keys(missingCache)
        .map(function(group) {
          return lodash.flatten(Object.keys(missingCache[group])
          .map(function(key) {
            var missingItem = missingCache[group][key];
            if (!missingItem) {return;}
            return missingItem.map(function(missed, index) {
              return [group, key, missed, index];
            });
          })
          .filter(Boolean));
        }));

        return bulkFsTask(bulk, function(item, task) {
          var group = item[0];
          var key = item[1];
          var missingItem = missingCache[group][key];
          var missed = item[2];
          var missedPath = missed.split('?')[0];
          var missedIndex = item[3];

          // The missed index is the resolved item. Invalidate if it does not
          // exist.
          if (missedIndex === missingItem.length - 1) {
            compiler.inputFileSystem.stat(missed, task(function(err, stat) {
              if (err) {
                missingItem.invalid = true;
                missingItem.invalidReason = 'resolved now missing';
              }
            }));
          }
          else {
            compiler.inputFileSystem.stat(missed, task(function(err, stat) {
              if (err) {return;}

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
            }));
          }
        });
      })()
    ));

    function bindResolvers() {
      function configureMissing(key, resolver) {
        // missingCache[key] = missingCache[key] || {};
        // resolverCache[key] = resolverCache[key] || {};

        var _resolve = resolver.resolve;
        resolver.resolve = function(info, context, request, cb, cb2) {
          var numArgs = 4;
          if (!cb) {
            numArgs = 3;
            cb = request;
            request = context;
            context = info;
          }
          var resolveContext;
          if (cb2) {
            numArgs = 5;
            resolveContext = cb;
            cb = cb2;
          }

          if (info && info.resolveOptions) {
            key = `normal-${new nodeObjectHash({sort: false}).hash(info.resolveOptions)}`;
            resolverCache[key] = resolverCache[key] || {};
            missingCache[key] = missingCache[key] || {};
          }

          var resolveId = JSON.stringify([context, request]);
          var absResolveId = JSON.stringify([context, relateContext.relateAbsolutePath(context, request)]);
          var resolve = resolverCache[key][resolveId] || resolverCache[key][absResolveId];
          if (resolve && !resolve.invalid) {
            var missingId = JSON.stringify([context, resolve.result]);
            var missing = missingCache[key][missingId];
            if (missing && !missing.invalid) {
              return cb(null, [resolve.result].concat(request.split('?').slice(1)).join('?'));
            }
            else {
              resolve.invalid = true;
              resolve.invalidReason = 'out of date';
            }
          }
          var localMissing = [];
          var callback = function(err, result) {
            if (result) {
              var inverseId = JSON.stringify([context, result.split('?')[0]]);
              var resolveId = JSON.stringify([context, request]);

              // Skip recording missing for any dependency in node_modules.
              // Changes to them will be handled by the environment hash. If we
              // tracked the stuff in node_modules too, we'd be adding a whole
              // bunch of reduntant work.
              if (result.indexOf('node_modules') !== -1) {
                localMissing = localMissing.filter(function(missed) {
                  return missed.indexOf('node_modules') === -1;
                });
              }

              // In case of other cache layers, if we already have missing
              // recorded and we get a new empty array of missing, keep the old
              // value.
              if (localMissing.length === 0 && missingCache[key][inverseId]) {
                return cb(err, result);
              }

              missingCache[key][inverseId] = localMissing.filter(function(missed, missedIndex) {
                var index = localMissing.indexOf(missed);
                if (index === -1 || index < missedIndex) {
                  return false;
                }
                if (missed === result) {
                  return false;
                }
                return true;
              }).concat(result.split('?')[0]);
              missingCache[key][inverseId].new = true;
              resolverCache[key][resolveId] = {
                result: result.split('?')[0],
                new: true,
              };
            }
            cb(err, result);
          };
          var _missing = cb.missing || resolveContext && resolveContext.missing;
          if (_missing) {
            callback.missing = {
              push: function(path) {
                localMissing.push(path);
                _missing.push(path);
              },
              add: function(path) {
                localMissing.push(path);
                _missing.add(path);
              },
            };
            if (resolveContext) {
              resolveContext.missing = callback.missing;
            }
          }
          else {
            callback.missing = Object.assign(localMissing, {
              add: function(path) {
                localMissing.push(path);
              },
            });
            if (resolveContext) {
              resolveContext.missing = callback.missing;
            }
          }

          if (numArgs === 3) {
            _resolve.call(this, context, request, callback);
          }
          else if (numArgs === 5) {
            _resolve.call(this, info, context, request, resolveContext, callback);
          }
          else {
            _resolve.call(this, info, context, request, callback);
          }
        };
      }

      if (compiler.resolverFactory) {
        compiler.resolverFactory.hooks.resolver.for('normal').tap('HardSource resolve cache', function(resolver, options) {
          const normalCacheId = `normal-${new nodeObjectHash({sort: false}).hash(Object.assign({}, options, {fileSystem: null}))}`;
          resolverCache[normalCacheId] = resolverCache[normalCacheId] || {};
          missingCache[normalCacheId] = missingCache[normalCacheId] || {};
          configureMissing(normalCacheId, resolver);
          return resolver;
        });
        compiler.resolverFactory.hooks.resolver.for('loader').tap('HardSource resolve cache', function(resolver) {
          configureMissing('loader', resolver);
          return resolver;
        });
        compiler.resolverFactory.hooks.resolver.for('context').tap('HardSource resolve cache', function(resolver) {
          configureMissing('context', resolver);
          return resolver;
        });
      }
      else {
        configureMissing('normal', compiler.resolvers.normal);
        configureMissing('loader', compiler.resolvers.loader);
        configureMissing('context', compiler.resolvers.context);
      }
    }

    compilerHooks.afterPlugins.tap('HardSource - EnhancedResolveCache', () => {
      if (compiler.resolvers.normal) {
        bindResolvers();
      }
      else {
        compilerHooks.afterResolvers.tap('HardSource - EnhancedResolveCache', bindResolvers);
      }
    });

    compilerHooks._hardSourceWriteCache.tapPromise('HardSource - EnhancedResolveCache', (compilation, {
      relateNormalPath,
      relateNormalRequest,
    }) => {
      if (compilation.compiler.parentCompilation) {
        return Promise.resolve();
      }

      var missingOps = [];
      var resolverOps = [];

      function relateNormalMissingKey(compiler, key) {
        var parsed = JSON.parse(key);
        return JSON.stringify([
          relateNormalPath(compiler, parsed[0]),
          relateNormalPath(compiler, parsed[1])
        ]);
      }

      function relateNormalMissing(compiler, missing) {
        return missing.map(function(missed) {
          return relateNormalRequest(compiler, missed);
        });
      }

      Object.keys(missingCache).forEach(function(group) {
        Object.keys(missingCache[group]).forEach(function(key) {
          if (!missingCache[group][key]) {return;}
          if (missingCache[group][key].new) {
            missingCache[group][key].new = false;
            missingOps.push({
              key: group + '/' + relateNormalMissingKey(compiler, key),
              value: JSON.stringify(relateNormalMissing(compiler, missingCache[group][key])),
            });
          }
          else if (missingCache[group][key].invalid) {
            missingCache[group][key] = null;
            missingOps.push({
              key: group + '/' + relateNormalMissingKey(compiler, key),
              value: null,
            });
          }
        });
      });

      function relateNormalResolvedKey(compiler, key) {
        var parsed = JSON.parse(key);
        return JSON.stringify([
          relateNormalPath(compiler, parsed[0]),
          relateContext.relateAbsolutePath(parsed[0], parsed[1]),
        ]);
      }

      function relateNormalResolved(compiler, resolved) {
        return Object.assign({}, resolved, {
          result: relateNormalPath(compiler, resolved.result),
        });
      }

      Object.keys(resolverCache).forEach(function(group) {
        Object.keys(resolverCache[group]).forEach(function(key) {
          if (!resolverCache[group][key]) {return;}
          if (resolverCache[group][key].new) {
            resolverCache[group][key].new = false;
            resolverOps.push({
              key: group + '/' + relateNormalResolvedKey(compiler, key),
              value: JSON.stringify(relateNormalResolved(compiler, resolverCache[group][key])),
            });
          }
          else if (resolverCache[group][key].invalid) {
            resolverCache[group][key] = null;
            resolverOps.push({
              key: group + '/' + relateNormalResolvedKey(compiler, key),
              value: null,
            });
          }
        });
      });

      return Promise.all([
        missingCacheSerializer.write(missingOps),
        resolverCacheSerializer.write(resolverOps),
      ]);
    });
  }
}

module.exports = EnhancedResolveCache;
