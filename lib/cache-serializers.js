var fs = require('fs');
var path = require('path');

var level = require('level');

var Promise = require('bluebird');

var fsReadFile = Promise.promisify(fs.readFile, {context: fs});
var fsReaddir = Promise.promisify(fs.readdir, {context: fs});
var fsStat = Promise.promisify(fs.stat, {context: fs});
var fsWriteFile = Promise.promisify(fs.writeFile, {context: fs});

exports.FileSerializer = FileSerializer;
exports.LevelDbSerializer = LevelDbSerializer;
exports.LevelDbSliceSerializer = LevelDbSliceSerializer;

function FileSerializer(options) {
  this.path = options.cacheDirPath;
}

FileSerializer.prototype.read = function() {
  var assets = {};
  var cacheAssetDirPath = this.path;
  return Promise.all(fs.readdirSync(cacheAssetDirPath).map(function(name) {
    return fsReadFile(path.join(cacheAssetDirPath, name))
    .then(function(asset) {
      assets[name] = asset;
    });
  }))
  .then(function() {return assets;});
};

FileSerializer.prototype.write = function(assetOps) {
  var cacheAssetDirPath = this.path;
  return Promise.all(assetOps.map(function(asset) {
    var assetPath = path.join(cacheAssetDirPath, asset.key);
    return fsWriteFile(assetPath, asset.value);
  }));
};

function LevelDbSerializer(options) {
  this.path = options.cacheDirPath;
  this.leveldbLock = Promise.resolve();
}

LevelDbSerializer.prototype.read = function() {
  var start = Date.now();
  var moduleCache = {};
  return Promise.promisify(level)(this.path)
  .then(function(db) {
    return new Promise(function(resolve, reject) {
      var dbClose = Promise.promisify(db.close, {context: db});
      db.createReadStream()
      .on('data', function(data) {
        var value = data.value;
        if (!moduleCache[data.key]) {
          moduleCache[data.key] = value;
        }
      })
      .on('end', function() {
        dbClose().then(resolve, reject);
      });
    });
  })
  .then(function() {
    return moduleCache;
  });
};

LevelDbSerializer.prototype.write = function(moduleOps) {
  var ops = moduleOps;

  if (ops.length === 0) {
    return;
  }

  for (var i = 0; i < ops.length; i++) {
    ops.type = 'put';
  }

  var cachePath = this.path;

  return this.leveldbLock = this.leveldbLock
  .then(function() {
    return Promise.promisify(level)(cachePath);
  })
  .then(function(db) {
    return Promise.promisify(db.batch, {context: db})(ops)
    .then(function() {return db;});
  })
  .then(function(db) {
    return Promise.promisify(db.close, {context: db})();
  });
};

function LevelDbRoot(rootPath) {
  this.rootPath = rootPath;
  this.slices = {};
  this.leveldbLock = Promise.resolve();
}

LevelDbRoot.prototype.slice = function(name) {
  this.slices[name] = new LevelDbSlice(this, name);
  return this.slices[name];
};

LevelDbRoot.prototype._read = function() {
  var start = Date.now();
  var caches = {};
  var resolvers = {};
  for (var key in this.slices) {
    caches[key] = {};
    this.slices[key]._read = new Promise(function(resolve) {
      resolvers[key] = resolve;
    });
  }
  var _this = this;
  this._lock(function(db) {
    return new Promise(function(resolve, reject) {
      db.createReadStream()
      .on('data', function(data) {
        var value = data.value;
        var sliceKey = data.key.substring(0, data.key.indexOf(';'));
        var cacheKey = data.key.substring(sliceKey.length + 1);
        if (caches[sliceKey]) {
          caches[sliceKey][cacheKey] = value;
        }
      })
      .on('end', function() {
        resolve();
      });
    });
  })
  .then(function() {
    for (var key in resolvers) {
      resolvers[key](caches[key]);
    }
  });
};

LevelDbRoot.prototype._write = function(name, ops) {
  if (ops.length === 0) {
    return;
  }

  for (var i = 0; i < ops.length; i++) {
    ops[i].key = name + ';' + ops[i].key;
    ops[i].type = 'put';
  }

  this._lock(function(db) {
    return Promise.promisify(db.batch, {context: db})(ops);
  });
};

LevelDbRoot.prototype._lock = function(fn) {
  var _this = this;
  var cachePath = this.rootPath;
  return this.leveldbLock = this.leveldbLock
  .then(function() {
    if (_this._db) {
      var db = _this._db;
      _this._db = null;
      return db;
    }
    return Promise.promisify(level)(cachePath);
  })
  .then(function(db) {
    return Promise.resolve(fn(db))
    .then(function() {return db;});
  })
  .then(function(db) {
    _this._db = db;
    Promise.resolve()
    .then(function() {return Promise.resolve();})
    .then(function() {
      if (_this._db) {
        var db = _this._db;
        _this._db = null;
        Promise.promisify(db.close, {context: db})();
      }
    });
    // return Promise.promisify(db.close, {context: db})();
  });
};

function LevelDbSlice(root, name) {
  this.root = root;
  this.name = name;
}

LevelDbSlice.prototype.read = function() {
  if (!this._read) {
    this.root._read();
  }
  var read = this._read;
  this._read = null;
  return read;
};

LevelDbSlice.prototype.write = function(ops) {
  return this.root._write(this.name, ops);
};

var leveldbRoots = {};

function LevelDbSliceSerializer(options) {
  if (!leveldbRoots[options.rootPath]) {
    leveldbRoots[options.rootPath] = new LevelDbRoot(options.rootPath);
  }
  this.slice = leveldbRoots[options.rootPath].slice(options.slice);

  this.write = this.write.bind(this);
}

LevelDbSliceSerializer.prototype.read = function() {
  return this.slice.read();
};

LevelDbSliceSerializer.prototype.write = function(ops) {
  return this.slice.write(ops);
};
