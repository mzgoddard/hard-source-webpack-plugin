module.exports = function promisify(f, o) {
  const ctx = (o && o.context) || null;
  return function promisify_wrap() {
    const args = Array.from(arguments);
    return new Promise(function promisify_resolver(resolve, reject) {
      args.push(function promisify_callback(err, value) {
        if (err) {
          return reject(err);
        }
        return resolve(value);
      });
      f.apply(ctx, args);
    });
  };
};
