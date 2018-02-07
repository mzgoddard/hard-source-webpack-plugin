var fs = require('fs');
var join = require('path').join;
var Readable = require('stream').Readable;

var _mkdirp = require('mkdirp');
var _rimraf = require('rimraf');
var writeJsonFile = require('write-json-file');

var entries = require('./util/Object.entries');
var values = require('./util/Object.values');
var promisify = require('./util/promisify');

var rimraf = promisify(_rimraf);
var open = promisify(fs.open);
var close = promisify(fs.close);
var read = promisify(fs.read);
var readFile = promisify(fs.readFile);
var write = promisify(fs.write);
var rename = promisify(fs.rename);
var unlink = promisify(fs.unlink);
var stat = promisify(fs.stat);
var mkdirp = promisify(_mkdirp);

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

var objFrom = function(map) {
  if (map instanceof Map) {
    var obj = {};
    map.forEach(function(value, key) {
      obj[key] = value;
    });
    return obj;
  }
  return map;
};

var table = function(_table) {
  return {
    version: APPEND_VERSION,
    nextIndex: _table.nextIndex,
    blockSize: _table.blockSize,
    logSize: _table.logSize,
    map: objFrom(_table.map),
  };
};

var modTable = function(_table) {
  return {
    version: APPEND_VERSION,
    nextIndex: _table.nextIndex,
    blockSize: _table.blockSize,
    logSize: _table.logSize,
    map: new Map(entries(_table.map)),
  };
};

function putKey(_table, key, size) {
  // _table.map[key] = value(key, size, _table.nextIndex, Math.ceil(size / _table.blockSize));
  _table.map.set(key, value(key, size, _table.nextIndex, Math.ceil(size / _table.blockSize)));
  _table.nextIndex = _table.nextIndex + Math.ceil(size / _table.blockSize);
  return _table;
}

function delKey(_table, key) {
  // if (_table.map[key]) {
  //   delete _table.map[key];
  if (_table.map.get(key)) {
    _table.map.delete(key);
  }
  return _table;
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

var timeout100 = function() {
  return new Promise(function(resolve) {
    return setTimeout(resolve, 100);
  });
};

var _retry = function(fn, n) {
  n = n || 5;
  var _retryFn = function(value) {
    if (n) {
      n--;
      return fn(value)
      .catch(_retryFn);
    }
    return fn(value);
  };
  return _retryFn;
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
            return unlink(_logFilepath(_this, _table, index))
            .then(timeout100);
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
      if (mode === 'a') {
        _this._writeBuffer = new Buffer(_table.logSize - (index % (_table.logSize / _table.blockSize)) * _table.blockSize);
        _this._writeOffset = 0;
      }
    })
    .catch(function(e) {
      throw e;
    });
  }
};

