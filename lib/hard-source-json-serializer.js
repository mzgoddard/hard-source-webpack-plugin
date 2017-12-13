var fs = require('fs');

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
