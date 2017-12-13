var fs = require('fs');

var promisify = require('./util/promisify');

var fsReadFile = promisify(fs.readFile, {context: fs});
var fsWriteFile = promisify(fs.writeFile, {context: fs});

module.exports = JsonSerializer;

function JsonSerializer(options) {
  this.path = options.cacheDirPath;
  if (!/\.json$/.test(this.path)) {
    this.path += '.json';
  }
}

JsonSerializer.prototype.read = function() {
  var cacheDirPath = this.path;
  return fsReadFile(cacheDirPath, 'utf8')
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
    return fsWriteFile(cacheDirPath, cache);
  });
};
