const fs = require('graceful-fs');
const join = require('path').join;

const _mkdirp = require('mkdirp');

const promisify = require('./util/promisify');

const mkdirp = promisify(_mkdirp);
const fsReadFile = promisify(fs.readFile, { context: fs });
const fsReaddir = promisify(fs.readdir, { context: fs });
const fsWriteFile = promisify(fs.writeFile, { context: fs });

class FileSerializer {
  constructor({ cacheDirPath }) {
    this.path = cacheDirPath;
  }

  read() {
    const assets = {};
    const cacheAssetDirPath = this.path;
    return mkdirp(cacheAssetDirPath)
      .then(() => fsReaddir(cacheAssetDirPath))
      .then(dir =>
        dir.map(name =>
          Promise.all([name, fsReadFile(join(cacheAssetDirPath, name))]),
        ),
      )
      .then(a => Promise.all(a))
      .then(_assets => {
        for (let i = 0; i < _assets.length; i++) {
          assets[_assets[i][0]] = _assets[i][1];
        }
      })
      .then(() => assets);
  }

  write(assetOps) {
    const cacheAssetDirPath = this.path;
    return mkdirp(cacheAssetDirPath)
      .then(() =>
        assetOps.map(({ key, value }) => {
          const assetPath = join(cacheAssetDirPath, key);
          return fsWriteFile(assetPath, value);
        }),
      )
      .then(a => Promise.all(a));
  }
}

module.exports = FileSerializer;
