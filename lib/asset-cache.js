var crypto = require('crypto');

var pluginCompat = require('./util/plugin-compat');
var relateContext = require('./util/relate-context');

function requestHash(request) {
  return crypto.createHash('sha1').update(request).digest().hexSlice();
}

var relateNormalRequest = relateContext.relateNormalRequest;

class AssetCache {
  apply(compiler) {
    var compilerHooks = pluginCompat.hooks(compiler);

    var assetCache = {};

    var assetArchetypeCache = {
      _ops: [],

      get: function(id) {
        var hashId = requestHash(relateNormalRequest(compiler, id));
        if (assetCache[hashId]) {
          if (typeof assetCache[hashId] === 'string') {
            assetCache[hashId] = JSON.parse(assetCache[hashId]);
          }
          return assetCache[hashId];
        }
      },

      set: function(id, item) {
        var hashId = requestHash(relateNormalRequest(compiler, id));
        if (item) {
          assetCache[hashId] = item;
          this._ops.push({
            key: hashId,
            value: item,
          });
        }
        else {
          assetCache[hashId] = null;
          this._ops.push({
            key: hashId,
            value: null,
          });
        }
      },

      operations: function() {
        var ops = this._ops.slice();
        this._ops.length = 0;
        return ops;
      },
    };

    compilerHooks._hardSourceArchetypeRegister.call('Asset', assetArchetypeCache);

    var assetCacheSerializer;

    compilerHooks._hardSourceCreateSerializer.tap('HardSource - AssetCache', (cacheSerializerFactory, cacheDirPath) => {
      assetCacheSerializer = cacheSerializerFactory.create({
        name: 'assets',
        type: 'file',
        cacheDirPath: cacheDirPath,
      });
    });

    compilerHooks._hardSourceResetCache.tap('HardSource - AssetCache', () => {
      assetCache = {};
    });

    compilerHooks._hardSourceReadCache.tapPromise('HardSource - AssetCache', () => (
      assetCacheSerializer.read()
      .then(function(_assetCache) {assetCache = _assetCache;})
    ));

    compilerHooks._hardSourceWriteCache.tapPromise('HardSource - AssetCache', () => {
      var assetOps = assetArchetypeCache.operations();

      return assetCacheSerializer.write(assetOps);
    });
  }
}

module.exports = AssetCache;
