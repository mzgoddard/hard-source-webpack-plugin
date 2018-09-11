// - scan dirs
//   - stat items
//   - hash files
//   - stat dir items under
//     - hash files
// - hash files

const crypto = require('crypto');
const fs = require('graceful-fs');
const path = require('path');

const pkgDir = require('pkg-dir');

const promisify = require('./util/promisify');

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

function hashFile(file) {
  return readFile(file)
    .then(src => [
      file,
      crypto
        .createHash('md5')
        .update(src)
        .digest('hex'),
    ])
    .catch(() => {});
}

function hashObject(obj) {
  const hash = crypto.createHash('md5');
  obj.forEach(item => {
    hash.update(item[0]);
    hash.update(item[1]);
  });
  return hash.digest('hex');
}

function hashFiles(root, files) {
  return Promise.all(files.map(file => hashFile(path.join(root, file)))).then(
    hashes => hashes.filter(Boolean),
  );
}

function flatten(items) {
  return (items || []).reduce(
    (carry, item) => (item ? carry.concat(item) : carry),
    [],
  );
}

const inputs = async ({ files, directories, root = process.cwd() } = {}) => {
  let defaults;
  if (!files && !directories) {
    const lockFiles = (await Promise.all(
      ['package-lock.json', 'yarn.lock'].map(f =>
        stat(path.join(root, f)).then(() => f, () => null),
      ),
    )).filter(Boolean);
    if (lockFiles.length) {
      return lockFiles;
    }
  }
  if (!files) {
    files = ['package.json'];
  }
  if (!directories) {
    directories = ['node_modules'];
  }
  directories = directories.map(d => `${d}/*`);
  return flatten([files, directories]);
};

module.exports = options => {
  options = options || {};
  const root = options.root || pkgDir.sync(process.cwd());
  let files = options.files;
  let directories = options.directories;

  let hashDefaults = Promise.resolve();
  if (!files && !directories) {
    hashDefaults = hashFiles(root, ['package-lock.json', 'yarn.lock']);
  }

  return hashDefaults
    .then(_defaults => {
      if (_defaults && _defaults.length > 0) {
        return [_defaults];
      } else {
        if (!files) {
          files = ['package.json'];
        }
        if (!directories) {
          directories = ['node_modules'];
        }
      }

      return Promise.all([
        hashFiles(root, files),
        Promise.all(
          directories.map(dir =>
            readdir(path.join(root, dir))
              .then(items =>
                Promise.all(
                  items.map(item =>
                    stat(path.join(root, dir, item))
                      .then(stat => {
                        if (stat.isDirectory()) {
                          return hashFiles(path.join(root, dir, item), files);
                        }
                        if (stat.isFile()) {
                          return hashFile(path.join(root, dir, item)).then(
                            hash => (hash ? [hash] : hash),
                          );
                        }
                      })
                      .catch(function(...args) {
                        console.error(args);
                      }),
                  ),
                ).then(hashes => hashes.filter(Boolean)),
              )
              .catch(() => {})
              .then(flatten),
          ),
        ).then(flatten),
      ]);
    })
    .then(flatten)
    .then(items => {
      items.forEach(item => {
        item[0] = path.relative(root, item[0]);
      });
      // console.log(items);
      items.sort((a, b) => {
        if (a[0] < b[0]) {
          return -1;
        } else if (a[0] > b[0]) {
          return 1;
        }
        return 0;
      });
      return hashObject(items);
    });
};

module.exports.inputs = inputs;
