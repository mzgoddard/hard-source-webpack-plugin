module.exports = function Object_values(obj) {
  return Object.keys(obj)
  .map(function(key) {return [key, obj[key]];});
};
