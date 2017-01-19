// - scan dirs
//   - stat items
//   - hash files
//   - stat dir items under
//     - hash files
// - hash files

import crypto from 'crypto';

import fs from 'fs';
import path from 'path';
import Promise from 'bluebird';

var readFile = Promise.promisify(fs.readFile);
var readdir = Promise.promisify(fs.readdir);
var stat = Promise.promisify(fs.stat);

function hashFile(file) {
  return readFile(file)
  .then(src => [file, crypto.createHash('md5').update(src).digest('hex')])
  .catch(() => {});
}

function hashObject(obj) {
  var hash = crypto.createHash('md5');
  obj.forEach(item => {
    hash.update(item[0]);
    hash.update(item[1]);
  });
  return hash.digest('hex');
}

function hashFiles(root, files) {
  return Promise.all(files.map(file => hashFile(path.join(root, file))))
  .then(hashes => hashes.filter(Boolean));
}

function flatten(items) {
  return (items || []).reduce((carry, item) => item ? carry.concat(item) : carry, []);
}

export default options => {
  options = options || {};
  var root = options.root || process.cwd();
  var files = options.files || ['package.json'];
  var directories = options.directories || ['node_modules'];

  return Promise.all([
    hashFiles(root, files),
    Promise.all(directories.map(dir => readdir(path.join(root, dir))
    .then(items => Promise.all(items.map(item => stat(path.join(root, dir, item))
    .then(stat => {
      if (stat.isDirectory()) {
        return hashFiles(path.join(root, dir, item), files);
      }
      if (stat.isFile()) {
        return hashFile(path.join(root, dir, item))
        .then(hash => hash ? [hash] : hash);
      }
    })
    .catch(function(...args) {console.error(args)})))
    .then(hashes => hashes.filter(Boolean)))
    .catch(() => {})
    .then(flatten)))
    .then(flatten),
  ])
  .then(flatten)
  .then(items => {
    items.forEach(item => {
      item[0] = path.relative(root, item[0]);
    });
    // console.log(items);
    items.sort((a, b) => {
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
