module.exports = function(options) {
  var devtool = options.devtool;
  if(devtool && (devtool.indexOf("sourcemap") >= 0 || devtool.indexOf("source-map") >= 0)) {
    var hidden = devtool.indexOf("hidden") >= 0;
    var inline = devtool.indexOf("inline") >= 0;
    var evalWrapped = devtool.indexOf("eval") >= 0;
    var cheap = devtool.indexOf("cheap") >= 0;
    var moduleMaps = devtool.indexOf("module") >= 0;
    var noSources = devtool.indexOf("nosources") >= 0;
    var legacy = devtool.indexOf("@") >= 0;
    var modern = devtool.indexOf("#") >= 0;
    var comment = legacy && modern ? "\n/*\n//@ sourceMappingURL=[url]\n//# sourceMappingURL=[url]\n*/" :
      legacy ? "\n/*\n//@ sourceMappingURL=[url]\n*/" :
      modern ? "\n//# sourceMappingURL=[url]" :
      null;
    return {
      filename: inline ? null : options.output.sourceMapFilename,
      moduleFilenameTemplate: options.output.devtoolModuleFilenameTemplate,
      fallbackModuleFilenameTemplate: options.output.devtoolFallbackModuleFilenameTemplate,
      append: hidden ? false : comment,
      module: moduleMaps ? true : cheap ? false : true,
      columns: cheap ? false : true,
      lineToLine: options.output.devtoolLineToLine,
      noSources: noSources,
    };
  }
};
