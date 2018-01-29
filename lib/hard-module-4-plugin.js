var NormalModule = require('webpack/lib/NormalModule');
var Module = require('webpack/lib/Module');

var {
  relateNormalPath,
  relateNormalRequest,
  relateNormalPathSet,
  relateNormalLoaders,
  relateNormalPathSet
} = require('./util/relate-context');
var HardModule = require('./hard-module-4');
var pluginCompat = require('./util/plugin-compat');
var serial = require('./util/serial');

function HardNormalModulePlugin() {}

HardNormalModulePlugin.prototype.apply = function(compiler) {
  var freeze, mapFreeze;

  var _methods;
  pluginCompat.tap(compiler, '_hardSourceMethods', 'HardNormalModulePlugin', function(methods) {
    _methods = methods;

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
      module.buildInfo && module.buildInfo.cacheable &&
      (
        module instanceof NormalModule && (
          frozen &&
          module.buildTimestamp > frozen.buildTimestamp ||
          !frozen
        )
      )
    ) {
      var compilation = extra.compilation;
      const compiler = compilation.compiler;

      // console.log(serial.NormalModule.freeze(null, module, {
      //   module: module,
      //   compilation: compilation,
      // }, _methods))
      return {
        type: 'NormalModule',

        moduleId: module.id,
        moduleType: module.type,
        context: relateNormalPath(compiler, module.context),
        request: relateNormalRequest(compiler, module.request),
        userRequest: relateNormalRequest(compiler, module.userRequest),
        rawRequest: relateNormalRequest(compiler, module.rawRequest),
        resource: relateNormalPath(compiler, module.resource),
        loaders: relateNormalLoaders(compiler, module.loaders),
        identifier: relateNormalRequest(compiler, module.identifier()),
        // libIdent: module.libIdent &&
        // module.libIdent({context: compiler.options.context}),

        _serial: serial.NormalModule.freeze(null, module, {
          module: module,
          compilation: compilation,
        }, _methods),

        generator: freeze('Generator', null, module.generator, {
          module: module,
          compilation: compilation,
        }),

        buildTimestamp: module.buildTimestamp,
        buildMeta: module.buildMeta,
        used: module.used,
        usedExports: module.usedExports,
        providedExports: module.providedExports,
        // HarmonyDetectionParserPlugin
        exportsArgument: module.exportsArgument,
        issuer:
          typeof module.issuer === 'string' ? relateNormalRequest(compiler, module.issuer) :
          module.issuer && typeof module.issuer === 'object' ? relateNormalRequest(compiler, module.issuer.identifier()) :
          null,

        _source: module._source ? freeze('Source', null, module._source, extra) : null,
        _cachedSource: freeze('Source', null, module._cachedSource, extra),
        _cachedSourceHash: module._cachedSourceHash,

        buildInfo: {
          fileDependencies: relateNormalPathSet(compiler, module.buildInfo.fileDependencies),
          contextDependencies: relateNormalPathSet(compiler, module.buildInfo.contextDependencies),
          assets: freeze('ModuleAssets', null, module.buildInfo.assets, {
            module: module,
            compilation: compilation,
          }),
          harmonyModule: module.buildInfo.harmonyModule,
          strict: module.buildInfo.strict,
          exportsArgument: module.buildInfo.exportsArgument,
        },

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
      };
    }
    else if (
      module.request &&
      module.buildInfo && module.buildInfo.cacheable &&
      module instanceof HardModule &&
      frozen &&
      module.getHashDigest(extra.compilation.dependencyTemplates) !== frozen._cachedSourceHash
    ) {
      var compilation = extra.compilation;

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
        _cachedSource: freeze('Source', null, module._cachedSource, extra),
        _cachedSourceHash: module._cachedSourceHash,
      });
    }

    return frozen;
  });

  pluginCompat.tap(compiler, '_hardSourceThawModule', 'HardNormalModulePlugin thaw', function(module, frozen, _extra) {
    if (frozen.type === 'NormalModule') {
      console.log(serial.NormalModule.thaw(null, frozen._serial, {
        compilation: _extra.compilation,
      }, _methods));
      return new HardModule(frozen, _extra.compilation, _extra.compilation.__hardSourceFileMd5s, _extra.compilation.__hardSourceCachedMd5s);
    }
    return module;
  });
};

module.exports = HardNormalModulePlugin;
