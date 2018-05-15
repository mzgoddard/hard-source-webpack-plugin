module.exports = function Object_values(obj) {
  return Object.keys(obj).map(key => [key, obj[key]]);
};
