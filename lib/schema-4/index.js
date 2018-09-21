const serial = require('../util/serial');
const relateContext = require('../util/relate-context');

const LocalModule = require('webpack/lib/dependencies/LocalModule');

function flattenPrototype(obj) {
  if (typeof obj === 'string') {
    return obj;
  }
  const copy = {};
  for (const key in obj) {
    copy[key] = obj[key];
  }
  return copy;
}

const assignTruthful = {
  freeze(arg, dependency) {
    return arg;
  },
  thaw(arg, frozen) {
    return arg;
  },
};

const assignDefined = {
  freeze(arg, dependency) {
    if (typeof arg !== 'undefined') {
      return arg;
    }
  },
  thaw(arg, frozen) {
    if (typeof arg !== 'undefined') {
      return arg;
    }
  },
}

const optional = serial.assigned({
  prepend: assignTruthful,
  replaces: assignTruthful,
  critical: assignTruthful,
  namespaceObjectAsContext: assignDefined,
  callArgs: assignDefined,
  call: assignDefined,
  directImport: assignDefined,
  shorthand: assignDefined,
  optional: assignTruthful,
  loc: {
    freeze(arg, dependency) {
      return flattenPrototype(dependency.loc);
    },
    thaw(arg, frozen) {
      return arg;
    },
  },
});

const localModuleAssigned = {
  freeze(_, dependency) {
    if (
      typeof dependency.localModule === 'object' &&
      dependency.localModule !== null
    ) {
      return {
        name: dependency.localModule.name,
        idx: dependency.localModule.idx,
        used: dependency.localModule.used,
      };
    }
  },
  thaw(thawed, localModule, extra) {
    const state = extra.state;
    if (
      typeof localModule === 'object' &&
      localModule !== null
    ) {
      if (!state.localModules) {
        state.localModules = [];
      }
      if (!state.localModules[localModule.idx]) {
        state.localModules[localModule.idx] = new LocalModule(
          extra.module,
          localModule.name,
          localModule.idx,
        );
        state.localModules[localModule.idx].used =
          localModule.used;
      }
      thawed.localModule = state.localModules[localModule.idx];
    }
    return thawed;
  },
};

const warnings = {
  freeze(frozen, dependency) {
    if (frozen && dependency.getWarnings) {
      const warnings = dependency.getWarnings();
      if (warnings && warnings.length) {
        return warnings.map(
          ({ stack }) =>
            stack.includes('\n    at Object.freeze')
              ? stack.split('\n    at Object.freeze')[0]
              : stack.includes('\n    at pluginCompat.tap')
                ? stack.split('\n    at pluginCompat.tap')[0]
                : stack.split('\n    at Compiler.pluginCompat.tap')[0],
        );
      }
    }
  },
  thaw(dependency, warnings) {
    if (dependency && warnings && dependency.getWarnings) {
      const frozenWarnings = warnings;
      const _getWarnings = dependency.getWarnings;
      dependency.getWarnings = function() {
        const warnings = _getWarnings.call(this);
        if (warnings && warnings.length) {
          return warnings.map((warning, i) => {
            const stack = warning.stack.split(
              '\n    at Compilation.reportDependencyErrorsAndWarnings',
            )[1];
            warning.stack = `${
              frozenWarnings[i]
            }\n    at Compilation.reportDependencyErrorsAndWarnings${stack}`;
            return warning;
          });
        }
        return warnings;
      };
    }
    return dependency;
  },
};
const AMDDefineDependency = require('webpack/lib/dependencies/AMDDefineDependency');
const AMDDefineDependencySerial = serial.serial('AMDDefineDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        range: dependency.range,
        arrayRange: dependency.arrayRange,
        functionRange: dependency.functionRange,
        objectRange: dependency.objectRange,
        namedModule: dependency.namedModule,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new AMDDefineDependency(
        frozen.range,
        frozen.arrayRange,
        frozen.functionRange,
        frozen.objectRange,
        frozen.namedModule,
      );
    },
  },

  optional,

  localModuleAssigned,

  warnings,
});

const AMDRequireArrayDependency = require('webpack/lib/dependencies/AMDRequireArrayDependency');
const AMDRequireArrayDependencySerial = serial.serial('AMDRequireArrayDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        depsArray: methods.mapFreeze('Dependency', null, dependency.depsArray, extra),
        range: dependency.range,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new AMDRequireArrayDependency(
        methods.mapThaw('Dependency', null, frozen.depsArray, extra),
        frozen.range,
      );
    },
  },

  optional,

  warnings,
});

