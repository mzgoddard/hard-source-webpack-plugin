function HardModuleConcatenationPlugin() {}

HardModuleConcatenationPlugin.prototype.apply = function(compiler) {
  compiler.plugin('hard-source-need-additional-pass');
  compiler.plugin('hard-source-freeze-modules');
  compiler.plugin('hard-source-thaw-modules');
  compiler.plugin('hard-source-check-modules');
};

module.exports = HardModuleConcatenationPlugin;
