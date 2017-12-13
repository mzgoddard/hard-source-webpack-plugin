// - scan dirs
//   - stat items
//   - hash files
//   - stat dir items under
//     - hash files
// - hash files

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var promisify = require('./util/promisify');

var readFile = promisify(fs.readFile);
var readdir = promisify(fs.readdir);
var stat = promisify(fs.stat);

function hashFile(file) {
  return readFile(file)
  .then(function(src) {
    return [file, crypto.createHash('md5').update(src).digest('hex')];
  })
  .catch(function() {});
}

function hashObject(obj) {
  var hash = crypto.createHash('md5');
  obj.forEach(function(item) {
    hash.update(item[0]);
    hash.update(item[1]);
  });
  return hash.digest('hex');
}

function hashFiles(root, files) {
  return Promise.all(files.map(function(file) {
    return hashFile(path.join(root, file));
  }))
  .then(function(hashes) {return hashes.filter(Boolean);});
}

function flatten(items) {
  return (items || []).reduce(function(carry, item) {
    return item ? carry.concat(item) : carry;
  }, []);
}

module.exports = function(options) {
  options = options || {};
  var root = options.root || process.cwd();
  var files = options.files;
  var directories = options.directories;

  var hashDefaults = Promise.resolve();
  if (!files && !directories) {
    hashDefaults = hashFiles(root, ['package-lock.json', 'yarn.lock']);
  }

  return hashDefaults
  .then(function(_defaults) {
    if (_defaults && _defaults.length > 0) {
      return [_defaults];
    }
    else {
      if (!files) {
        files = ['package.json'];
      }
      if (!directories) {
        directories = ['node_modules'];
      }
    }

    return Promise.all([
      hashFiles(root, files),
      Promise.all(directories.map(function(dir) {
        return readdir(path.join(root, dir))
        .then(function(items) {
          return Promise.all(items.map(function(item) {
            return stat(path.join(root, dir, item))
            .then(function(stat) {
              if (stat.isDirectory()) {
                return hashFiles(path.join(root, dir, item), files);
              }
              if (stat.isFile()) {
                return hashFile(path.join(root, dir, item))
                .then(function(hash) {return hash ? [hash] : hash;});
              }
            })
            .catch(function() {console.error(arguments)});
          }))
          .then(function(hashes) {return hashes.filter(Boolean);});
        })
        .catch(function() {})
        .then(flatten);
      }))
      .then(flatten),
    ]);
  })
  .then(flatten)
  .then(function(items) {
    items.forEach(function(item) {
      item[0] = path.relative(root, item[0]);
    });
    // console.log(items);
    items.sort(function(a, b) {
      if (a[0] < b[0]) {
        return -1;
      }
      else if (a[0] > b[0]) {
        return 1;
      }
      return 0;
    });
    return hashObject(items);
  });
};
