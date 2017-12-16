var NormalModule = require('webpack/lib/NormalModule');
var Module = require('webpack/lib/Module');

var HardModule = require('./hard-module');

function freezeHashContent(module) {
  var content = [];
  var hash = {
    update: function(str) {
      content.push(str);
    },
  };

  hash.update("meta");
  hash.update(JSON.stringify(module.meta));

  Module.prototype.updateHash.call(module, hash);

  return content.join('');
}

function HardNormalModulePlugin() {}

HardNormalModulePlugin.prototype.apply = function(compiler) {
  var freeze, mapFreeze;

  compiler.plugin('--hard-source-methods', function(methods) {
    // store = methods.store;
    // fetch = methods.fetch;
    freeze = methods.freeze;
    // thaw = methods.thaw;
    mapFreeze = methods.mapFreeze;
    // mapThaw = methods.mapThaw;
  });

  compiler.plugin('--hard-source-freeze-module', function(frozen, module, extra) {
    if (
      module.request &&
      module.cacheable &&
      !(module instanceof HardModule) &&
      (module instanceof NormalModule) &&
      (
        frozen &&
        module.buildTimestamp > frozen.buildTimestamp ||
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
        type: 'NormalModule',

        moduleId: module.id,
        context: module.context,
        request: module.request,
        userRequest: module.userRequest,
        rawRequest: module.rawRequest,
        resource: module.resource,
        loaders: module.loaders,
        identifier: module.identifier(),
        // libIdent: module.libIdent &&
        // module.libIdent({context: compiler.options.context}),

        buildTimestamp: module.buildTimestamp,
        strict: module.strict,
        meta: module.meta,
        used: module.used,
        usedExports: module.usedExports,
        providedExports: module.providedExports,
        // HarmonyDetectionParserPlugin
        exportsArgument: module.exportsArgument,
        issuer:
          typeof module.issuer === 'string' ? module.issuer :
          module.issuer && typeof module.issuer === 'object' ? module.issuer.identifier() :
          null,

        rawSource: module._source ? module._source.source() : null,
        source: source.source(),

        sourceMap: freeze('source-map', null, source, {
          module: module,
          compilation: compilation,
        }),

        assets: freeze('module-assets', null, module.assets, {
          module: module,
          compilation: compilation,
        }),

        hashContent: freezeHashContent(module),

        dependencyBlock: freeze('dependency-block', null, module, {
          module: module,
          parent: module,
          compilation: compilation,
        }),
        errors: mapFreeze('module-error', null, module.errors, {
          module: module,
          compilation: compilation,
        }),
        warnings: mapFreeze('module-warning', null, module.warnings, {
          module: module,
          compilation: compilation,
        }),

        fileDependencies: module.fileDependencies,
        contextDependencies: module.contextDependencies,
      };
    }

    return frozen;
  });

  compiler.plugin('--hard-source-thaw-module', function(module, frozen, _extra) {
    if (frozen.type === 'NormalModule') {
      return new HardModule(frozen, _extra.compilation.__hardSourceFileMd5s, _extra.compilation.__hardSourceCachedMd5s);
    }
    return module;
  });
};

module.exports = HardNormalModulePlugin;