const AMDRequireContextDependency = require('webpack/lib/dependencies/AMDRequireContextDependency');
const AMDRequireContextDependencySerial = serial.serial('AMDRequireContextDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        options: dependency.options.regExp ?
          Object.assign({}, dependency.options, {
            regExp: dependency.options.regExp.source,
          }) :
          dependency.options,
        range: dependency.range,
        valueRange: dependency.valueRange,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new AMDRequireContextDependency(
        frozen.options.regExp ?
          Object.assign({}, frozen.options, {
            regExp: new RegExp(frozen.options.regExp),
          }) :
          frozen.options,
        frozen.range,
        frozen.valueRange,
      );
    },
  },

  optional,

  warnings,
});

const AMDRequireDependency = require('webpack/lib/dependencies/AMDRequireDependency');
const AMDRequireDependencySerial = serial.serial('AMDRequireDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        block: !dependency.block.dependencies.includes(dependency) ?
          methods.freeze('DependencyBlock', null, dependency.block, extra) :
          undefined,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new AMDRequireDependency(
        !frozen.block ? extra.parent : methods.thaw('DependencyBlock', null, frozen.block, extra),
      );
    },
  },

  optional,

  warnings,
});

const AMDRequireItemDependency = require('webpack/lib/dependencies/AMDRequireItemDependency');
const AMDRequireItemDependencySerial = serial.serial('AMDRequireItemDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
        range: dependency.range,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new AMDRequireItemDependency(
        frozen.request,
        frozen.range,
      );
    },
  },

  optional,

  warnings,
});

const CommonJsRequireContextDependency = require('webpack/lib/dependencies/CommonJsRequireContextDependency');
const CommonJsRequireContextDependencySerial = serial.serial('CommonJsRequireContextDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        options: dependency.options.regExp ?
          Object.assign({}, dependency.options, {
            regExp: dependency.options.regExp.source,
          }) :
          dependency.options,
        range: dependency.range,
        valueRange: dependency.valueRange,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new CommonJsRequireContextDependency(
        frozen.options.regExp ?
          Object.assign({}, frozen.options, {
            regExp: new RegExp(frozen.options.regExp),
          }) :
          frozen.options,
        frozen.range,
        frozen.valueRange,
      );
    },
  },

  optional,

  warnings,
});

const CommonJsRequireDependency = require('webpack/lib/dependencies/CommonJsRequireDependency');
const CommonJsRequireDependencySerial = serial.serial('CommonJsRequireDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
        range: dependency.range,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new CommonJsRequireDependency(
        frozen.request,
        frozen.range,
      );
    },
  },

  optional,

  warnings,
});

const ConstDependency = require('webpack/lib/dependencies/ConstDependency');
const ConstDependencySerial = serial.serial('ConstDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        expression: dependency.expression,
        range: dependency.range,
        requireWebpackRequire: dependency.requireWebpackRequire,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new ConstDependency(
        frozen.expression,
        frozen.range,
        frozen.requireWebpackRequire,
      );
    },
  },

  optional,

  warnings,
});

const ContextDependency = require('webpack/lib/dependencies/ContextDependency');
const ContextDependencySerial = serial.serial('ContextDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        options: dependency.options.regExp ?
          Object.assign({}, dependency.options, {
            regExp: dependency.options.regExp.source,
          }) :
          dependency.options,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new ContextDependency(
        frozen.options.regExp ?
          Object.assign({}, frozen.options, {
            regExp: new RegExp(frozen.options.regExp),
          }) :
          frozen.options,
      );
    },
  },

  optional,

  warnings,
});

const ContextElementDependency = require('webpack/lib/dependencies/ContextElementDependency');
const ContextElementDependencySerial = serial.serial('ContextElementDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
        userRequest: relateContext.relateAbsoluteRequest(extra.module.context, dependency.userRequest),
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new ContextElementDependency(
        frozen.request,
        frozen.userRequest,
      );
    },
  },

  optional,

  warnings,
});

const CriticalDependencyWarning = require('webpack/lib/dependencies/CriticalDependencyWarning');
const CriticalDependencyWarningSerial = serial.serial('CriticalDependencyWarning', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        message: dependency.message,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new CriticalDependencyWarning(
        frozen.message,
      );
    },
  },

  optional,

  warnings,
});

