module.exports = options => {
  const devtool = options.devtool;
  // options.devtool is turned into the options for SourceMapDevToolPlugin
  if(devtool && (devtool.includes("sourcemap") || devtool.includes("source-map"))) {
    const hidden = devtool.includes("hidden");
    const inline = devtool.includes("inline");
    const evalWrapped = devtool.includes("eval");
    const cheap = devtool.includes("cheap");
    const moduleMaps = devtool.includes("module");
    const noSources = devtool.includes("nosources");
    const legacy = devtool.includes("@");
    const modern = devtool.includes("#");
    const comment = legacy && modern ? "\n/*\n//@ sourceMappingURL=[url]\n//# sourceMappingURL=[url]\n*/" :
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
      noSources,
    };
  }

  // A SourceMapDevToolPlugin was manually set on the compiler's plugins
  if (options.plugins) {
    const plugins = options.plugins;
    for (let i = 0; i < plugins.length; i++) {
      const plugin = plugins[i];
      if (plugin.sourceMapFilename) {
        return plugin.options;
      }
    }
  }
};
