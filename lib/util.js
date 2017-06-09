var fs = require('fs');
var path = require('path');

var LoggerFactory = require('./logger-factory');

exports.cachePrefix = cachePrefix;

var NS = fs.realpathSync(path.dirname(__dirname));

var cachePrefixNS = NS + '/cachePrefix';
var cachePrefixErrorOnce = true;

function cachePrefix(compilation) {
  if (typeof compilation[cachePrefixNS] === 'undefined') {
    var prefix = '';
    var nextCompilation = compilation;

    while (nextCompilation.compiler.parentCompilation) {
      var parentCompilation = nextCompilation.compiler.parentCompilation;
      if (!nextCompilation.cache) {
        if (cachePrefixErrorOnce) {
          cachePrefixErrorOnce = false;
          var loggerUtil = LoggerFactory.getLogger(compilation).from('util');
          loggerUtil.error(
            {
              id: 'child-compiler-no-memory-cache',
              compilerName: compilation.compiler.name
            },
            [
              'A child compiler (' + compilation.compiler.name + ') does not',
              'have a memory cache. Enable a memory cache with webpack\'s',
              '`cache` configuration option. HardSourceWebpackPlugin will be',
              'disabled for this child compiler until then.',
            ].join('\n')
          );
        }
        prefix = null;
        break;
      }

      var cache = nextCompilation.cache;
      var parentCache = parentCompilation.cache;

      if (cache === parentCache) {
        nextCompilation = parentCompilation;
        continue;
      }

      var cacheKey;
      for (var key in parentCache) {
        if (key && parentCache[key] === cache) {
          cacheKey = key;
          break;
        }
      }

      if (!cacheKey) {
        if (cachePrefixErrorOnce) {
          cachePrefixErrorOnce = false;
          var loggerUtil = LoggerFactory.getLogger(compilation).from('util');
          loggerUtil.error(
            {
              id: 'child-compiler-unnamed-memory-cache',
              compilerName: compilation.compiler.name
            },
            [
              'A child compiler (' + compilation.compiler.name + ') has a',
              'memory cache but its cache name is unknown.',
              'HardSourceWebpackPlugin will be disabled for this child',
              'compiler.',
            ].join('\n')
          );
        }
        prefix = null;
        break;
      }
      else {
        prefix = cacheKey + prefix;
      }

      nextCompilation = parentCompilation;
    }

    compilation[cachePrefixNS] = prefix;
  }

  return compilation[cachePrefixNS];
}
