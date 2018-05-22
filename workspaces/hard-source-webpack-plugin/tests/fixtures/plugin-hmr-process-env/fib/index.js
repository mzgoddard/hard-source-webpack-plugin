module.exports = function(n) {
  if (process.env.NODE_ENV !== "production") {
    return n + (n > 0 ? n - 2 : 0);
  }
  else {
    return n + (n > 0 ? n - 1 : 0);
  }
};