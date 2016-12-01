var fs = require('fs');
var path = require('path');

module.exports = function(source) {
  this.cacheable && this.cacheable();
  this.addContextDependency(path.join(__dirname, 'dir'));
  var items = fs.readdirSync(path.join(__dirname, 'dir'));
  items.sort();
  return [
    '// ' + items[1],
    source
  ].join('\n');
};
