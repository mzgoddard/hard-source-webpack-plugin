const _ifElse = function(test, obj, elseObj) {
  if (test) {
    if (typeof obj === 'function') {
      return obj();
    }
    return obj;
  }
  else {
    if (typeof elseObj === 'function') {
      return elseObj();
    }
    return elseObj;
  }
};

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

exports.webpackGte4 = function(obj, elseObj) {
  return _ifElse(Number(require('webpack/package.json').version[0]) >= 4, obj, elseObj);
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
