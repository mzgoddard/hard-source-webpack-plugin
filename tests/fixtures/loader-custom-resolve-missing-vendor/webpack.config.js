var HardSourceWebpackPlugin = require('../../..');

var ifWebpack1 = function(obj) {
  if (require('webpack/package.json').version[0] === '1') {
    return obj;
  }
};

var ifWebpack2 = function(obj) {
  if (require('webpack/package.json').version[0] === '2') {
    return obj;
  }
};

var removeEmptyValues = function(obj) {
  var _obj = {};
  for (var key in obj) {
    if (obj[key]) {
      _obj[key] = obj[key];
    }
  }
  return _obj;
};

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/tmp',
    filename: 'main.js',
  },
  resolve: removeEmptyValues({
    modulesDirectories: ifWebpack1(['vendor', 'web_modules']),
    modules: ifWebpack2(['vendor', 'web_modules']),
  }),
  resolveLoader: removeEmptyValues({
    modulesDirectories: ifWebpack1(['vendor', 'web_modules']),
    modules: ifWebpack2(['vendor', 'web_modules']),
  }),
  recordsPath: __dirname + '/tmp/cache/records.json',
  plugins: [
    new HardSourceWebpackPlugin({
      cacheDirectory: 'cache',
      environmentPaths: {
        root: __dirname + '/../../..',
      },
    }),
  ],
};
