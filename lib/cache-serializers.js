import fs from 'fs';
import path from 'path';
import level from 'level';
import Promise from 'bluebird';

var fsReadFile = Promise.promisify(fs.readFile, {context: fs});
var fsReaddir = Promise.promisify(fs.readdir, {context: fs});
var fsStat = Promise.promisify(fs.stat, {context: fs});
var fsWriteFile = Promise.promisify(fs.writeFile, {context: fs});

export {FileSerializer};
export {LevelDbSerializer};

class FileSerializer {
  constructor(options) {
    this.path = options.cacheDirPath;
  }

  read() {
    var assets = {};
    var cacheAssetDirPath = this.path;
    return Promise.all(fs.readdirSync(cacheAssetDirPath).map(name => fsReadFile(path.join(cacheAssetDirPath, name))
    .then(asset => {
      assets[name] = asset;
    })))
    .then(() => assets);
  }

  write(assetOps) {
    var cacheAssetDirPath = this.path;
    return Promise.all(assetOps.map(asset => {
      var assetPath = path.join(cacheAssetDirPath, asset.key);
      return fsWriteFile(assetPath, asset.value);
    }));
  }
}

class LevelDbSerializer {
  constructor(options) {
    this.path = options.cacheDirPath;
    this.leveldbLock = Promise.resolve();
  }

  read() {
    var start = Date.now();
    var moduleCache = {};
    return Promise.promisify(level)(this.path)
    .then(db => new Promise((resolve, reject) => {
      var dbClose = Promise.promisify(db.close, {context: db});
      db.createReadStream()
      .on('data', data => {
        var value = data.value;
        if (!moduleCache[data.key]) {
          moduleCache[data.key] = value;
        }
      })
      .on('end', () => {
        dbClose().then(resolve, reject);
      });
    }))
    .then(() => moduleCache);
  }

  write(moduleOps) {
    var ops = moduleOps;

    if (ops.length === 0) {
      return;
    }

    for (var i = 0; i < ops.length; i++) {
      ops.type = 'put';
    }

    var cachePath = this.path;

    return this.leveldbLock = this.leveldbLock
    .then(() => Promise.promisify(level)(cachePath))
    .then(db => Promise.promisify(db.batch, {context: db})(ops)
    .then(() => db))
    .then(db => Promise.promisify(db.close, {context: db})());
  }
}
