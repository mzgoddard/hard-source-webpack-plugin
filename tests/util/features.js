const webpackVersion = require('webpack/package.json').version;

const isWebpackBeta = /alpha|beta|rc/.test(webpackVersion);
const webpackMajor = Number(webpackVersion.split('.')[0]);
const webpack3OrEarlier = webpackMajor < 4;
const webpack4OrLater = webpackMajor >= 4;

module.exports = {
  extractText: !isWebpackBeta && webpack3OrEarlier,
  miniCss: webpack4OrLater,
  uglify: !isWebpackBeta,
  html: !isWebpackBeta,
};
