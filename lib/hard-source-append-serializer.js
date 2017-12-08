var fs = require('fs');
var join = require('path').join;
var Readable = require('stream').Readable;

var _mkdirp = require('mkdirp');
var _rimraf = require('rimraf');
var writeJsonFile = require('write-json-file');
var Promise = require('bluebird');

var rimraf = Promise.promisify(_rimraf);
var open = Promise.promisify(fs.open);
var close = Promise.promisify(fs.close);
var read = Promise.promisify(fs.read);
var readFile = Promise.promisify(fs.readFile);
var write = Promise.promisify(fs.write);
var rename = Promise.promisify(fs.rename);
var unlink = Promise.promisify(fs.unlink);
var stat = Promise.promisify(fs.stat);
var mkdirp = Promise.promisify(_mkdirp);

module.exports = AppendSerializer;

var APPEND_VERSION = 1;
 
var _blockSize = 4 * 1024;
var _logSize = 2 * 1024 * 1024;
var _minCompactSize = 512 * 1024;
var _compactMultiplierThreshold = 1.5;

var value = function(key, size, start, blocks) {
  return {
    key: key,
    size: size || 0,
    start: start || 0,
    blocks: blocks || 0,
  };
};

var table = function(_table) {
  return {
    version: APPEND_VERSION,
    nextIndex: _table.nextIndex,
    blockSize: _table.blockSize,
    logSize: _table.logSize,
    map: _table.map,
  };
};

function putKey(_table, key, size) {
  return table({
    nextIndex: _table.nextIndex + Math.ceil(size / _table.blockSize),
    blockSize: _table.blockSize,
    logSize: _table.logSize,
    map: Object.assign({}, _table.map, {
      [key]: value(key, size, _table.nextIndex, Math.ceil(size / _table.blockSize)),
    }),
  });
}

function delKey(_table, key) {
  if (_table.map[key]) {
    return table({
      nextIndex: _table.nextIndex,
      blockSize: _table.blockSize,
      logSize: _table.logSize,
      map: Object.assign({}, _table.map, {
        [key]: value(key, 0, 0, 0),
      }),
    });
  }
}

var _tablepath = function(_this) {
  return join(_this.path, 'table.json');
};

var _defaultTable = function(_this) {
  return table({
    nextIndex: 0,
    blockSize: _this.blockSize || _blockSize,
    logSize: _this.logSize || _logSize,
    map: {},
  });
};

var _readTable = function(_this) {
  return readFile(_tablepath(_this), 'utf8')
  .catch(function(e) {
    return JSON.stringify(_defaultTable(_this));
  })
  .then(JSON.parse)
  .then(function(_table) {
    if (_table.version !== APPEND_VERSION) {
      return _defaultTable(_this);
    }
    return _table;
  });
};

var _writeTable = function(_this, _table) {
  return writeJsonFile(_tablepath(_this), _table);
};

var _logFilepath = function(_this, _table, index) {
  var logId = (index / (_table.logSize / _table.blockSize) | 0).toString();
  while (logId.length < 4) {
    logId = '0' + logId;
  }
  return join(_this.path, `log${logId}`);
};

var _openLog = function(_this, mode, _table, index) {
  if (_this._fd !== null) {
    return Promise.resolve();
  }
  else {
    // If mode is 'a', stat the log to write to, if it should be empty and
    // isn't, unlink before opening.
    return Promise.resolve()
    .then(function() {
      if (mode === 'a' && (index % (_table.logSize / _table.blockSize)) === 0) {
        return stat(_logFilepath(_this, _table, index))
        .then(function(_stat) {
          if (_stat.size > 0) {
            return unlink(_logFilepath(_this, _table, index));
          }
        })
        .catch(function() {});
      }
    })
    .then(function() {
      return open(_logFilepath(_this, _table, index), mode)
    })
    .then(function(fd) {
      _this._fd = fd;
    })
    .catch(function(e) {
      throw e;
    });
  }
};

