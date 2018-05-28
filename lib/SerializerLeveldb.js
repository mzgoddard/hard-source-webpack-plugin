const _level = require('level');

const promisify = require('./util/promisify');

const level = promisify(_level);

class LevelDbSerializer {
  constructor({ cacheDirPath }) {
    this.path = cacheDirPath;
    this.leveldbLock = Promise.resolve();
  }

  read() {
    const start = Date.now();
    const moduleCache = {};
    return level(this.path)
      .then(
        db =>
          new Promise((resolve, reject) => {
            const dbClose = promisify(db.close, { context: db });
            db.createReadStream()
              .on('data', data => {
                const value = data.value;
                if (!moduleCache[data.key]) {
                  moduleCache[data.key] = value;
                }
              })
              .on('end', () => {
                dbClose().then(resolve, reject);
              });
          }),
      )
      .then(() => moduleCache);
  }

  write(moduleOps) {
    const ops = moduleOps;

    if (ops.length === 0) {
      return Promise.resolve();
    }

    for (let i = 0; i < ops.length; i++) {
      if (ops[i].value === null) {
        ops[i].type = 'delete';
      } else {
        if (typeof ops[i].value !== 'string') {
          ops[i].value = JSON.stringify(ops[i].value);
        }
        ops[i].type = 'put';
      }
    }

    const cachePath = this.path;

    return (this.leveldbLock = this.leveldbLock
      .then(() => level(cachePath))
      .then(db => promisify(db.batch, { context: db })(ops).then(() => db))
      .then(db => promisify(db.close, { context: db })()));
  }
}

module.exports = LevelDbSerializer;
