const crypto = require('crypto');

const pluginCompat = require('./util/plugin-compat');
const relateContext = require('./util/relate-context');
const { parityCacheFromCache, pushParityWriteOps } = require('./util/parity');

function requestHash(request) {
  return crypto
    .createHash('sha1')
    .update(request)
    .digest()
    .hexSlice();
}

const relateNormalRequest = relateContext.relateNormalRequest;

class AssetCache {
  apply(compiler) {
    const compilerHooks = pluginCompat.hooks(compiler);

    let assetCache = {};
    let parityCache = {};

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
        } else {
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

    compilerHooks._hardSourceArchetypeRegister.call(
      'Asset',
      assetArchetypeCache,
    );

    let assetCacheSerializer;
    let assetParityCacheSerializer;

    compilerHooks._hardSourceCreateSerializer.tap(
      'HardSource - AssetCache',
      (cacheSerializerFactory, cacheDirPath) => {
        assetCacheSerializer = cacheSerializerFactory.create({
          name: 'assets',
          type: 'file',
          cacheDirPath,
        });
        assetParityCacheSerializer = cacheSerializerFactory.create({
          name: 'assets-parity',
          type: 'data',
          cacheDirPath,
        });
      },
    );

    compilerHooks._hardSourceResetCache.tap('HardSource - AssetCache', () => {
      assetCache = {};
      parityCache = {};
    });

    compilerHooks._hardSourceReadCache.tapPromise(
      'HardSource - AssetCache',
      () =>
        Promise.all([
          assetCacheSerializer.read().then(_assetCache => {
            assetCache = _assetCache;
          }),
          assetParityCacheSerializer.read().then(_parityCache => {
            parityCache = _parityCache;
          }),
        ]),
    );

    compilerHooks._hardSourceParityCache.tap(
      'HardSource - AssetCache',
      parityRoot => {
        parityCacheFromCache('Asset', parityRoot, parityCache);
      },
    );

    compilerHooks._hardSourceWriteCache.tapPromise(
      'HardSource - AssetCache',
      compilation => {
        const assetOps = assetArchetypeCache.operations();

        const parityOps = [];
        pushParityWriteOps(compilation, parityOps);

        return Promise.all([
          assetCacheSerializer.write(assetOps),
          assetParityCacheSerializer.write(parityOps),
        ]);
      },
    );
  }
}

module.exports = AssetCache;
