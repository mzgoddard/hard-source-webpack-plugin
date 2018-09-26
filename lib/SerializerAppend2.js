const fs = require('graceful-fs');
const { join, resolve } = require('path');
const _mkdirp = require('mkdirp');
const parseJson = require('parse-json');
const _rimraf = require('rimraf');

const promisify = require('./util/promisify');

const close = promisify(fs.close);
const mkdirp = promisify(_mkdirp);
const open = promisify(fs.open);
const read = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const readfd = promisify(fs.read);
const rename = promisify(fs.rename);
const rimraf = promisify(_rimraf);
const write = promisify(fs.writeFile);

const nextPow2 = n => {
  const exponent = Math.log(n) / Math.log(2);
  const nextExponent = Math.floor(exponent) + 1;
  return Math.pow(2, nextExponent);
};

const resizePow2 = (buffer, n) => {
  const tmpBuffer = Buffer.allocUnsafe(nextPow2(n));
  buffer.copy(tmpBuffer.slice(0, buffer.length));
  return tmpBuffer;
};

const MAX_CHUNK = 2 * 1024 * 1024;
const TMP_CHUNK = 0.5 * 1024 * 1024;
const MAX_CHUNK_PLUS = 2.5 * 1024 * 1024;
const LARGE_CONTENT = 64 * 1024;

let tmpBuffer = Buffer.allocUnsafe(TMP_CHUNK);
let outBuffer = Buffer.allocUnsafe(MAX_CHUNK_PLUS);

const _buffers = [];

const alloc = size => {
  const buffer = _buffers.pop();
  if (buffer && buffer.length >= size) {
    return buffer;
  }
  return Buffer.allocUnsafe(size);
};
const drop = buffer => _buffers.push(buffer);

class WriteOutput {
  constructor(length = 0, table = [], buffer = alloc(MAX_CHUNK_PLUS)) {
    this.length = length;
    this.table = table;
    this.buffer = buffer;
  }

  static clone(other) {
    return new WriteOutput(other.length, other.table, other.buffer);
  }

  take() {
    const output = WriteOutput.clone(this);

    this.length = 0;
    this.table = [];
    this.buffer = alloc(MAX_CHUNK_PLUS);

    return output;
  }

  add(key, content) {
    if (content !== null) {
      // Write content to a temporary buffer
      let length = tmpBuffer.utf8Write(content);
      while (length === tmpBuffer.length) {
        tmpBuffer = Buffer.allocUnsafe(tmpBuffer.length * 2);
        length = tmpBuffer.utf8Write(content);
      }

      const start = this.length;
      const end = start + length;

      // Ensure output buffer is long enough to add the new content
      if (end > this.buffer.length) {
        this.buffer = resizePow2(this.buffer, end);
      }

      // Copy temporary buffer to the end of the current output buffer
      tmpBuffer.copy(this.buffer.slice(start, end));

      this.table.push({
        name: key,
        start,
        end,
      });
      this.length = end;
    } else {
      this.table.push({
        name: key,
        start: -1,
        end: -1,
      });
    }
  }
}

class Semaphore {
  constructor(max) {
    this.max = max;
    this.count = 0;
    this.next = [];
  }

  async guard() {
    if (this.count < this.max) {
      this.count++;
      return new SemaphoreGuard(this);
    } else {
      return new Promise(resolve => {
        this.next.push(resolve);
      }).then(() => new SemaphoreGuard(this));
    }
  }
}

class SemaphoreGuard {
  constructor(parent) {
    this.parent = parent;
  }

  done() {
    const next = this.parent.next.shift();
    if (next) {
      next();
    } else {
      this.parent.count--;
    }
  }
}

class Append2 {
  constructor({ cacheDirPath: path, autoParse }) {
    this.path = path;
    this.autoParse = autoParse;

    this.inBuffer = Buffer.alloc(0);
    this._buffers = [];
    this.outBuffer = Buffer.alloc(0);
  }

  async _readFile(file) {
    const fd = await open(file, 'r+');

    let body = alloc(MAX_CHUNK_PLUS);

    await readfd(fd, body, 0, 4, null);
    const fullLength = body.readUInt32LE(0);
    if (fullLength > body.length) {
      drop(body);
      body = alloc(nextPow2(fullLength));
    }
    await readfd(fd, body, 0, fullLength, null);

    close(fd);

    const tableLength = body.readUInt32LE(0);
    const tableBody = body.utf8Slice(4, 4 + tableLength);
    const table = parseJson(tableBody);
    const content = body.slice(4 + tableLength);

    return [table, content, body];
  }

  async read() {
    const out = {};
    const size = { used: 0, total: 0 };
    const table = {};
    const order = {};

    await mkdirp(this.path);

    const items = await readdir(this.path);
    const logs = items.filter(item => /^log\d+$/.test(item));
    logs.sort();
    const reverseLogs = logs.reverse();

    const sema = new Semaphore(8);

    return Promise.all(
      reverseLogs.map(async (_file, index) => {
        const file = join(this.path, _file);
        const guard = await sema.guard();

        const [table, content, body] = await this._readFile(file);

        const keys = Object.keys(table);
        if (keys.length > 0) {
          size.total += table[keys.length - 1].end;
        }

        for (const entry of table) {
          if (
            typeof order[entry.name] === 'undefined' ||
            order[entry.name] > index
          ) {
            if (typeof order[entry.name] !== 'undefined') {
              size.used -= table[entry.name];
            }

            table[entry.name] = entry.end - entry.start;
            size.used += entry.end - entry.start;

            order[entry.name] = index;

            // Negative start positions are not set on the output. They are
            // treated as if they were deleted in a prior write. A future
            // compact will remove all instances of any old entries.
            if (entry.start >= 0) {
              await new Promise(process.nextTick);
              const data = content.utf8Slice(entry.start, entry.end);
              if (this.autoParse) {
                out[entry.name] = parseJson(data);
              } else {
                out[entry.name] = data;
              }
            } else {
              delete out[entry.name];
            }
          }
        }

        drop(body);
        guard.done();
      }),
    )
      .then(async () => {
        if (size.used / size.total < 0.6) {
          await this.compact(out);
        }
      })
      .then(() => out);
  }

