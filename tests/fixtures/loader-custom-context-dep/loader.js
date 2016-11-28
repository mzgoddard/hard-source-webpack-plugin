var fs = require('fs');
var path = require('path');

module.exports = function(source) {
  this.cacheable && this.cacheable();
  this.addContextDependency(path.join(__dirname, 'dir'));
  return [
    fs.readFileSync(path.join(__dirname, 'dir', 'file'), 'utf8'),
    source
  ].join('\n');
};
