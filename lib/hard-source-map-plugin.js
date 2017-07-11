var makeDevToolOptions = require('./devtool-options');

function HardSourceMapPlugin() {}

HardSourceMapPlugin.prototype.apply = function(compiler) {
  var devtoolOptions = makeDevToolOptions(compiler.options);

  compiler.plugin('--hard-source-freeze-source-map', function(frozen, source, extra) {
    return {
      map: devtoolOptions && source.map(devtoolOptions),
      // Some plugins (e.g. UglifyJs) set useSourceMap on a module. If that
      // option is set we should always store some source map info and
      // separating it from the normal devtool options may be necessary.
      baseMap: extra.module.useSourceMap && source.map(),
    };
  });
};

module.exports = HardSourceMapPlugin;
