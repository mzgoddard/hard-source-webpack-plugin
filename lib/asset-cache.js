const crypto = require('crypto');

const pluginCompat = require('./util/plugin-compat');
const relateContext = require('./util/relate-context');

function requestHash(request) {
  return crypto.createHash('sha1').update(request).digest().hexSlice();
}

const relateNormalRequest = relateContext.relateNormalRequest;

class AssetCache {
  apply(compiler) {
    const compilerHooks = pluginCompat.hooks(compiler);

    let assetCache = {};

    const assetArchetypeCache = {
      _ops: [],

      get(id) {
        const hashId = requestHash(relateNormalRequest(compiler, id));
        if (assetCache[hashId]) {
          if (typeof assetCache[hashId] === 'string') {
            assetCache[hashId] = JSON.parse(assetCache[hashId]);
          }
          return assetCache[hashId];
        }
      },

      set(id, item) {
        const hashId = requestHash(relateNormalRequest(compiler, id));
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

      operations() {
        const ops = this._ops.slice();
        this._ops.length = 0;
        return ops;
      },
    };

    compilerHooks._hardSourceArchetypeRegister.call('Asset', assetArchetypeCache);

    let assetCacheSerializer;

    compilerHooks._hardSourceCreateSerializer.tap('HardSource - AssetCache', (cacheSerializerFactory, cacheDirPath) => {
      assetCacheSerializer = cacheSerializerFactory.create({
        name: 'assets',
        type: 'file',
        cacheDirPath,
      });
    });

    compilerHooks._hardSourceResetCache.tap('HardSource - AssetCache', () => {
      assetCache = {};
    });

    compilerHooks._hardSourceReadCache.tapPromise('HardSource - AssetCache', () => (
      assetCacheSerializer.read()
      .then(_assetCache => {assetCache = _assetCache;})
    ));

    compilerHooks._hardSourceWriteCache.tapPromise('HardSource - AssetCache', () => {
      const assetOps = assetArchetypeCache.operations();

      return assetCacheSerializer.write(assetOps);
    });
  }
}

module.exports = AssetCache;
