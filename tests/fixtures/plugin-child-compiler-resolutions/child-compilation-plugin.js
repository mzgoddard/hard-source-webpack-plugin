var SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');

var RuleSet;
try {
  RuleSet = require('webpack/lib/RuleSet');
}
catch(error) {}

module.exports = ChildCompilationPlugin;

function ChildCompilationPlugin(loaders) {
  this.loaders = loaders;
};

ChildCompilationPlugin.prototype.apply = function(compiler) {
  var loaders = this.loaders;
  compiler.plugin('make', function(compilation, cb) {
    var compilerName = 'child';
    var child = compilation.createChildCompiler(compilerName, {});
    child.apply(new SingleEntryPlugin(compiler.options.context, compiler.options.entry, 'child'));
    child.plugin('compilation', function(compilation, params) {
      if (RuleSet) {
        params.normalModuleFactory.rules = new RuleSet(loaders);
      }
      else {
        params.normalModuleFactory.loaders.list = loaders;
      }
    });
    // Create a nested compilation cache. Webpack plugins making child compilers
    // must do this to not collide with modules used by other child compilations
    // (or the top level one). As well hard-source uses this to build a
    // compilation identifier so it can cache modules and other data per
    // compilation.
    child.plugin('compilation', function (compilation) {
      if (compilation.cache) {
        if (!compilation.cache[compilerName]) {
          compilation.cache[compilerName] = {};
        }
        compilation.cache = compilation.cache[compilerName];
      }
    });
    child.runAsChild(cb);
  });
};
