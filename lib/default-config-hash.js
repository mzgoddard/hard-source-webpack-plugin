const crypto = require('crypto');
const path = require('path');

const nodeObjectHash = require('node-object-hash');

const sort = nodeObjectHash({
  sort: false,
}).sort;

function relateContextToCacheDir(config) {
  const hardSourcePlugin = config.plugins.find(
    ({ constructor }) => constructor.name === 'HardSourceWebpackPlugin',
  );
  const cacheDir = hardSourcePlugin.getCachePath();
  const context = path.resolve(process.cwd(), config.context);
  const clone = Object.assign({}, config, {
    context: path.relative(cacheDir, context),
  });
  const sorted = sort(clone)
    .replace(new RegExp(`${context}[^,\\]}]*`, 'g'), match =>
      path.relative(cacheDir, match),
    )
    .replace(/\\/g, '/');
  return crypto
    .createHash('sha256')
    .update(sorted)
    .digest('hex');
}

module.exports = relateContextToCacheDir;
