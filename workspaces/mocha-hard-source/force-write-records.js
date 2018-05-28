var fs = require('fs');
var path = require('path');

function ForceWriteRecords() {}

ForceWriteRecords.prototype.apply = function(compiler) {
  compiler.plugin('done', function() {
    fs.writeFileSync(
      path.resolve(compiler.options.context, compiler.recordsOutputPath),
      JSON.stringify(compiler.records, null, 2),
      'utf8'
    );
  });
};

module.exports = ForceWriteRecords;
