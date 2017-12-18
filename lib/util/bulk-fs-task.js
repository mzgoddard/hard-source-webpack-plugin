module.exports = function bulkFsTask(array, each) {
  return new Promise(function(resolve, reject) {
    var ops = 0;
    var out = [];
    array.forEach(function(item, i) {
      out[i] = each(item, function(back, callback) {
        ops++;
        return function(err, value) {
          try {
            out[i] = back(err, value, out[i]);
          }
          catch (e) {
            return reject(e);
          }

          ops--;
          if (ops === 0) {
            resolve(out);
          }
        };
      });
    });
    if (ops === 0) {
      resolve(out);
    }
  });
};
