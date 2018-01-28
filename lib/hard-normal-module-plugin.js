var NormalModule = require('webpack/lib/NormalModule');
var Module = require('webpack/lib/Module');

var relateContext = require('./util/relate-context');
var HardModule = require('./hard-module');
var pluginCompat = require('./util/plugin-compat');

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
function freezeHashContentDigest(module, dependencyTemplates) {
  return NormalModule.prototype.getHashDigest.call(module, dependencyTemplates);
}

function HardNormalModulePlugin() {}

HardNormalModulePlugin.prototype.apply = function(compiler) {
  if (compiler.hooks) {
    var HardNormalModule4Plugin = require('./hard-module-4-plugin');
    new HardNormalModule4Plugin().apply(compiler);
    return;
  }

  var freeze, mapFreeze;

  pluginCompat.tap(compiler, '_hardSourceMethods', 'HardNormalModulePlugin', function(methods) {
    // store = methods.store;
    // fetch = methods.fetch;
    freeze = methods.freeze;
    // thaw = methods.thaw;
    mapFreeze = methods.mapFreeze;
    // mapThaw = methods.mapThaw;
  });

  pluginCompat.tap(compiler, '_hardSourceFreezeModule', 'HardNormalModulePlugin', function(frozen, module, extra) {
    // console.log(module.constructor.name, module.request.split('/').reverse()[0], module.buildInfo.cacheable, module instanceof HardModule, module instanceof NormalModule, module.buildTimestamp);
    if (
      module.request &&
      (module.cacheable || module.buildInfo && module.buildInfo.cacheable) &&
      (
        module instanceof NormalModule && (
          frozen &&
          module.buildTimestamp > frozen.buildTimestamp ||
          !frozen
        )
      )
    ) {
      // console.log(module.request.split('/')[0]);
      var compilation = extra.compilation;
      var source = module.source(
        compilation.dependencyTemplates,
        compilation.moduleTemplate.outputOptions,
        compilation.moduleTemplate.requestShortener
      );

      // console.log(freeze('DependencyBlock', null, module, {
      //     module: module,
      //     parent: module,
      //     compilation: compilation,
      //   }))

      return {
        type: 'NormalModule',

        moduleId: module.id,
        context: relateContext.relateNormalPath(compilation.compiler, module.context),
        request: relateContext.relateNormalRequest(compilation.compiler, module.request),
        userRequest: relateContext.relateNormalRequest(compilation.compiler, module.userRequest),
        rawRequest: relateContext.relateNormalRequest(compilation.compiler, module.rawRequest),
        resource: relateContext.relateNormalPath(compilation.compiler, module.resource),
        loaders: relateContext.relateNormalLoaders(compilation.compiler, module.loaders),
        identifier: relateContext.relateNormalRequest(compilation.compiler, module.identifier()),
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
          typeof module.issuer === 'string' ? relateContext.relateNormalRequest(compilation.compiler, module.issuer) :
          module.issuer && typeof module.issuer === 'object' ? relateContext.relateNormalRequest(compilation.compiler, module.issuer.identifier()) :
          null,

        _source: module._source ? freeze('Source', null, module._source, extra) : null,
        _cachedSource: {
          source: freeze('Source', null, source, extra),
          hash: module._cachedSource.hash,
        },
        // rawSource: module._source ? module._source.source() : null,
        // source: source.source(),

        // sourceMap: freeze('source-map', null, source, {
        //   module: module,
        //   compilation: compilation,
        // }),

        assets: freeze('ModuleAssets', null, module.assets, {
          module: module,
          compilation: compilation,
        }),

        dependencyBlock: freeze('DependencyBlock', null, module, {
          module: module,
          parent: module,
          compilation: compilation,
        }),
        errors: mapFreeze('ModuleError', null, module.errors, {
          module: module,
          compilation: compilation,
        }),
        warnings: mapFreeze('ModuleWarning', null, module.warnings, {
          module: module,
          compilation: compilation,
        }),

        fileDependencies: relateContext.relateNormalPathArray(compilation.compiler, module.fileDependencies),
        contextDependencies: relateContext.relateNormalPathArray(compilation.compiler, module.contextDependencies),
      };
    }
    else if (
      module.request &&
      module.cacheable &&
      module instanceof HardModule &&
      frozen &&
      module.getHashDigest(extra.compilation.dependencyTemplates) !== frozen._cachedSource.hash
    ) {
      var compilation = extra.compilation;
      var source = module.source(
        compilation.dependencyTemplates,
        compilation.moduleTemplate.outputOptions,
        compilation.moduleTemplate.requestShortener
      );

      // console.log('Freezing re-rendered module', source.source())
      // console.log(frozen.dependencyBlock);
      return Object.assign({}, frozen, {
        moduleId: module.id,
        used: module.used,
        usedExports: module.usedExports,
        providedExports: module.providedExports,
        // HarmonyDetectionParserPlugin
        exportsArgument: module.exportsArgument,

        _source: module._source ? freeze('Source', null, module._source, extra) : null,
        _cachedSource: {
          source: freeze('Source', null, module._cachedSource.source, extra),
          hash: module._cachedSource.hash,
        },
        // rawSource: module._source ? module._source.source() : null,
        // source: source.source(),

        // sourceMap: freeze('source-map', null, source, {
        //   module: module,
        //   compilation: compilation,
        // }),
      });
    }

    return frozen;
  });

  pluginCompat.tap(compiler, '_hardSourceThawModule', 'HardNormalModulePlugin thaw', function(module, frozen, _extra) {
    if (frozen.type === 'NormalModule') {
      return new HardModule(frozen, _extra.compilation, _extra.compilation.__hardSourceFileMd5s, _extra.compilation.__hardSourceCachedMd5s);
    }
    return module;
  });
};

module.exports = HardNormalModulePlugin;
