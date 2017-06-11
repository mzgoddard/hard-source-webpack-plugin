var HardSourceWebpackPlugin = require('../../..');

var ifWebpack1 = function(obj) {
  if (require('webpack/package.json').version[0] === '1') {
    return obj;
  }
};

var ifWebpack2 = function(obj) {
  if (require('webpack/package.json').version[0] !== '1') {
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
  recordsPath: __dirname + '/tmp/cache/records.json',
  resolve: removeEmptyValues({
    modulesDirectories: ifWebpack1(['node_modules', 'vendor', 'web_modules']),
    modules: ifWebpack2(['node_modules', 'vendor', 'web_modules']),
  }),
  plugins: [
    new HardSourceWebpackPlugin({
      cacheDirectory: 'cache',
      environmentHash: {
        root: __dirname + '/../../..',
      },
    }),
  ],
};
