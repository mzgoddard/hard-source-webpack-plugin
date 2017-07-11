var ContextModule = require('webpack/lib/ContextModule');

var HardContextModule = require('./hard-context-module');

function freezeHashContent(module) {
  var content = [];
  module.updateHash({
    update: function(str) {
      content.push(str);
    },
  });
  return content.join('');
}

function HardModuleContextPlugin() {}

HardModuleContextPlugin.prototype.apply = function(compiler) {
  var freeze;

  compiler.plugin('--hard-source-methods', function(methods) {
    // store = methods.store;
    // fetch = methods.fetch;
    freeze = methods.freeze;
    // thaw = methods.thaw;
    // mapFreeze = methods.mapFreeze;
    // mapThaw = methods.mapThaw;
  });

  compiler.plugin('--hard-source-freeze-module', function(frozen, module, extra) {
    if (
      module.context &&
      module.cacheable &&
      !(module instanceof HardContextModule) &&
      (module instanceof ContextModule) &&
      (
        frozen &&
        module.builtTime >= frozen.builtTime ||
        !frozen
      )
    ) {
      var compilation = extra.compilation;
      var source = module.source(
        compilation.dependencyTemplates,
        compilation.moduleTemplate.outputOptions,
        compilation.moduleTemplate.requestShortener
      );

      return {
        type: 'ContextModule',

        moduleId: module.id,
        context: module.context,
        recursive: module.recursive,
        regExp: module.regExp ? module.regExp.source : null,
        async: module.async,
        addons: module.addons,
        identifier: module.identifier(),
        builtTime: module.builtTime,

        used: module.used,
        usedExports: module.usedExports,

        source: source.source(),

        sourceMap: freeze('source-map', null, source, {
          module: module,
          compilation: compilation,
        }),

        hashContent: freezeHashContent(module),

        dependencyBlock: freeze('dependency-block', null, module, {
          module: module,
          parent: module,
          compilation: compilation,
        }),
      };
    }

    return frozen;
  });

  compiler.plugin('--hard-source-thaw-module', function(module, frozen, extra) {
    if (frozen.type === 'ContextModule') {
      return new HardContextModule(frozen);
    }
    return module;
  });
};

module.exports = HardModuleContextPlugin;
