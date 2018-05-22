var fs = require('fs');
var path = require('path');

module.exports = function(source) {
  this.cacheable && this.cacheable();
  this.addContextDependency(path.join(__dirname, 'dir'));
  var items = fs.readdirSync(path.join(__dirname, 'dir'));
  items.sort();
  var subdir = items[items.length - 1];
  var subitems = fs.readdirSync(path.join(__dirname, 'dir', subdir));
  subitems.sort();
  var name = subitems[subitems.length - 1];
  return [
    '// ' + subdir + '/' + name,
    source
  ].join('\n');
};
