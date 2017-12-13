var fs = require('fs');
var join = require('path').join;

var _mkdirp = require('mkdirp');

function promisify(f, o) {
  var ctx = o && o.context || null;
  return function() {
    var args = Array.from(arguments);
    return new Promise(function(resolve, reject) {
      args.push(function(err, value) {
        if (err) {return reject(err);}
        return resolve(value);
      });
      f.apply(ctx, args);
    });
  };
}

var mkdirp = promisify(_mkdirp);
var fsReadFile = promisify(fs.readFile, {context: fs});
var fsReaddir = promisify(fs.readdir, {context: fs});
var fsWriteFile = promisify(fs.writeFile, {context: fs});

module.exports = FileSerializer;

function FileSerializer(options) {
  this.path = options.cacheDirPath;
}

FileSerializer.prototype.read = function() {
  var assets = {};
  var cacheAssetDirPath = this.path;
  return mkdirp(cacheAssetDirPath)
  .then(function() {
    return fsReaddir(cacheAssetDirPath);
  })
  .then(function(dir) {
    return dir.map(function(name) {
      return Promise.all([name, fsReadFile(join(cacheAssetDirPath, name))]);
    });
  })
  .then(function(a) {return Promise.all(a);})
  .then(function(_assets) {
    for (var i = 0; i < _assets.length; i++) {
      assets[_assets[i][0]] = _assets[i][1];
    }
  })
  .then(function() {return assets;});
};

FileSerializer.prototype.write = function(assetOps) {
  var cacheAssetDirPath = this.path;
  return mkdirp(cacheAssetDirPath)
  .then(function() {
    return assetOps.map(function(asset) {
      var assetPath = join(cacheAssetDirPath, asset.key);
      return fsWriteFile(assetPath, asset.value);
    });
  })
  .then(function(a) {return Promise.all(a);});
};