const DelegatedExportsDependency = require('webpack/lib/dependencies/DelegatedExportsDependency');
const DelegatedExportsDependencySerial = serial.serial('DelegatedExportsDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        originModule: null,
        exports: dependency.exports,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new DelegatedExportsDependency(
        extra.module,
        frozen.exports,
      );
    },
  },

  optional,

  warnings,
});

const DelegatedSourceDependency = require('webpack/lib/dependencies/DelegatedSourceDependency');
const DelegatedSourceDependencySerial = serial.serial('DelegatedSourceDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new DelegatedSourceDependency(
        frozen.request,
      );
    },
  },

  optional,

  warnings,
});

const DllEntryDependency = require('webpack/lib/dependencies/DllEntryDependency');
const DllEntryDependencySerial = serial.serial('DllEntryDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        dependencies: methods.mapFreeze('Dependency', null, dependency.dependencies, extra),
        name: dependency.name,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new DllEntryDependency(
        methods.mapThaw('Dependency', null, frozen.dependencies, extra),
        frozen.name,
      );
    },
  },

  optional,

  warnings,
});

const HarmonyAcceptDependency = require('webpack/lib/dependencies/HarmonyAcceptDependency');
const HarmonyAcceptDependencySerial = serial.serial('HarmonyAcceptDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        range: dependency.range,
        dependencies: methods.mapFreeze('Dependency', null, dependency.dependencies, extra),
        hasCallback: dependency.hasCallback,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new HarmonyAcceptDependency(
        frozen.range,
        methods.mapThaw('Dependency', null, frozen.dependencies, extra),
        frozen.hasCallback,
      );
    },
  },

  optional,

  warnings,
});

const HarmonyAcceptImportDependency = require('webpack/lib/dependencies/HarmonyAcceptImportDependency');
const HarmonyAcceptImportDependencySerial = serial.serial('HarmonyAcceptImportDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
        originModule: null,
        parserScope: null,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      extra.state.harmonyParserScope = extra.state.harmonyParserScope || {};
      return new HarmonyAcceptImportDependency(
        frozen.request,
        extra.module,
        extra.state.harmonyParserScope,
      );
    },
  },

  optional,

  warnings,
});

const HarmonyCompatibilityDependency = require('webpack/lib/dependencies/HarmonyCompatibilityDependency');
const HarmonyCompatibilityDependencySerial = serial.serial('HarmonyCompatibilityDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        originModule: null,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new HarmonyCompatibilityDependency(
        extra.module,
      );
    },
  },

  optional,

  warnings,
});

const HarmonyExportExpressionDependency = require('webpack/lib/dependencies/HarmonyExportExpressionDependency');
const HarmonyExportExpressionDependencySerial = serial.serial('HarmonyExportExpressionDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        originModule: null,
        range: dependency.range,
        rangeStatement: dependency.rangeStatement,
        prefix: dependency.prefix,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new HarmonyExportExpressionDependency(
        extra.module,
        frozen.range,
        frozen.rangeStatement,
        frozen.prefix,
      );
    },
  },

  optional,

  warnings,
});

const HarmonyExportHeaderDependency = require('webpack/lib/dependencies/HarmonyExportHeaderDependency');
const HarmonyExportHeaderDependencySerial = serial.serial('HarmonyExportHeaderDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        range: dependency.range,
        rangeStatement: dependency.rangeStatement,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new HarmonyExportHeaderDependency(
        frozen.range,
        frozen.rangeStatement,
      );
    },
  },

  optional,

  warnings,
});

