const fs = require('graceful-fs');
const join = require('path').join;
const Readable = require('stream').Readable;

const _mkdirp = require('mkdirp');
const _rimraf = require('rimraf');
const writeJsonFile = require('write-json-file');

const entries = require('./util/Object.entries');
const values = require('./util/Object.values');
const promisify = require('./util/promisify');

const rimraf = promisify(_rimraf);
const open = promisify(fs.open);
const close = promisify(fs.close);
const read = promisify(fs.read);
const readFile = promisify(fs.readFile);
const write = promisify(fs.write);
const rename = promisify(fs.rename);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);
const mkdirp = promisify(_mkdirp);

const APPEND_VERSION = 1;

const _blockSize = 4 * 1024;
const _logSize = 2 * 1024 * 1024;
const _minCompactSize = 512 * 1024;
const _compactMultiplierThreshold = 1.5;

const value = (key, size, start) => ({
  key,
  size: size || 0,
  start: start || 0,
});

const objFrom = map => {
  if (map instanceof Map) {
    const obj = {};
    map.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
  return map;
};

const table = ({ nextByte, blockSize, logSize, map }) => ({
  version: APPEND_VERSION,
  nextByte: nextByte,
  blockSize: blockSize,
  logSize: logSize,
  map: objFrom(map),
});

const modTable = ({ nextByte, blockSize, logSize, map }) => ({
  version: APPEND_VERSION,
  nextByte: nextByte,
  blockSize: blockSize,
  logSize: logSize,
  map: new Map(entries(map)),
});

function putKey(_table, key, size) {
  // _table.map[key] = value(key, size, _table.nextByte, Math.ceil(size / _table.blockSize));
  _table.map.set(key, value(key, size, _table.nextByte));
  _table.nextByte = _table.nextByte + size;
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

const _tablepath = ({ path }) => join(path, 'table.json');

const _defaultTable = ({ blockSize, logSize }) =>
  table({
    nextByte: 0,
    blockSize: blockSize || _blockSize,
    logSize: logSize || _logSize,
    map: {},
  });

const timeout100 = () => new Promise(resolve => setTimeout(resolve, 100));

const _retry = (fn, n) => {
  n = n || 5;
  const _retryFn = value => {
    if (n) {
      n--;
      return fn(value).catch(_retryFn);
    }
    return fn(value);
  };
  return _retryFn;
};

const _readTable = _this =>
  readFile(_tablepath(_this), 'utf8')
    .catch(e => JSON.stringify(_defaultTable(_this)))
    .then(JSON.parse)
    .then(_table => {
      if (_table.version !== APPEND_VERSION) {
        return _defaultTable(_this);
      }
      return _table;
    });

const _writeTable = (_this, _table) => writeJsonFile(_tablepath(_this), _table);

const _logFilepath = ({ path }, { logSize }, index) => {
  let logId = ((index / logSize) | 0).toString();
  while (logId.length < 4) {
    logId = `0${logId}`;
  }
  return join(path, `log${logId}`);
};

const _openLog = (_this, mode, _table, index) => {
  if (_this._fd !== null) {
    return Promise.resolve();
  } else {
    // If mode is 'a', stat the log to write to, if it should be empty and
    // isn't, unlink before opening.
    return Promise.resolve()
      .then(() => {
        if (mode === 'a' && index % _table.logSize === 0) {
          return stat(_logFilepath(_this, _table, index))
            .then(({ size }) => {
              if (size > 0) {
                return unlink(_logFilepath(_this, _table, index)).then(
                  timeout100,
                );
              }
            })
            .catch(() => {});
        }
      })
      .then(() => open(_logFilepath(_this, _table, index), mode))
      .then(fd => {
        _this._fd = fd;
        if (mode === 'a') {
          _this._writeBuffer = new Buffer(_table.logSize);
          _this._writeOffset = 0;
        }
      })
      .catch(e => {
        throw e;
      });
  }
};

const _closeLog = _this => {
  if (_this._fd === null) {
    return Promise.resolve();
  } else {
    return Promise.resolve()
      .then(() => {
        if (_this._writeBuffer) {
          return write(_this._fd, _this._writeBuffer, 0, _this._writeOffset);
        }
      })
      .then(() => close(_this._fd))
      .then(() => {
        _this._fd = null;
        _this._writeBuffer = null;
        _this._writeOffset = 0;
      });
  }
};

const _readBufferSize = (_this, { blockSize, logSize }) =>
  Math.min(32 * blockSize, logSize);

const _readLog = (_this, _table) => {
  let index = 0;
  const out = new Readable({
    read() {},
  });

  const rbSize = _table.logSize;
  const _readBuffer = new Buffer(rbSize);

  function _log() {
    if (index >= _table.nextByte) {
      out.push(null);
      return _closeLog(_this);
    }

    const offset = 0;
    function step() {
      if (!_this._fd) {
        index = _table.nextByte;
        return _log();
      }

      return read(_this._fd, _readBuffer, 0, rbSize, 0).then(read => {
        index += _table.logSize;
        out.push(_readBuffer);
        return _log();
      });
    }

    return _closeLog(_this)
      .then(() => _openLog(_this, 'r', _table, index))
      .then(step);
  }
  Promise.resolve().then(_log);

  return out;
};

const _appendBlock = (_this, _table, blockContent, index, next) => {
  let prep;
  if (_this._fd !== null && index % _table.logSize === 0) {
    prep = _closeLog(_this).then(() => _openLog(_this, 'a', _table, index));
  } else if (_this._fd === null) {
    prep = _openLog(_this, 'a', _table, index);
  }
  function work() {
    if (!_this._fd) {
      return next(new Error());
    }
    if (blockContent.length > _table.logSize) {
      return next(new Error('block longer than max size'));
    }
    const writeSlice = _this._writeBuffer.slice(
      _this._writeOffset,
      _this._writeOffset + blockContent.length,
    );
    // if (blockContent.length < _table.blockSize) {
    //   writeSlice.fill(0);
    // }
    blockContent.copy(writeSlice);
    _this._writeOffset += blockContent.length;
    if (_this._writeOffset > _this._writeBuffer.length) {
      return next(
        new Error(
          `writeOffset ${_this._writeOffset} past writeBuffer length ${
            _this._writeBuffer.length
          }`,
        ),
      );
    }
    if (_this._writeOffset > _table.logSize) {
      return next(
        new Error(
          `writeOffset ${_this._writeOffset} past logSize ${_table.logSize}`,
        ),
      );
    }
    next();
    // return fs.write(_this._fd, blockContent, 0, _table.blockSize, next);
  }
  if (prep) {
    prep.then(work);
  } else {
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

const _sizeNeeded = (_this, { map }) =>
  values(map).reduce((carry, { size }) => carry + size, 0);

const _sizeUsed = (_this, { nextByte }) => nextByte;

const _compactSize = (_this, _table) =>
  Math.max(
    _this.compactSizeThreshold,
    _sizeNeeded(_this, _table) * _this.compactMultiplierThreshold,
  );

const _lock = (_this, mustLock, promiseFn) => {
  if (mustLock !== false) {
    return (_this.lock = promiseFn(_this.lock));
  }
  return promiseFn(Promise.resolve());
};

const serialFsTask = (array, each) =>
  new Promise((resolve, reject) => {
    let queue = 0;
    let index = 0;
    let inNext = false;
    function next(err) {
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
        try {
          each(array[index++], next);
        } catch (e) {
          return next(e);
        }
      }
      inNext = false;
    }
    next();
  });

class AppendSerializer {
  constructor(options) {
    this.path = options.cacheDirPath;
    this.autoParse = options.autoParse;
    this.blockSize = options.blockSize || _blockSize;
    this.logSize = options.logSize || _logSize;
    this.compactSizeThreshold = options.compactSizeThreshold || _minCompactSize;
    this.compactMultiplierThreshold =
      options.compactMultiplierThreshold || _compactMultiplierThreshold;

    this.lock = Promise.resolve();
    this._fd = null;
  }

  read(mustLock) {
    const start = Date.now();
    const _this = this;

    function _read() {
      let activeTable;
      return Promise.resolve()
        .then(_retry(() => _readTable(_this)))
        .then(_table => {
          activeTable = _table;
        })
        .then(() => {
          const map = new Map();

          const valueStarts = [];
          values(activeTable.map).forEach(value => {
            valueStarts.push({
              start: value.start,
              end: value.start + value.size,
              value,
            });
          });
          valueStarts.sort((a, b) => a.start - b.start);

          return new Promise((resolve, reject) => {
            let valueIndex = 0;
            let destBuffer = new Buffer(2 * 1024 * 1024);
            let offset = 0;
            let logOffset = 0;
            const log = _readLog(_this, activeTable);
            log.on('data', data => {
              if (valueIndex >= valueStarts.length) {
                return;
              }
              for (let bufferIndex = 0; bufferIndex < data.length; ) {
                if (bufferIndex + logOffset >= valueStarts[valueIndex].end) {
                  valueIndex++;
                }
                if (valueIndex >= valueStarts.length) {
                  return;
                }
                const value = valueStarts[valueIndex].value;
                if (bufferIndex + logOffset >= value.start) {
                  if (value.size > destBuffer.length) {
                    const newLength = Math.pow(
                      2,
                      Math.ceil(Math.log(value.size) / Math.log(2)),
                    );
                    destBuffer = new Buffer(newLength);
                  }

                  const readAmount = Math.min(
                    value.start + value.size - logOffset - bufferIndex,
                    activeTable.logSize - bufferIndex,
                  );
                  data
                    .slice(bufferIndex, bufferIndex + readAmount)
                    .copy(destBuffer.slice(offset, offset + readAmount));
                  bufferIndex += readAmount;
                  offset += readAmount;

                  if (offset >= value.size) {
                    offset = 0;
                    if (_this.autoParse) {
                      // console.log(value.size, destBuffer.utf8Slice(0, value.size))
                      map.set(
                        value.key,
                        JSON.parse(destBuffer.utf8Slice(0, value.size)),
                      );
                    } else {
                      map.set(value.key, destBuffer.utf8Slice(0, value.size));
                    }
                  }
                } else if (bufferIndex + logOffset < value.start) {
                  bufferIndex += value.start - (bufferIndex + logOffset);
                }
              }
              logOffset += activeTable.logSize;
            });
            log.on('end', resolve);
            log.on('error', reject);
          }).then(() => objFrom(map));
        });
    }

    return _lock(_this, mustLock, promise =>
      promise
        .then(() => _read())
        .catch(e =>
          _closeLog(_this).then(() => {
            throw e;
          }),
        ),
    );
  }

  write(ops, mustLock) {
    if (ops.length === 0) {
      return Promise.resolve();
    }

    const steps = 0;
    const _this = this;

    let activeTable;
    let contentBuffer;
    let contentLength;
    function _write() {
      return Promise.resolve()
        .then(_retry(() => mkdirp(_this.path)))
        .then(_retry(() => _readTable(_this)))
        .then(_table => {
          activeTable = modTable(_table);
          const _ops = ops.slice();
          function step(op, next) {
            // steps++;
            // var op = _ops.shift();
            // if (!op) {
            //   return;
            // }

            let content = op.value;
            if (content !== null) {
              if (typeof content !== 'string') {
                content = JSON.stringify(content);
              }

              if (
                Buffer.byteLength &&
                contentBuffer &&
                Buffer.byteLength(content) <= contentBuffer.length
              ) {
                contentLength = contentBuffer.utf8Write(content);
              } else {
                contentBuffer = new Buffer(content);
                contentLength = contentBuffer.length;
              }

              const blockCount = Math.ceil(
                ((activeTable.nextByte % activeTable.logSize) + contentLength) /
                  activeTable.logSize,
              );
              let nextByte = activeTable.nextByte;
              activeTable = putKey(activeTable, op.key, contentLength);
              let bufferIndex = 0;

              const bulk = Array.from(new Array(blockCount)).map((_, i) => i);
              return serialFsTask(bulk, (_, next) => {
                const blockSlice = contentBuffer.slice(
                  bufferIndex,
                  Math.min(
                    bufferIndex +
                      (activeTable.logSize - (nextByte % activeTable.logSize)),
                    contentLength,
                  ),
                );
                _appendBlock(_this, activeTable, blockSlice, nextByte, next);
                bufferIndex += blockSlice.length;
                nextByte += blockSlice.length;
              }).then(next);

              // function append() {
              //   if (bufferIndex < contentBuffer.length) {
              //     var blockSlice = contentBuffer.slice(bufferIndex, bufferIndex + activeTable.blockSize);
              //     bufferIndex += activeTable.blockSize;
              //     return _appendBlock(_this, activeTable, blockSlice, nextByte++)
              //     .then(append);
              //   }
              // }
              // return append()
              // .then(step);
            } else {
              activeTable = delKey(activeTable, op.key);
              next();
            }
          }

          return serialFsTask(_ops, step);

          // return step();
        })
        .then(() => _closeLog(_this))
        .then(
          _retry(() => {
            activeTable = table(activeTable);
            return _writeTable(_this, activeTable);
          }),
        );
    }

    return _lock(_this, mustLock, promise =>
      promise
        .then(() => _write())
        .catch(e =>
          _closeLog(_this).then(() => {
            throw e;
          }),
        )
        .then(() => {
          if (
            _sizeUsed(_this, activeTable) > _compactSize(_this, activeTable)
          ) {
            return _this.compact(false);
          }
        }),
    );
  }

  compact(mustLock) {
    const _this = this;

    return _this
      .read(mustLock)
      .then(map => {
        const ops = [];
        Object.keys(map).forEach(key => {
          ops.push({
            key,
            value: map[key],
          });
        });
        return ops;
      })
      .then(ops =>
        rimraf(`${_this.path}~`)
          .then(timeout100)
          .then(() => ops),
      )
      .then(ops => {
        const copy = new AppendSerializer({
          cacheDirPath: `${_this.path}~`,

          blockSize: _this.blockSize,
          logSize: _this.logSize,
          compactSizeThreshold: _this.compactSizeThreshold,
          compactMultiplierThreshold: _this.compactMultiplierThreshold,
        });

        return _lock(_this, mustLock, promise =>
          promise
            .then(() => copy.write(ops))
            .then(() => rimraf(_this.path))
            .then(timeout100)
            .then(_retry(() => rename(copy.path, _this.path), 10)),
        );
      });
  }
}

module.exports = AppendSerializer;
