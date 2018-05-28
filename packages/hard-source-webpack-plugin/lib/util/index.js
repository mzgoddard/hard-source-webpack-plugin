const fs = require('fs');
const path = require('path');

const logMessages = require('./log-messages');

exports.cachePrefix = cachePrefix;

const NS = fs.realpathSync(path.dirname(__dirname));

const cachePrefixNS = `${NS}/cachePrefix`;

function cachePrefix(compilation) {
  if (typeof compilation[cachePrefixNS] === 'undefined') {
    let prefix = '';
    let nextCompilation = compilation;

    while (nextCompilation.compiler.parentCompilation) {
      const parentCompilation = nextCompilation.compiler.parentCompilation;
      if (!nextCompilation.cache) {
        logMessages.childCompilerWithoutCache(compilation);
        prefix = null;
        break;
      }

      const cache = nextCompilation.cache;
      let parentCache = parentCompilation.cache;

      if (cache === parentCache) {
        nextCompilation = parentCompilation;
        continue;
      }

      let cacheKey;
      for (var key in parentCache) {
        if (key && parentCache[key] === cache) {
          cacheKey = key;
          break;
        }
      }
      // webpack 3 adds the children member containing compiler names paired
      // with arrays of compilation caches, one for each compilation sharing the
      // same name.
      if (!cacheKey && parentCache.children) {
        parentCache = parentCache.children;
        for (var key in parentCache) {
          if (key && parentCache[key]) {
            for (const index in parentCache[key]) {
              if (parentCache[key][index] === cache) {
                cacheKey = `${key}.${index}`;
                break;
              }
              if (
                parentCache[key][index] &&
                typeof parentCache[key][index] === 'object'
              ) {
                for (const subkey in parentCache[key][index]) {
                  if (parentCache[key][index][subkey] === cache) {
                    cacheKey = `${key}.${index}.${subkey}`;
                    break;
                  }
                }
              }
            }
          }
        }
      }

      if (!cacheKey) {
        logMessages.childCompilerUnnamedCache(compilation);
        prefix = null;
        break;
      } else {
        prefix = cacheKey + prefix;
      }

      nextCompilation = parentCompilation;
    }

    compilation[cachePrefixNS] =
      prefix !== null
        ? require('crypto')
            .createHash('md5')
            .update(prefix)
            .digest('base64')
        : null;
  }

  return compilation[cachePrefixNS];
}