const HarmonyExportImportedSpecifierDependency = require('webpack/lib/dependencies/HarmonyExportImportedSpecifierDependency');
const HarmonyExportImportedSpecifierDependencySerial = serial.serial('HarmonyExportImportedSpecifierDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
        originModule: null,
        sourceOrder: dependency.sourceOrder,
        parserScope: null,
        id: dependency.id,
        name: dependency.name,
        activeExports: null,
        otherStarExports: dependency.otherStarExports ? 'star' : null,
        strictExportPresence: dependency.strictExportPresence,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      extra.state.harmonyParserScope = extra.state.harmonyParserScope || {};
      extra.state.activeExports = extra.state.activeExports || new Set();
      if (frozen.name) {
        extra.state.activeExports.add(frozen.name);
      }
      return new HarmonyExportImportedSpecifierDependency(
        frozen.request,
        extra.module,
        frozen.sourceOrder,
        extra.state.harmonyParserScope,
        frozen.id,
        frozen.name,
        extra.state.activeExports,
        frozen.otherStarExports === 'star' ?
          (extra.state.otherStarExports || []) :
          null,
        frozen.strictExportPresence,
      );
    },
  },

  optional,

  warnings,

  exportImportedDependency: {
    freeze(frozen) {},
    thaw(thawed, frozen, extra) {
      if (thawed.otherStarExports) {
        extra.state.otherStarExports = (
          extra.state.otherStarExports || []
        ).concat(thawed);
      }
      return thawed;
    },
  },
});

const HarmonyExportSpecifierDependency = require('webpack/lib/dependencies/HarmonyExportSpecifierDependency');
const HarmonyExportSpecifierDependencySerial = serial.serial('HarmonyExportSpecifierDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        originModule: null,
        id: dependency.id,
        name: dependency.name,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new HarmonyExportSpecifierDependency(
        extra.module,
        frozen.id,
        frozen.name,
      );
    },
  },

  optional,

  warnings,
});

const HarmonyImportDependency = require('webpack/lib/dependencies/HarmonyImportDependency');
const HarmonyImportDependencySerial = serial.serial('HarmonyImportDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
        originModule: null,
        sourceOrder: dependency.sourceOrder,
        parserScope: null,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      extra.state.harmonyParserScope = extra.state.harmonyParserScope || {};
      return new HarmonyImportDependency(
        frozen.request,
        extra.module,
        frozen.sourceOrder,
        extra.state.harmonyParserScope,
      );
    },
  },

  optional,

  warnings,

  importDependency: {
    freeze(frozen) {
      return frozen;
    },
    thaw(thawed, frozen, extra) {
      const state = extra.state;
      const ref = frozen.range.toString();
      if (state.imports[ref]) {
        return state.imports[ref];
      }
      state.imports[ref] = thawed;
      return thawed;
    },
  },
});

const HarmonyImportSideEffectDependency = require('webpack/lib/dependencies/HarmonyImportSideEffectDependency');
const HarmonyImportSideEffectDependencySerial = serial.serial('HarmonyImportSideEffectDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
        originModule: null,
        sourceOrder: dependency.sourceOrder,
        parserScope: null,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      extra.state.harmonyParserScope = extra.state.harmonyParserScope || {};
      return new HarmonyImportSideEffectDependency(
        frozen.request,
        extra.module,
        frozen.sourceOrder,
        extra.state.harmonyParserScope,
      );
    },
  },

  optional,

  warnings,
});

const HarmonyImportSpecifierDependency = require('webpack/lib/dependencies/HarmonyImportSpecifierDependency');
const HarmonyImportSpecifierDependencySerial = serial.serial('HarmonyImportSpecifierDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
        originModule: null,
        sourceOrder: dependency.sourceOrder,
        parserScope: null,
        id: dependency.id,
        name: dependency.name,
        range: dependency.range,
        strictExportPresence: dependency.strictExportPresence,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      extra.state.harmonyParserScope = extra.state.harmonyParserScope || {};
      return new HarmonyImportSpecifierDependency(
        frozen.request,
        extra.module,
        frozen.sourceOrder,
        extra.state.harmonyParserScope,
        frozen.id,
        frozen.name,
        frozen.range,
        frozen.strictExportPresence,
      );
    },
  },

  optional,

  warnings,
});

const HarmonyInitDependency = require('webpack/lib/dependencies/HarmonyInitDependency');
const HarmonyInitDependencySerial = serial.serial('HarmonyInitDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        originModule: null,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new HarmonyInitDependency(
        extra.module,
      );
    },
  },

  optional,

  warnings,
});

const ImportContextDependency = require('webpack/lib/dependencies/ImportContextDependency');
const ImportContextDependencySerial = serial.serial('ImportContextDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        options: dependency.options.regExp ?
          Object.assign({}, dependency.options, {
            regExp: dependency.options.regExp.source,
          }) :
          dependency.options,
        range: dependency.range,
        valueRange: dependency.valueRange,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new ImportContextDependency(
        frozen.options.regExp ?
          Object.assign({}, frozen.options, {
            regExp: new RegExp(frozen.options.regExp),
          }) :
          frozen.options,
        frozen.range,
        frozen.valueRange,
      );
    },
  },

  optional,

  warnings,
});

