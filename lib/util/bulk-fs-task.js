// Perform a set of tasks in array quickly. Sometimes testing much better for
// large sets of work instead of individual promises.
const bulkFsTask = (array, each) =>
  new Promise((resolve, reject) => {
    let ops = 0;
    const out = [];
    array.forEach((item, i) => {
      out[i] = each(item, (back, callback) => {
        ops++;
        return (err, value) => {
          try {
            out[i] = back(err, value, out[i]);
          } catch (e) {
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

module.exports = bulkFsTask;
