const fs = require('fs');

const promisify = require('./util/promisify');

const fsReadFile = promisify(fs.readFile, { context: fs });
const fsWriteFile = promisify(fs.writeFile, { context: fs });

class JsonSerializer {
  constructor({ cacheDirPath }) {
    this.path = cacheDirPath;
    if (!/\.json$/.test(this.path)) {
      this.path += '.json';
    }
  }

  read() {
    const cacheDirPath = this.path;
    return fsReadFile(cacheDirPath, 'utf8')
      .catch(() => '{}')
      .then(JSON.parse);
  }

  write(moduleOps) {
    const cacheDirPath = this.path;
    return this.read()
      .then(cache => {
        for (let i = 0; i < moduleOps.length; i++) {
          const op = moduleOps[i];
          cache[op.key] = op.value;
        }
        return cache;
      })
      .then(JSON.stringify)
      .then(cache => fsWriteFile(cacheDirPath, cache));
  }
}

module.exports = JsonSerializer;