const ImportDependency = require('webpack/lib/dependencies/ImportDependency');
const ImportDependencySerial = serial.serial('ImportDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
        originModule: null,
        block: !dependency.block.dependencies.includes(dependency) ?
          methods.freeze('DependencyBlock', null, dependency.block, extra) :
          undefined,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new ImportDependency(
        frozen.request,
        extra.module,
        !frozen.block ? extra.parent : methods.thaw('DependencyBlock', null, frozen.block, extra),
      );
    },
  },

  optional,

  warnings,
});

const ImportEagerDependency = require('webpack/lib/dependencies/ImportEagerDependency');
const ImportEagerDependencySerial = serial.serial('ImportEagerDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
        originModule: null,
        range: dependency.range,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new ImportEagerDependency(
        frozen.request,
        extra.module,
        frozen.range,
      );
    },
  },

  optional,

  warnings,
});

const ImportWeakDependency = require('webpack/lib/dependencies/ImportWeakDependency');
const ImportWeakDependencySerial = serial.serial('ImportWeakDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
        originModule: null,
        range: dependency.range,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new ImportWeakDependency(
        frozen.request,
        extra.module,
        frozen.range,
      );
    },
  },

  optional,

  warnings,
});

const JsonExportsDependency = require('webpack/lib/dependencies/JsonExportsDependency');
const JsonExportsDependencySerial = serial.serial('JsonExportsDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        exports: dependency.exports,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new JsonExportsDependency(
        frozen.exports,
      );
    },
  },

  optional,

  warnings,
});

const LoaderDependency = require('webpack/lib/dependencies/LoaderDependency');
const LoaderDependencySerial = serial.serial('LoaderDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new LoaderDependency(
        frozen.request,
      );
    },
  },

  optional,

  warnings,
});

const LocalModuleDependency = require('webpack/lib/dependencies/LocalModuleDependency');
const LocalModuleDependencySerial = serial.serial('LocalModuleDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        localModule: {
          name: dependency.localModule.name,
          name: dependency.localModule.idx,
        },
        range: dependency.range,
        callNew: dependency.callNew,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      if (!extra.state.localModules) {
        extra.state.localModules = [];
      }
      if (!extra.state.localModules[frozen.localModule.idx]) {
        extra.state.localModules[frozen.localModule.idx] = new LocalModule(extra.module, frozen.localModule.name, frozen.localModule.idx);
        extra.state.localModules[frozen.localModule.idx].used = frozen.localModule.used;
      }
      return new LocalModuleDependency(
        extra.state.localModules[frozen.localModule.idx],
        frozen.range,
        frozen.callNew,
      );
    },
  },

  optional,

  localModuleAssigned,

  warnings,
});

const ModuleDependency = require('webpack/lib/dependencies/ModuleDependency');
const ModuleDependencySerial = serial.serial('ModuleDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new ModuleDependency(
        frozen.request,
      );
    },
  },

  optional,

  warnings,
});

const ModuleHotAcceptDependency = require('webpack/lib/dependencies/ModuleHotAcceptDependency');
const ModuleHotAcceptDependencySerial = serial.serial('ModuleHotAcceptDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
        range: dependency.range,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new ModuleHotAcceptDependency(
        frozen.request,
        frozen.range,
      );
    },
  },

  optional,

  warnings,
});

const ModuleHotDeclineDependency = require('webpack/lib/dependencies/ModuleHotDeclineDependency');
const ModuleHotDeclineDependencySerial = serial.serial('ModuleHotDeclineDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
        range: dependency.range,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new ModuleHotDeclineDependency(
        frozen.request,
        frozen.range,
      );
    },
  },

  optional,

  warnings,
});

const MultiEntryDependency = require('webpack/lib/dependencies/MultiEntryDependency');
const MultiEntryDependencySerial = serial.serial('MultiEntryDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        dependencies: methods.mapFreeze('Dependency', null, dependency.dependencies, extra),
        name: dependency.name,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new MultiEntryDependency(
        methods.mapThaw('Dependency', null, frozen.dependencies, extra),
        frozen.name,
      );
    },
  },

  optional,

  warnings,
});

