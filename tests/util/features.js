const webpackVersion = require('webpack/package.json').version;

const isWebpackBeta = /alpha|beta|rc/.test(webpackVersion);
const webpack3OrEarlier = Number(webpackVersion.split('.')[0]) < 4;

module.exports = {
  extractText: !isWebpackBeta && webpack3OrEarlier,
  uglify: !isWebpackBeta,
  html: !isWebpackBeta && webpack3OrEarlier,
};