var _closeLog = function(_this) {
  if (_this._fd === null) {return Promise.resolve();}
  else {
    return close(_this._fd)
    .then(function() {
      _this._fd = null;
    });
  }
};

var _readBufferSize = function(_this, _table) {
  return Math.min(32 * _table.blockSize, _table.logSize);
};

var _readLog = function(_this, _table) {
  var index = 0;
  var out = new Readable({
    read: function() {},
  });

  var _readBuffer = new Buffer(_readBufferSize(_this, _table));

  function _log() {
    if (index >= _table.nextIndex) {
      out.push(null);
      return _closeLog(_this);
    }

    var offset = 0;
    function step() {
      if (!_this._fd) {
        index = _table.nextIndex;
        return _log();
      }

      var sizeLeft = (_table.nextIndex - index) * _table.blockSize;

      return read(_this._fd, _readBuffer, 0, Math.min(_readBufferSize(_this, _table), sizeLeft), offset)
      .then(function(read) {
        for (var bufferIndex = 0; bufferIndex < read; bufferIndex += _table.blockSize) {
          index++;
          out.push(_readBuffer.slice(bufferIndex, bufferIndex + _table.blockSize));
        }
        if (read === _readBufferSize(_this, _table) && offset + _readBufferSize(_this, _table) < _table.logSize) {
          offset += _readBufferSize(_this, _table);
          return step();
        }
        return _log();
      });
    }

    return _closeLog(_this)
    .then(function() {
      return _openLog(_this, 'r', _table, index);
    })
    .then(step);
  }
  Promise.resolve().then(_log);

  return out;
};

var _appendBlock = function(_this, _table, blockContent, index) {
  return Promise.resolve()
  .then(function() {
    if (index % (_table.logSize / _table.blockSize) === 0) {
      return _closeLog(_this);
    }
  })
  .then(function() {
    return _openLog(_this, 'a', _table, index);
  })
  .then(function() {
    if (!_this._fd) {
      throw new Error();
    }
    if (blockContent.length > _table.blockSize) {
      throw new Error('block longer than max size');
    }
    if (blockContent.length < _table.blockSize) {
      var _blockContent = new Buffer(_table.blockSize);
      blockContent.copy(_blockContent);
      blockContent = _blockContent;
    }
    return write(_this._fd, blockContent, 0, _table.blockSize);
  });
};

var values = function(obj) {
  return Object.keys(obj)
  .map(key => obj[key]);
};

var _sizeNeeded = function(_this, _table) {
  return values(_table.map).reduce(function(carry, value) {
    return carry + value.size;
  }, 0);
};

var _sizeUsed = function(_this, _table) {
  return _table.nextIndex * _table.blockSize;
};

var _compactSize = function(_this, _table) {
  return Math.max(
    _this.compactSizeThreshold,
    _sizeNeeded(_this, _table) * this.compactMultiplierThreshold
  );
};

var _lock = function(_this, mustLock, promiseFn) {
  if (mustLock !== false) {
    return _this.lock = promiseFn(_this.lock);
  }
  return promiseFn(Promise.resolve());
};

function AppendSerializer(options) {
  this.path = options.cacheDirPath;
  this.blockSize = options.blockSize || _blockSize;
  this.logSize = options.logSize || _logSize;
  this.compactSizeThreshold = options.compactSizeThreshold || _minCompactSize;
  this.compactMultiplierThreshold = options.compactMultiplierThreshold || _compactMultiplierThreshold;

  this.lock = Promise.resolve();
  this._fd = null;
}

