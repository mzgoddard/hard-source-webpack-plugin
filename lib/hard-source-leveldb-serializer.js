var _level = require('level');

var promisify = require('./util/promisify');

var level = promisify(_level);

module.exports = LevelDbSerializer;

function LevelDbSerializer(options) {
  this.path = options.cacheDirPath;
  this.leveldbLock = Promise.resolve();
}

LevelDbSerializer.prototype.read = function() {
  var start = Date.now();
  var moduleCache = {};
  return level(this.path)
  .then(function(db) {
    return new Promise(function(resolve, reject) {
      var dbClose = promisify(db.close, {context: db});
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
      if (typeof ops[i].value !== 'string') {
        ops[i].value = JSON.stringify(ops[i].value);
      }
      ops[i].type = 'put';
    }
  }

  var cachePath = this.path;

  return this.leveldbLock = this.leveldbLock
  .then(function() {
    return level(cachePath);
  })
  .then(function(db) {
    return promisify(db.batch, {context: db})(ops)
    .then(function() {return db;});
  })
  .then(function(db) {
    return promisify(db.close, {context: db})();
  });
};