var _closeLog = function(_this) {
  if (_this._fd === null) {return Promise.resolve();}
  else {
    return Promise.resolve()
    .then(function() {
      if (_this._writeBuffer) {
        return write(_this._fd, _this._writeBuffer, 0, _this._writeOffset);
      }
    })
    .then(function() {
      return close(_this._fd);
    })
    .then(function() {
      _this._fd = null;
      _this._writeBuffer = null;
      _this._writeOffset = 0;
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

  var rbSize = _table.logSize;
  var _readBuffer = new Buffer(rbSize);

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

      return read(_this._fd, _readBuffer, 0, rbSize, 0)
      .then(function(read) {
        index += _table.logSize / _table.blockSize;
        out.push(_readBuffer);
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

var _appendBlock = function(_this, _table, blockContent, index, next) {
  var prep;
  if (_this._fd !== null && index % (_table.logSize / _table.blockSize) === 0) {
    prep = _closeLog(_this)
    .then(function() {
      return _openLog(_this, 'a', _table, index);
    });
  }
  else if (_this._fd === null) {
    prep = _openLog(_this, 'a', _table, index);
  }
  function work() {
    if (!_this._fd) {
      return next(new Error());
    }
    if (blockContent.length > _table.blockSize) {
      return next(new Error('block longer than max size'));
    }
    const writeSlice = _this._writeBuffer.slice(_this._writeOffset, _this._writeOffset + _table.blockSize);
    if (blockContent.length < _table.blockSize) {
      writeSlice.fill(0);
    }
    blockContent.copy(writeSlice);
    _this._writeOffset += _table.blockSize;
    next();
    // return fs.write(_this._fd, blockContent, 0, _table.blockSize, next);
  }
  if (prep) {
    prep.then(work);
  }
  else {
    work();
  }

  // return Promise.resolve()
  // .then(function() {
  //   if (index % (_table.logSize / _table.blockSize) === 0) {
  //     return _closeLog(_this);
  //   }
  // })
  // .then(function() {
  //   return _openLog(_this, 'a', _table, index);
  // })
  // .then(function() {
  //   if (!_this._fd) {
  //     throw new Error();
  //   }
  //   if (blockContent.length > _table.blockSize) {
  //     throw new Error('block longer than max size');
  //   }
  //   if (blockContent.length < _table.blockSize) {
  //     var _blockContent = new Buffer(_table.blockSize);
  //     blockContent.copy(_blockContent);
  //     blockContent = _blockContent;
  //   }
  //   return write(_this._fd, blockContent, 0, _table.blockSize);
  // });
};

var _sizeNeeded = function(_this, _table) {
  return values(_table.map).reduce(function(carry, value) {
    return carry + value.blocks * _table.blockSize;
  }, 0);
};

var _sizeUsed = function(_this, _table) {
  return _table.nextIndex * _table.blockSize;
};

var _compactSize = function(_this, _table) {
  return Math.max(
    _this.compactSizeThreshold,
    _sizeNeeded(_this, _table) * _this.compactMultiplierThreshold
  );
};

var _lock = function(_this, mustLock, promiseFn) {
  if (mustLock !== false) {
    return _this.lock = promiseFn(_this.lock);
  }
  return promiseFn(Promise.resolve());
};

var serialFsTask = function(array, each) {
  return new Promise(function(resolve, reject) {
    var queue = 0;
    var index = 0;
    var inNext = false;
    function next(err) {
      // console.log(queue, index, array.length, err);
      if (err) {
        return reject(err);
      }
      if (index === array.length) {
        return resolve();
      }
      queue++;
      if (inNext) {
        return;
      }
      inNext = true;
      while (queue > index && index < array.length) {
        // console.log(queue, index)
        try {
          each(array[index++], next);
        }
        catch (e) {
          return next(e);
        }
      }
      inNext = false;
    }
    next();
  });
};

function AppendSerializer(options) {
  this.path = options.cacheDirPath;
  this.autoParse = options.autoParse;
  this.blockSize = options.blockSize || _blockSize;
  this.logSize = options.logSize || _logSize;
  this.compactSizeThreshold = options.compactSizeThreshold || _minCompactSize;
  this.compactMultiplierThreshold = options.compactMultiplierThreshold || _compactMultiplierThreshold;

  this.lock = Promise.resolve();
  this._fd = null;
}

AppendSerializer.prototype.read = function(mustLock) {
  var start = Date.now();
  var _this = this;

  function _read() {
    var activeTable;
    return Promise.resolve()
    .then(_retry(function() {
      return _readTable(_this);
    }))
    .then(function(_table) {
      activeTable = _table;
    })
    .then(function() {
      var map = new Map();

      var indexToValue = [];
      values(activeTable.map).forEach(function(value) {
        for (var i = value.start; i < value.start + value.blocks; i++) {
          indexToValue[i] = value;
        }
      });

      return new Promise(function(resolve, reject) {
        var blockIndex = 0;
        var destBuffer = new Buffer(2 * 1024 * 1024);
        var offset = 0;
        var log = _readLog(_this, activeTable);
        log.on('data', function(data) {
          for (var bufferIndex = 0; bufferIndex < data.length;) {
            var value = indexToValue[blockIndex];
            if (value) {
              if (value.size > destBuffer.length) {
                var newLength = Math.pow(2, Math.ceil(Math.log(value.size) / Math.log(2)));
                destBuffer = new Buffer(newLength);
              }

              var sizeLeft = value.size - (blockIndex - value.start) * activeTable.blockSize;
              var readAmount = Math.min(
                Math.ceil(sizeLeft / activeTable.blockSize) * activeTable.blockSize,
                data.length - bufferIndex
              );
              data.slice(bufferIndex, bufferIndex + readAmount)
              .copy(destBuffer.slice(offset, offset + readAmount));
              bufferIndex += readAmount;
              blockIndex += readAmount / activeTable.blockSize;
              offset += readAmount;

              if (offset >= value.size) {
                offset = 0;
                if (_this.autoParse) {
                  map.set(value.key, JSON.parse(
                    destBuffer.utf8Slice(0, value.size)
                  ));
                }
                else {
                  map.set(value.key, destBuffer.utf8Slice(0, value.size));
                }
              }
            }
            else {
              blockIndex += 1;
              bufferIndex += activeTable.blockSize;
            }
          }
        });
        log.on('end', resolve);
        log.on('error', reject);
      })
      .then(function() {
        return objFrom(map);
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
  if (ops.length === 0) {
    return Promise.resolve();
  }

  var steps = 0;
  var _this = this;

  var activeTable;
  var contentBuffer;
  var contentLength;
  function _write() {
    return Promise.resolve()
    .then(_retry(function() {
      return mkdirp(_this.path);
    }))
    .then(_retry(function() {
      return _readTable(_this);
    }))
    .then(function(_table) {
      activeTable = modTable(_table);
      var _ops = ops.slice();
      function step(op, next) {
        // steps++;
        // var op = _ops.shift();
        // if (!op) {
        //   return;
        // }

        var content = op.value;
        if (content !== null) {
          if (typeof content !== 'string') {
            content = JSON.stringify(content);
          }

          if (Buffer.byteLength && contentBuffer && Buffer.byteLength(content) <= contentBuffer.length) {
            contentLength = contentBuffer.utf8Write(content);
          }
          else {
            contentBuffer = new Buffer(content);
            contentLength = contentBuffer.length;
          }

          var blockCount = Math.ceil(contentLength / activeTable.blockSize);
          var nextIndex = activeTable.nextIndex;
          activeTable = putKey(activeTable, op.key, contentLength);
          var bufferIndex = 0;

          var bulk = Array.from(new Array(blockCount))
          .map(function(_, i) {return i * activeTable.blockSize;});
          return serialFsTask(bulk, function(bufferIndex, next) {
            var blockSlice = contentBuffer.slice(bufferIndex, bufferIndex + activeTable.blockSize);
            _appendBlock(_this, activeTable, blockSlice, nextIndex++, next);
          })
          .then(next);

          // function append() {
          //   if (bufferIndex < contentBuffer.length) {
          //     var blockSlice = contentBuffer.slice(bufferIndex, bufferIndex + activeTable.blockSize);
          //     bufferIndex += activeTable.blockSize;
          //     return _appendBlock(_this, activeTable, blockSlice, nextIndex++)
          //     .then(append);
          //   }
          // }
          // return append()
          // .then(step);
        }
        else {
          activeTable = delKey(activeTable, op.key);
          next();
        }
      }

      return serialFsTask(_ops, step);

      // return step();
    })
    .then(function() {
      return _closeLog(_this);
    })
    .then(_retry(function() {
      activeTable = table(activeTable);
      return _writeTable(_this, activeTable);
    }));
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
    return rimraf(_this.path + '~')
    .then(timeout100)
    .then(function() {return ops;});
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
      .then(timeout100)
      .then(function() {
        return rename(copy.path, _this.path);
      });
    });
  });
};
