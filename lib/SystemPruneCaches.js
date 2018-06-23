const { readdir: _readdir, stat: _stat } = require('fs');
const { basename, join } = require('path');

const _rimraf = require('rimraf');

const logMessages = require('./util/log-messages');
const pluginCompat = require('./util/plugin-compat');
const promisify = require('./util/promisify');

const readdir = promisify(_readdir);
const rimraf = promisify(_rimraf);
const stat = promisify(_stat);

const directorySize = async dir => {
  const _stat = await stat(dir);
  if (_stat.isFile()) {
    return _stat.size;
  }

  if (_stat.isDirectory()) {
    const names = await readdir(dir);
    let size = 0;
    for (const name of names) {
      size += await directorySize(join(dir, name));
    }
    return size;
  }

  return 0;
};

class CacheInfo {
  constructor(id = '') {
    this.id = id;
    this.lastModified = 0;
    this.size = 0;
  }

  static async fromDirectory(dir) {
    const info = new CacheInfo(basename(dir));
    info.lastModified = new Date(
      (await stat(join(dir, 'stamp'))).mtime,
    ).getTime();
    info.size = await directorySize(dir);
    return info;
  }

  static async fromDirectoryChildren(dir) {
    const children = [];
    const names = await readdir(dir);
    for (const name of names) {
      children.push(await CacheInfo.fromDirectory(join(dir, name)));
    }
    return children;
  }
}

// Compilers for webpack with multiple parallel configurations might try to
// delete caches at the same time. Mutex lock the process of pruning to keep
// from multiple pruning runs from colliding with each other.
let deleteLock = null;

class PruneCachesSystem {
  constructor(cacheRoot, options = {}) {
    this.cacheRoot = cacheRoot;

    this.options = Object.assign(
      {
        // Caches younger than `maxAge` are not considered for deletion. They
        // must be at least this (default: 2 days) old in milliseconds.
        maxAge: 2 * 24 * 60 * 60 * 1000,
        // All caches together must be larger than `sizeThreshold` before any
        // caches will be deleted. Together they must be at least this
        // (default: 50 MB) big in bytes.
        sizeThreshold: 50 * 1024 * 1024,
      },
      options,
    );
  }

  apply(compiler) {
    const compilerHooks = pluginCompat.hooks(compiler);

    const deleteOldCaches = async () => {
      while (deleteLock !== null) {
        await deleteLock;
      }

      let resolveLock;

      let infos;
      try {
        deleteLock = new Promise(resolve => {
          resolveLock = resolve;
        });

        infos = await CacheInfo.fromDirectoryChildren(this.cacheRoot);

        // Sort lastModified in descending order. More recently modified at the
        // beginning of the array.
        infos.sort((a, b) => b.lastModified - a.lastModified);

        const totalSize = infos.reduce((carry, info) => carry + info.size, 0);
        const oldInfos = infos.filter(
          info => info.lastModified < Date.now() - this.options.maxAge,
        );
        const oldTotalSize = oldInfos.reduce(
          (carry, info) => carry + info.size,
          0,
        );

        if (oldInfos.length > 0 && totalSize > this.options.sizeThreshold) {
          const newInfos = infos.filter(
            info => info.lastModified >= Date.now() - this.options.maxAge,
          );

          for (const info of oldInfos) {
            rimraf(join(this.cacheRoot, info.id));
          }

          const newTotalSize = newInfos.reduce(
            (carry, info) => carry + info.size,
            0,
          );

          logMessages.deleteOldCaches(compiler, {
            infos,
            totalSize,
            newInfos,
            newTotalSize,
            oldInfos,
            oldTotalSize,
          });
        } else {
          logMessages.keepCaches(compiler, {
            infos,
            totalSize,
          });
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      } finally {
        if (typeof resolveLock === 'function') {
          deleteLock = null;
          resolveLock();
        }
      }
    };

    compilerHooks.watchRun.tapPromise(
      'HardSource - PruneCachesSystem',
      deleteOldCaches,
    );
    compilerHooks.run.tapPromise(
      'HardSource - PruneCachesSystem',
      deleteOldCaches,
    );
  }
}

module.exports = PruneCachesSystem;
