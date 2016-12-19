module.exports = HashCache;

function HashCache() {
  this._newHashes = [];
  this._cache = {};

  this._fileTimestamps = {};
  this._contextTimestamps = {};
  this._fileMd5s = {};
  this._cachedMd5s = {};

  this._fileDependencies = {};
  this._contextDependencies = {};

  this.load = this.load.bind(this);
}

HashCache.prototype.fileTimestamps = function() {
  return this._fileTimestamps;
};

HashCache.prototype.contextTimestamps = function() {
  return this._contextTimestamps;
};

HashCache.prototype.fileMd5s = function() {
  return this._fileMd5s;
};

HashCache.prototype.cachedMd5s = function() {
  return this._cachedMd5s;
};

// HashCache.prototype.fillHashes = function(fileTimestamps, contextTimestamps, fileMd5s, cachedMd5s) {};

HashCache.prototype.setDependencies = function(fileDependencies, contextDependencies) {
  this._fileDependencies = fileDependencies;
  this._contextDependencies = contextDependencies;
};

HashCache.prototype._contextStamps = function(fs, contextDependencies) {
  var _this = this;

  var contexts = {};
  contextDependencies.forEach(function(context) {
    contexts[context] = {files: [], mtime: 0, hash: ''};
  });

  // fileDependencies.forEach(function(file) {
  //   contextDependencies.forEach(function(context) {
  //     if (file.substring(0, context.length + 1) === context + path.sep) {
  //       contexts[context].files.push(file.substring(context.length + 1));
  //     }
  //   });
  // });

  return Promise.all(contextDependencies.map(function(contextPath) {
    var context = contexts[contextPath];
    var selfTime = 0;
    var selfHash = crypto.createHash('md5');
    function walk(dir) {
      return fs.readdir(dir)
      .then(function(items) {
        return Promise.all(items.map(function(item) {
          return fs.stat(path.join(dir, item))
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
    return walk(contextPath)
    .then(function(items) {
      items.sort();
      items.forEach(function(item) {
        selfHash.update(item);
      });
      context.mtime = selfTime;
      context.hash = selfHash.digest('hex');
    });
  }))
  .then(function() {
    return contexts;
  });
};

HashCache.prototype.buildHashes = function(fs) {
  var _this = this;

  function setKey(store, key, _default) {
    return function(value) {
      store[key] = value || _default;
    };
  }

  function setKeyError(store, key, _default) {
    return function(err) {
      store[key] = _default;

      if (err.code === "ENOENT") {return;}
      throw err;
    };
  }

  var md5Cache = _this._cache;
  var cachedMd5s = _this._cachedMd5s;
  var fileMd5s = _this._fileMd5s = {};
  var fileTs = _this._fileTimestamps = {};
  var contextTimestamps = _this._contextTimestamps = {};

  return Promise.all([
    Promise.all(_this._fileDependencies.map(function(file) {
      return fs.stat(file)
      .then(function(stat) {return +stat.mtime;})
      .then(setKey(fileTs, file, 0), setKeyError(fileTs, file, 0))
      .then(function() {
        var setter = setKey(fileMd5s, file, '');
        if (
          md5Cache[file] && fileTs[file] >= md5Cache[file].mtime ||
          !md5Cache[file] ||
          !fileTs[file]
        ) {
          return fs.md5(file)
          .then(setter, setKeyError(fileMd5s, file, ''));
        }
        else {
          setter(md5Cache[file].hash);
        }
      });
    })),
    (function() {
      // var contextTs = compiler.contextTimestamps = contextTimestamps = {};
      return _this._contextStamps(fs, _this._contextDependencies)
      .then(function(contexts) {
        for (var contextPath in contexts) {
          var context = contexts[contextPath];

          // fileTimestamps[contextPath] = context.mtime;
          contextTimestamps[contextPath] = context.mtime;
          fileMd5s[contextPath] = context.hash;
        }
      });
    })(),
  ]);
};

HashCache.prototype.reset = function() {
  this._fileTimestamps = {};
  this._contextTimestamps = {};
  this._fileMd5s = {};
  this._cachedMd5s = {};
}

HashCache.prototype.load = function(_md5Cache) {
  var _this = this;
  _this._cache = _md5Cache;
  Object.keys(_this._cache).forEach(function(key) {
    if (typeof _this._cache[key] === 'string') {
      _this._cache[key] = JSON.parse(_this._cache[key]);
      // _this._cache[key].mtime = _this._cache[key].mtime;
    }

    _this._cachedMd5s[key] = _this._cache[key].hash;
  });
};

HashCache.prototype.save = function(fs) {
  var _this = this;

  var md5Ops = [];
  var buildingMd5s = {};
  var isDep = {};

  var md5Cache = _this._cache;
  var cachedMd5s = _this._cachedMd5s;
  var fileMd5s = _this._fileMd5s;
  var fileTimestamps = _this._fileTimestamps;
  var contextTimestamps = _this._contextTimestamps;

  var fileDependencies = _this._fileDependencies;
  var contextDependencies = _this._contextDependencies;

  function buildMd5Op(value) {
    var file = value.file;
    if (
      !md5Cache[file] ||
      (!value.mtime && md5Cache[file] && md5Cache[file].mtime !== value.mtime) ||
      (md5Cache[file] && md5Cache[file].hash !== value.hash)
    ) {
      md5Cache[file] = value;
      cachedMd5s[file] = value.hash;

      md5Ops.push({
        key: file,
        value: JSON.stringify({
          mtime: value.mtime,
          hash: value.hash,
        }),
      });
    }
  }

  function getValue(store, key, fn) {
    if (store[key]) {
      return store[key];
    }
    else {
      return fn(key);
    }
  }

  fileDependencies.forEach(function(file) {
    if (buildingMd5s[file]) {return;}

    isDep[file] = true;

    if (fileMd5s[file] && cachedMd5s[file] && fileMd5s[file] === cachedMd5s[file]) {
      return;
    }

    buildingMd5s[file] = Promise.props({
      file: file,
      mtime: getValue(fileTimestamps, file, fs.mtime),
      hash: getValue(fileMd5s, file, fs.md5),
    })
    .then(buildMd5Op);
  });

  var newContexts = contextDependencies.reduce(function(carry, dep) {
    if (!fileMd5s[dep]) {carry.push(dep);}
    return carry;
  }, []);

  var contexts = _this._contextStamps(fs, newContexts);
  contextDependencies.forEach(function(file) {
    if (buildingMd5s[file]) {return;}

    isDep[file] = true;

    if (fileMd5s[file] && cachedMd5s[file] && fileMd5s[file] === cachedMd5s[file]) {
      return;
    }

    buildingMd5s[file] = contexts
    .then(function(contexts) {
      return Promise.props({
        file: file,
        mtime: contexts[file] ? contexts[file].mtime : contextTimestamps[file],
        hash: contexts[file] ? contexts[file].hash : fileMd5s[file],
      });
    })
    .then(buildMd5Op);
  });

  Object.keys(fileMd5s).forEach(function(file) {
    if (!isDep[file]) {
      md5Cache[file] = {
        mtime: 0,
        hash: '',
      };

      md5Ops.push({
        key: file,
        value: JSON.stringify({
          mtime: 0,
          hash: '',
        }),
      });
    }
  });

  return Promise.all(Object.keys(buildingMd5s).map(function(key) {
    return buildingMd5s[key];
  }))
  .then(function() {return md5Ops;});
};