const NullDependency = require('webpack/lib/dependencies/NullDependency');
const NullDependencySerial = serial.serial('NullDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new NullDependency(
      );
    },
  },

  optional,

  warnings,
});

const PrefetchDependency = require('webpack/lib/dependencies/PrefetchDependency');
const PrefetchDependencySerial = serial.serial('PrefetchDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new PrefetchDependency(
        frozen.request,
      );
    },
  },

  optional,

  warnings,
});

const RequireContextDependency = require('webpack/lib/dependencies/RequireContextDependency');
const RequireContextDependencySerial = serial.serial('RequireContextDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        options: dependency.options.regExp ?
          Object.assign({}, dependency.options, {
            regExp: dependency.options.regExp.source,
          }) :
          dependency.options,
        range: dependency.range,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new RequireContextDependency(
        frozen.options.regExp ?
          Object.assign({}, frozen.options, {
            regExp: new RegExp(frozen.options.regExp),
          }) :
          frozen.options,
        frozen.range,
      );
    },
  },

  optional,

  warnings,
});

const RequireEnsureDependency = require('webpack/lib/dependencies/RequireEnsureDependency');
const RequireEnsureDependencySerial = serial.serial('RequireEnsureDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        block: !dependency.block.dependencies.includes(dependency) ?
          methods.freeze('DependencyBlock', null, dependency.block, extra) :
          undefined,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new RequireEnsureDependency(
        !frozen.block ? extra.parent : methods.thaw('DependencyBlock', null, frozen.block, extra),
      );
    },
  },

  optional,

  warnings,
});

const RequireEnsureItemDependency = require('webpack/lib/dependencies/RequireEnsureItemDependency');
const RequireEnsureItemDependencySerial = serial.serial('RequireEnsureItemDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new RequireEnsureItemDependency(
        frozen.request,
      );
    },
  },

  optional,

  warnings,
});

const RequireHeaderDependency = require('webpack/lib/dependencies/RequireHeaderDependency');
const RequireHeaderDependencySerial = serial.serial('RequireHeaderDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        range: dependency.range,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new RequireHeaderDependency(
        frozen.range,
      );
    },
  },

  optional,

  warnings,
});

const RequireIncludeDependency = require('webpack/lib/dependencies/RequireIncludeDependency');
const RequireIncludeDependencySerial = serial.serial('RequireIncludeDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
        range: dependency.range,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new RequireIncludeDependency(
        frozen.request,
        frozen.range,
      );
    },
  },

  optional,

  warnings,
});

const RequireResolveContextDependency = require('webpack/lib/dependencies/RequireResolveContextDependency');
const RequireResolveContextDependencySerial = serial.serial('RequireResolveContextDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        options: dependency.options.regExp ?
          Object.assign({}, dependency.options, {
            regExp: dependency.options.regExp.source,
          }) :
          dependency.options,
        range: dependency.range,
        valueRange: dependency.valueRange,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new RequireResolveContextDependency(
        frozen.options.regExp ?
          Object.assign({}, frozen.options, {
            regExp: new RegExp(frozen.options.regExp),
          }) :
          frozen.options,
        frozen.range,
        frozen.valueRange,
      );
    },
  },

  optional,

  warnings,
});

const RequireResolveDependency = require('webpack/lib/dependencies/RequireResolveDependency');
const RequireResolveDependencySerial = serial.serial('RequireResolveDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
        range: dependency.range,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new RequireResolveDependency(
        frozen.request,
        frozen.range,
      );
    },
  },

  optional,

  warnings,
});

const RequireResolveHeaderDependency = require('webpack/lib/dependencies/RequireResolveHeaderDependency');
const RequireResolveHeaderDependencySerial = serial.serial('RequireResolveHeaderDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        range: dependency.range,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new RequireResolveHeaderDependency(
        frozen.range,
      );
    },
  },

  optional,

  warnings,
});

const SingleEntryDependency = require('webpack/lib/dependencies/SingleEntryDependency');
const SingleEntryDependencySerial = serial.serial('SingleEntryDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new SingleEntryDependency(
        frozen.request,
      );
    },
  },

  optional,

  warnings,
});

const UnsupportedDependency = require('webpack/lib/dependencies/UnsupportedDependency');
const UnsupportedDependencySerial = serial.serial('UnsupportedDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
        range: dependency.range,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new UnsupportedDependency(
        frozen.request,
        frozen.range,
      );
    },
  },

  optional,

  warnings,
});

