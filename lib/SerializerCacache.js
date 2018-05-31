const cacache = require('cacache');

class CacacheSerializer {
  constructor({ cacheDirPath }) {
    this.path = cacheDirPath;
  }

  read() {
    const cache = {};
    const promises = [];
    return new Promise((resolve, reject) => {
      cacache.ls
        .stream(this.path)
        .on('data', ({ key }) => {
          promises.push(
            cacache.get(this.path, key).then(({ data }) => {
              cache[key] = JSON.parse(data);
            }),
          );
        })
        .on('error', reject)
        .on('end', () => {
          resolve();
        });
    })
      .then(() => Promise.all(promises))
      .then(() => cache);
  }

  write(ops) {
    return Promise.all(
      ops.map(op => {
        if (op.value) {
          return cacache.put(this.path, op.key, JSON.stringify(op.value));
        } else {
          return cacache.rm.entry(this.path, op.key);
        }
      }),
    );
  }
}

module.exports = CacacheSerializer;
