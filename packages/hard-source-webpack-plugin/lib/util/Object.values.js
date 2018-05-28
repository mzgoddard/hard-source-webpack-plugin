module.exports = function Object_values(obj) {
  return Object.keys(obj).map(key => obj[key]);
};