AppendSerializer.prototype.read = function(mustLock) {
  var _this = this;

  function _read() {
    var activeTable;
    return Promise.resolve()
    .then(function() {
      return _readTable(_this);
    })
    .then(function(_table) {
      activeTable = _table;
    })
    .then(function() {
      var map = {};

      var indexToValue = [];
      values(activeTable.map).forEach(function(value) {
        for (var i = value.start; i < value.start + value.blocks; i++) {
          indexToValue[i] = value;
        }
      });

      return new Promise(function(resolve, reject) {
        var blockIndex = 0;
        var log = _readLog(_this, activeTable);
        log.on('data', function(data) {
          var value = indexToValue[blockIndex];
          if (value) {
            if (!map[value.key]) {
              map[value.key] = new Buffer(value.size);
            }
            var destBuffer = map[value.key];
            var offset = destBuffer._offset || 0;
            data.copy(destBuffer.slice(offset, offset + data.length));
            destBuffer._offset = offset + data.length;
            if (destBuffer._offset >= value.size) {
              map[value.key] = destBuffer.toString();
            }
          }

          blockIndex += 1;
        });
        log.on('end', resolve);
        log.on('error', reject);
      })
      .then(function() {
        Object.keys(map).forEach(function(key) {
          if (Buffer.isBuffer(map[key])) {
            map[key] = map[key].toString();
          }
        });
        return map;
      });
    });
  }

  return _lock(_this, mustLock, function(promise) {
    return promise
    .then(function() {
      return _read();
    })
    .catch(function(e) {
      return _closeLog(_this)
      .then(function() {
        throw e;
      });
    });
  });
};

AppendSerializer.prototype.write = function(ops, mustLock) {
  var _this = this;

  var activeTable;
  function _write() {
    return Promise.resolve()
    .then(function() {
      return mkdirp(_this.path);
    })
    .then(function() {
      return _readTable(_this);
    })
    .then(function(_table) {
      activeTable = _table;
    })
    .then(function() {
      var _ops = ops.slice();
      function step() {
        var op = _ops.shift();
        if (!op) {
          return;
        }

        var content = op.value;
        if (content !== null) {
          var blockCount = Math.ceil(content.length / activeTable.blockSize);
          var contentBuffer = new Buffer(content);
          var nextIndex = activeTable.nextIndex;
          activeTable = putKey(activeTable, op.key, contentBuffer.length);
          var bufferIndex = 0;

          function append() {
            if (bufferIndex < contentBuffer.length) {
              var blockSlice = contentBuffer.slice(bufferIndex, bufferIndex + activeTable.blockSize);
              bufferIndex += activeTable.blockSize;
              return _appendBlock(_this, activeTable, blockSlice, nextIndex++)
              .then(append);
            }
          }
          return append()
          .then(step);
        }
        else {
          activeTable = delKey(activeTable, op.key);
          return Promise.resolve()
          .then(step);
        }
      }

      return step();
    })
    .then(function() {
      return _closeLog(_this);
    })
    .then(function() {
      return _writeTable(_this, activeTable);
    });
  }

  return _lock(_this, mustLock, function(promise) {
    return promise
    .then(function() {
      return _write();
    })
    .catch(function(e) {
      return _closeLog(_this)
      .then(function() {
        throw e;
      });
    })
    .then(function() {
      if (_sizeUsed(_this, activeTable) > _compactSize(_this, activeTable)) {
        return _this.compact(false);
      }
    });
  });
};

AppendSerializer.prototype.compact = function(mustLock) {
  var _this = this;

  return _this.read(mustLock)
  .then(function(map) {
    var ops = [];
    Object.keys(map).forEach(function(key) {
      ops.push({
        key: key,
        value: map[key],
      });
    });
    return ops;
  })
  .then(function(ops) {
    var copy = new AppendSerializer({
      cacheDirPath: _this.path + '~',

      blockSize: _this.blockSize,
      logSize: _this.logSize,
      compactSizeThreshold: _this.compactSizeThreshold,
      compactMultiplierThreshold: _this.compactMultiplierThreshold,
    });

    return _lock(_this, mustLock, function(promise) {
      return promise
      .then(function() {
        return copy.write(ops);
      })
      .then(function() {
        return rimraf(_this.path);
      })
      .then(function() {
        return rename(copy.path, _this.path);
      });
    });
  });
};
