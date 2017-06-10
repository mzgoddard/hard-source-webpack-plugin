var fs = require('fs');
var path = require('path');

var mkdirp = require('mkdirp');
var level = require('level');

var Promise = require('bluebird');

var fsReadFile = Promise.promisify(fs.readFile, {context: fs});
var fsReaddir = Promise.promisify(fs.readdir, {context: fs});
var fsStat = Promise.promisify(fs.stat, {context: fs});
var fsWriteFile = Promise.promisify(fs.writeFile, {context: fs});

exports.FileSerializer = FileSerializer;
exports.LevelDbSerializer = LevelDbSerializer;
exports.JsonSerializer = JsonSerializer;

function FileSerializer(options) {
  this.path = options.cacheDirPath;
}

FileSerializer.prototype.read = function() {
  var assets = {};
  var cacheAssetDirPath = this.path;
  mkdirp.sync(cacheAssetDirPath);
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
  mkdirp.sync(cacheAssetDirPath);
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
    if (ops[i].value === null) {
      ops[i].type = 'delete';
    }
    else {
      ops[i].type = 'put';
    }
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

function JsonSerializer(options) {
  this.path = options.cacheDirPath;
  if (!/\.json$/.test(this.path)) {
    this.path += '.json';
  }
}

JsonSerializer.prototype.read = function() {
  var cacheDirPath = this.path;
  return Promise.promisify(fs.readFile)(cacheDirPath, 'utf8')
  .catch(function() {return '{}';})
  .then(JSON.parse);
};

JsonSerializer.prototype.write = function(moduleOps) {
  var cacheDirPath = this.path;
  return this.read()
  .then(function(cache) {
    for (var i = 0; i < moduleOps.length; i++) {
      var op = moduleOps[i];
      cache[op.key] = op.value;
    }
    return cache;
  })
  .then(JSON.stringify)
  .then(function(cache) {
    return Promise.promisify(fs.writeFile)(cacheDirPath, cache);
  });
};