const WebAssemblyImportDependency = require('webpack/lib/dependencies/WebAssemblyImportDependency');
const WebAssemblyImportDependencySerial = serial.serial('WebAssemblyImportDependency', {
  constructor: {
    freeze(_, dependency, extra, methods) {
      return {
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
        name: dependency.name,
        description: dependency.description,
        onlyDirectImport: dependency.onlyDirectImport,
      };
    },
    thaw(thawed, frozen, extra, methods) {
      return new WebAssemblyImportDependency(
        frozen.request,
        frozen.name,
        frozen.description,
        frozen.onlyDirectImport,
      );
    },
  },

  optional,

  warnings,
});

exports.map = new Map();
exports.AMDDefineDependency = AMDDefineDependencySerial;
exports.map.set(AMDDefineDependency, AMDDefineDependencySerial);
exports.AMDRequireArrayDependency = AMDRequireArrayDependencySerial;
exports.map.set(AMDRequireArrayDependency, AMDRequireArrayDependencySerial);
exports.AMDRequireContextDependency = AMDRequireContextDependencySerial;
exports.map.set(AMDRequireContextDependency, AMDRequireContextDependencySerial);
exports.AMDRequireDependency = AMDRequireDependencySerial;
exports.map.set(AMDRequireDependency, AMDRequireDependencySerial);
exports.AMDRequireItemDependency = AMDRequireItemDependencySerial;
exports.map.set(AMDRequireItemDependency, AMDRequireItemDependencySerial);
exports.CommonJsRequireContextDependency = CommonJsRequireContextDependencySerial;
exports.map.set(CommonJsRequireContextDependency, CommonJsRequireContextDependencySerial);
exports.CommonJsRequireDependency = CommonJsRequireDependencySerial;
exports.map.set(CommonJsRequireDependency, CommonJsRequireDependencySerial);
exports.ConstDependency = ConstDependencySerial;
exports.map.set(ConstDependency, ConstDependencySerial);
exports.ContextDependency = ContextDependencySerial;
exports.map.set(ContextDependency, ContextDependencySerial);
exports.ContextElementDependency = ContextElementDependencySerial;
exports.map.set(ContextElementDependency, ContextElementDependencySerial);
exports.CriticalDependencyWarning = CriticalDependencyWarningSerial;
exports.map.set(CriticalDependencyWarning, CriticalDependencyWarningSerial);
exports.DelegatedExportsDependency = DelegatedExportsDependencySerial;
exports.map.set(DelegatedExportsDependency, DelegatedExportsDependencySerial);
exports.DelegatedSourceDependency = DelegatedSourceDependencySerial;
exports.map.set(DelegatedSourceDependency, DelegatedSourceDependencySerial);
exports.DllEntryDependency = DllEntryDependencySerial;
exports.map.set(DllEntryDependency, DllEntryDependencySerial);
exports.HarmonyAcceptDependency = HarmonyAcceptDependencySerial;
exports.map.set(HarmonyAcceptDependency, HarmonyAcceptDependencySerial);
exports.HarmonyAcceptImportDependency = HarmonyAcceptImportDependencySerial;
exports.map.set(HarmonyAcceptImportDependency, HarmonyAcceptImportDependencySerial);
exports.HarmonyCompatibilityDependency = HarmonyCompatibilityDependencySerial;
exports.map.set(HarmonyCompatibilityDependency, HarmonyCompatibilityDependencySerial);
exports.HarmonyExportExpressionDependency = HarmonyExportExpressionDependencySerial;
exports.map.set(HarmonyExportExpressionDependency, HarmonyExportExpressionDependencySerial);
exports.HarmonyExportHeaderDependency = HarmonyExportHeaderDependencySerial;
exports.map.set(HarmonyExportHeaderDependency, HarmonyExportHeaderDependencySerial);
exports.HarmonyExportImportedSpecifierDependency = HarmonyExportImportedSpecifierDependencySerial;
exports.map.set(HarmonyExportImportedSpecifierDependency, HarmonyExportImportedSpecifierDependencySerial);
exports.HarmonyExportSpecifierDependency = HarmonyExportSpecifierDependencySerial;
exports.map.set(HarmonyExportSpecifierDependency, HarmonyExportSpecifierDependencySerial);
exports.HarmonyImportDependency = HarmonyImportDependencySerial;
exports.map.set(HarmonyImportDependency, HarmonyImportDependencySerial);
exports.HarmonyImportSideEffectDependency = HarmonyImportSideEffectDependencySerial;
exports.map.set(HarmonyImportSideEffectDependency, HarmonyImportSideEffectDependencySerial);
exports.HarmonyImportSpecifierDependency = HarmonyImportSpecifierDependencySerial;
exports.map.set(HarmonyImportSpecifierDependency, HarmonyImportSpecifierDependencySerial);
exports.HarmonyInitDependency = HarmonyInitDependencySerial;
exports.map.set(HarmonyInitDependency, HarmonyInitDependencySerial);
exports.ImportContextDependency = ImportContextDependencySerial;
exports.map.set(ImportContextDependency, ImportContextDependencySerial);
exports.ImportDependency = ImportDependencySerial;
exports.map.set(ImportDependency, ImportDependencySerial);
exports.ImportEagerDependency = ImportEagerDependencySerial;
exports.map.set(ImportEagerDependency, ImportEagerDependencySerial);
exports.ImportWeakDependency = ImportWeakDependencySerial;
exports.map.set(ImportWeakDependency, ImportWeakDependencySerial);
exports.JsonExportsDependency = JsonExportsDependencySerial;
exports.map.set(JsonExportsDependency, JsonExportsDependencySerial);
exports.LoaderDependency = LoaderDependencySerial;
exports.map.set(LoaderDependency, LoaderDependencySerial);
exports.LocalModuleDependency = LocalModuleDependencySerial;
exports.map.set(LocalModuleDependency, LocalModuleDependencySerial);
exports.ModuleDependency = ModuleDependencySerial;
exports.map.set(ModuleDependency, ModuleDependencySerial);
exports.ModuleHotAcceptDependency = ModuleHotAcceptDependencySerial;
exports.map.set(ModuleHotAcceptDependency, ModuleHotAcceptDependencySerial);
exports.ModuleHotDeclineDependency = ModuleHotDeclineDependencySerial;
exports.map.set(ModuleHotDeclineDependency, ModuleHotDeclineDependencySerial);
exports.MultiEntryDependency = MultiEntryDependencySerial;
exports.map.set(MultiEntryDependency, MultiEntryDependencySerial);
exports.NullDependency = NullDependencySerial;
exports.map.set(NullDependency, NullDependencySerial);
exports.PrefetchDependency = PrefetchDependencySerial;
exports.map.set(PrefetchDependency, PrefetchDependencySerial);
exports.RequireContextDependency = RequireContextDependencySerial;
exports.map.set(RequireContextDependency, RequireContextDependencySerial);
exports.RequireEnsureDependency = RequireEnsureDependencySerial;
exports.map.set(RequireEnsureDependency, RequireEnsureDependencySerial);
exports.RequireEnsureItemDependency = RequireEnsureItemDependencySerial;
exports.map.set(RequireEnsureItemDependency, RequireEnsureItemDependencySerial);
exports.RequireHeaderDependency = RequireHeaderDependencySerial;
exports.map.set(RequireHeaderDependency, RequireHeaderDependencySerial);
exports.RequireIncludeDependency = RequireIncludeDependencySerial;
exports.map.set(RequireIncludeDependency, RequireIncludeDependencySerial);
exports.RequireResolveContextDependency = RequireResolveContextDependencySerial;
exports.map.set(RequireResolveContextDependency, RequireResolveContextDependencySerial);
exports.RequireResolveDependency = RequireResolveDependencySerial;
exports.map.set(RequireResolveDependency, RequireResolveDependencySerial);
exports.RequireResolveHeaderDependency = RequireResolveHeaderDependencySerial;
exports.map.set(RequireResolveHeaderDependency, RequireResolveHeaderDependencySerial);
exports.SingleEntryDependency = SingleEntryDependencySerial;
exports.map.set(SingleEntryDependency, SingleEntryDependencySerial);
exports.UnsupportedDependency = UnsupportedDependencySerial;
exports.map.set(UnsupportedDependency, UnsupportedDependencySerial);
exports.WebAssemblyImportDependency = WebAssemblyImportDependencySerial;
exports.map.set(WebAssemblyImportDependency, WebAssemblyImportDependencySerial);
