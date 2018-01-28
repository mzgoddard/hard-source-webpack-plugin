const webpackVersion = require('webpack/package.json').version;

const isWebpackBeta = /alpha|beta|rc/.test(webpackVersion);

module.exports = {
  extractText: !isWebpackBeta,
  uglify: !isWebpackBeta,
  html: !isWebpackBeta,
};