  async _markLog() {
    const count = (await readdir(this.path)).filter(item =>
      /log\d+$/.test(item),
    ).length;
    const marker = Math.random()
      .toString(16)
      .substring(2)
      .padStart(13, '0');
    const logName = `log${count.toString().padStart(4, '0')}`;
    const file = resolve(this.path, logName);
    await write(file, marker);
    const writtenMarker = await read(file, 'utf8');
    if (marker === writtenMarker) {
      return file;
    }
    return null;
  }

  async _write(file, output) {
    // 4 bytes - full length
    // 4 bytes - length of table
    // x bytes - table
    // y bytes - content

    // Write table into a temporary buffer at position 8
    const content = JSON.stringify(output.table);
    let length = tmpBuffer.utf8Write(content, 8);
    // Make the temporary buffer longer if the space used is the same as the
    // length
    while (8 + length === tmpBuffer.length) {
      tmpBuffer = Buffer.allocUnsafe(nextPow2(8 + length));
      // Write again to see if the length is more due to the last buffer being
      // too short.
      length = tmpBuffer.utf8Write(content, 8);
    }

    // Ensure the buffer is long enough to fit the table and content.
    const end = 8 + length + output.length;
    if (end > tmpBuffer.length) {
      tmpBuffer = resizePow2(tmpBuffer, end);
    }

    // Copy the output after the table.
    output.buffer.copy(tmpBuffer.slice(8 + length, end));

    // Full length after this uint.
    tmpBuffer.writeUInt32LE(end - 4, 0);
    // Length of table after this uint.
    tmpBuffer.writeUInt32LE(length, 4);

    if (end > output.buffer.length) {
      output.buffer = alloc(nextPow2(end));
    }
    tmpBuffer.copy(output.buffer.slice(0, end));

    await write(file, output.buffer.slice(0, end));
    drop(output.buffer);
  }

  async _markAndWrite(output) {
    const file = await this._markLog();
    if (file !== null) {
      await this._write(file, output.take());
    }
  }

  // Write out a log chunk once the file reaches the maximum chunk size.
  async _writeAtMax(output) {
    while (output.length >= MAX_CHUNK) {
      await this._markAndWrite(output);
    }
  }

  // Write out a log chunk if their is any entries in the table.
  async _writeAtAny(output) {
    while (output.table.length > 0) {
      await this._markAndWrite(output);
    }
  }

  async write(ops) {
    let smallOutput = new WriteOutput();
    let largeOutput = new WriteOutput();

    const outputPromises = [];

    await mkdirp(this.path);

    for (const op of ops) {
      if (op.value !== null) {
        let content = op.value;
        if (typeof content !== 'string') {
          content = JSON.stringify(content);
        }
        if (content.length < LARGE_CONTENT) {
          smallOutput.add(op.key, content);

          await this._writeAtMax(smallOutput);
        } else {
          largeOutput.add(op.key, content);

          await this._writeAtMax(largeOutput);
        }
      } else {
        smallOutput.add(op.key, null);

        await this._writeAtMax(smallOutput);
      }
    }

    await this._writeAtAny(smallOutput);
    await this._writeAtAny(largeOutput);

    await Promise.all(outputPromises);
  }

  async sizes() {
    const size = {
      used: 0,
      total: 0,
    };
    const table = {};
    const order = {};

    await mkdirp(this.path);

    const items = await readdir(this.path);
    const logs = items.filter(item => /^log\d+$/.test(item));
    logs.sort();
    const reverseLogs = logs.reverse();

    const sema = new Semaphore(8);

    return Promise.all(
      reverseLogs.map(async (_file, index) => {
        const file = join(this.path, _file);
        const guard = await sema.guard();

        const [table, content, body] = await this._readFile(file);

        size.total += content.length;

        for (const entry of table) {
          if (
            typeof order[entry.name] === 'undefined' ||
            order[entry.name] > index
          ) {
            if (typeof order[entry.name] !== 'undefined') {
              size.used -= table[entry.name];
            }
            table[entry.name] = entry.end - entry.start;
            size.used += entry.end - entry.start;

            order[entry.name] = index;
          }
        }

        drop(body);
        guard.done();
      }),
    ).then(() => size);
  }

  async compact(_obj = this.read()) {
    const obj = await _obj;
    const ops = [];
    for (const key in obj) {
      ops.push({
        key,
        value: obj[key],
      });
    }
    const truePath = this.path;
    this.path += '~';
    await this.write(ops);
    this.path = truePath;
    await rimraf(this.path);
    await rename(`${this.path}~`, this.path);
  }
}

module.exports = Append2;
