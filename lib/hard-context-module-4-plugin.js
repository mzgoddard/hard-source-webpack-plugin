var ContextModule = require('webpack/lib/ContextModule');

var HardContextModule = require('./hard-context-module-4');
var pluginCompat = require('./util/plugin-compat');
var relateContext = require('./util/relate-context');

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

  pluginCompat.tap(compiler, '_hardSourceMethods', 'HardModuleContextPlugin copy methods', function(methods) {
    // store = methods.store;
    // fetch = methods.fetch;
    freeze = methods.freeze;
    // thaw = methods.thaw;
    // mapFreeze = methods.mapFreeze;
    // mapThaw = methods.mapThaw;
  });

  pluginCompat.tap(compiler, '_hardSourceFreezeModule', 'HardModuleContextPlugin freeze', function(frozen, module, extra) {
    if (
      module.context &&
      // module.cacheable &&
      !(module instanceof HardContextModule) &&
      (module instanceof ContextModule) &&
      (
        frozen &&
        module.buildInfo.builtTime >= frozen.buildInfo.builtTime ||
        !frozen
      )
    ) {
      var compilation = extra.compilation;
      var compiler = compilation.compiler;

      return {
        type: 'ContextModule',

        moduleId: module.id,
        context: relateContext.relateNormalPath(compiler, module.context),
        options: Object.assign({}, module.options, {
          resolveDependencies: null,
          dependencies: null,
          regExp: module.options.regExp ? module.options.regExp.source : false,
          include: module.options.include ? module.options.include.source : false,
          exclude: module.options.exclude ? module.options.exclude.source : false,
          resource: relateContext.relateNormalPath(compiler, module.options.resource),
          request: relateContext.relateNormalRequest(compiler, module.options.request),
          addon: relateContext.relateNormalRequest(compilation.compiler, module.options.addon),
        }),
        buildMeta: module.buildMeta,
        buildInfo: {
          cacheable: true,
          builtTime: module.buildInfo.builtTime,
          contextDependencies: relateContext.relateNormalPathSet(compiler, module.buildInfo.contextDependencies)
        },

        identifier: relateContext.relateNormalRequest(compiler, module.identifier()),

        // used: module.used,
        // usedExports: module.usedExports,

        dependencyBlock: freeze('DependencyBlock', null, module, {
          module: module,
          parent: module,
          compilation: compilation,
        }),
      };
    }

    return frozen;
  });

  pluginCompat.tap(compiler, '_hardSourceThawModule', 'HardModuleContextPlugin thaw', function(module, frozen, extra) {
    if (frozen.type === 'ContextModule') {
      return new HardContextModule(frozen, extra.compilation);
    }
    return module;
  });
};

module.exports = HardModuleContextPlugin;
