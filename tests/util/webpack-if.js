exports.webpack1 = function(obj, elseObj) {
  if (require('webpack/package.json').version[0] === '1') {
    return obj;
  }
  else {
    return elseObj;
  }
};

exports.webpack2 = function(obj, elseObj) {
  if (require('webpack/package.json').version[0] !== '1') {
    return obj;
  }
  else {
    return elseObj;
  }
};

exports.removeEmptyValues = function(obj) {
  var _obj = {};
  for (var key in obj) {
    if (obj[key]) {
      _obj[key] = obj[key];
    }
  }
  return _obj;
};
