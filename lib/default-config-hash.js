var crypto = require('crypto');
var path = require('path');

var nodeObjectHash = require('node-object-hash');

var sort = nodeObjectHash({
  sort: false,
}).sort;

function relateContextToCacheDir(config) {
  var hardSourcePlugin = config.plugins.find(function(plugin) {
    return plugin.constructor.name === 'HardSourceWebpackPlugin';
  });
  var cacheDir = hardSourcePlugin.getCachePath();
  var context = path.resolve(
    process.cwd(),
    config.context
  );
  var clone = Object.assign({}, config, {
    context: path.relative(cacheDir, context),
  });
  var sorted = sort(clone)
  .replace(new RegExp(context + '[^,\\]}]*', 'g'), function(match) {
    return path.relative(cacheDir, match);
  })
  .replace(/\\/g, '/');
  return crypto.createHash('sha256').update(sorted).digest('hex');
}

module.exports = relateContextToCacheDir;
