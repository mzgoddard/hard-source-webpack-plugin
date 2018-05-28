const { cachePrefix } = require('.');
const parseJson = require('./parseJson');

class ParityRoot {
  constructor() {
    this.children = [];
  }

  add(name) {
    const bits = new ParityCache(name);
    this.children.push(bits);
    return bits;
  }

  verify() {
    const firstChild = this.children[0];
    if (!this.children.some(child => child.root)) {
      return true;
    }
    for (const child of this.children) {
      if (!child.verify()) {
        this.reason = {
          cache: child,
          cacheName: child.name,
          cacheReason: child.reason,
          message: `Cache ${child.name} is not complete. ${
            child.reason.message
          }`,
        };
        return false;
      }
      if (child !== firstChild && child.root.token !== firstChild.root.token) {
        this.reason = {
          firstCache: firstChild,
          firstCacheName: firstChild.name,
          firstCacheReason: firstChild.reason,
          secondCache: child,
          secondCacheName: child.name,
          secondCacheReason: child.reason,

          message: `Cache ${firstChild.name} and ${child.name} disagree.`,
        };
        return false;
      }
    }
    return true;
  }
}

class ParityCache {
  constructor(name) {
    this.name = name;
    this.root = null;
    this.bits = {};

    this.reason = null;
  }

  add(_token) {
    const token = ParityToken.fromJson(_token);
    if (token.isRoot) {
      this.root = token;
    }
    this.bits[token.id] = token;
  }

  verify() {
    if (this.root === null) {
      this.reason = {
        message: 'Root compilation not found.',
      };
      return false;
    }

    for (const id of this.root.ids) {
      if (typeof this.bits[id] === 'undefined') {
        this.reason = {
          message: `Compilation '${id}' not found.`,
        };
        return false;
      } else if (this.root.token !== this.bits[id].token) {
        this.reason = {
          message: `Root and '${id}' compilation disagree.`,
        };
        return false;
      }
    }

    return true;
  }
}

const createParityToken = (id, ids = null) => {
  const token = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    c =>
      c === 'x'
        ? ((Math.random() * 16) | 0).toString(16)
        : (((Math.random() * 4) | 0) + 8).toString(16),
  );

  return new ParityToken(id, token, ids);
};

class ParityToken {
  constructor(id, token, ids = null) {
    this.id = id;
    this.token = token;

    this.isRoot = ids !== null;
    this.ids = ids;
  }

  static fromCompilation(compilation) {
    let parentCompilation = compilation;
    while (parentCompilation.compiler.parentCompilation) {
      parentCompilation = parentCompilation.compiler.parentCompilation;
    }

    if (!parentCompilation.__hardSource_parityToken) {
      parentCompilation.__hardSource_parityToken = createParityToken(
        cachePrefix(parentCompilation),
        [],
      );
    }

    if (compilation !== parentCompilation) {
      return parentCompilation.__hardSource_parityToken.createChild(
        cachePrefix(compilation),
      );
    }
    return parentCompilation.__hardSource_parityToken;
  }

  static fromJson(json) {
    return new ParityToken(json.id, json.token, json.ids);
  }

  createChild(id) {
    this.ids.push(id);

    return new ParityToken(id, this.token);
  }

  toJSON() {
    return {
      type: 'CacheParityToken',
      id: this.id,
      ids: this.ids,
      token: this.token,
    };
  }
}

const parseIfString = item => {
  if (typeof item === 'string') {
    return parseJson(item);
  }
  return item;
};

const parityCacheFromCache = (name, parityRoot, cache) => {
  const parityCache = parityRoot.add(name);
  if (cache.__hardSource_parityToken_root) {
    const rootCompilation = parseIfString(cache.__hardSource_parityToken_root);
    parityCache.add(rootCompilation);
    rootCompilation.ids.forEach(id => {
      if (cache[`__hardSource_parityToken_${id}`]) {
        parityCache.add(parseIfString(cache[`__hardSource_parityToken_${id}`]));
      }
    });
  }
};

const pushParityWriteOps = (compilation, ops) => {
  if (compilation.compiler.parentCompilation) {
    ops.push({
      key: `__hardSource_parityToken_${cachePrefix(compilation)}`,
      value: JSON.stringify(ParityToken.fromCompilation(compilation)),
    });
  } else {
    ops.push({
      key: `__hardSource_parityToken_root`,
      value: JSON.stringify(ParityToken.fromCompilation(compilation)),
    });
  }
};

module.exports = {
  ParityRoot,
  ParityCache,
  ParityToken,

  parityCacheFromCache,
  pushParityWriteOps,
};
