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
  freeze(frozen, dependency) {
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
      typeof frozen === 'object' &&
      frozen !== null
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
            stack.includes('\n    at pluginCompat.tap')
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
  constructor: serial.constructed(AMDDefineDependency, {
    range: serial.identity,
    arrayRange: serial.identity,
    functionRange: serial.identity,
    objectRange: serial.identity,
    namedModule: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const AMDRequireArrayDependency = require('webpack/lib/dependencies/AMDRequireArrayDependency');
const AMDRequireArrayDependencySerial = serial.serial('AMDRequireArrayDependency', {
  constructor: serial.constructed(AMDRequireArrayDependency, {
    depsArray: {
      freeze(arg, dependency, extra, methods) {
        return methods.mapFreeze('Dependency', null, arg, extra);
      },
      thaw(arg, frozen, extra, methods) {
        return methods.mapThaw('Dependency', null, arg, extra);
      },
    },
    range: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const AMDRequireContextDependency = require('webpack/lib/dependencies/AMDRequireContextDependency');
const AMDRequireContextDependencySerial = serial.serial('AMDRequireContextDependency', {
  constructor: serial.constructed(AMDRequireContextDependency, {
    options: {
      freeze(arg, dependency, extra, methods) {
        if (arg.regExp) {
          return Object.assign({}, arg, {
            regExp: arg.regExp.source,
          });
        }
        return arg;
      },
      thaw(arg, frozen, extra, methods) {
        if (arg.regExp) {
          return Object.assign({}, arg, {
            regExp: new RegExp(arg.regExp),
          });
        }
        return arg;
      },
    },
    range: serial.identity,
    valueRange: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const AMDRequireDependency = require('webpack/lib/dependencies/AMDRequireDependency');
const AMDRequireDependencySerial = serial.serial('AMDRequireDependency', {
  constructor: serial.constructed(AMDRequireDependency, {
    block: {
      freeze(arg, dependency, extra, methods) {
        // Dependency nested in a parent. Freezing the block is a loop.
        if (arg.dependencies.includes(dependency)) {
          return;
        }
        return methods.freeze('DependencyBlock', null, arg, extra);
      },
      thaw(arg, frozen, extra, methods) {
        // Not having a block, means it needs to create a cycle and refer to its
        // parent.
        if (!arg) {
          return extra.parent;
        }
        return methods.thaw('DependencyBlock', null, arg, extra);
      },
    },
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const AMDRequireItemDependency = require('webpack/lib/dependencies/AMDRequireItemDependency');
const AMDRequireItemDependencySerial = serial.serial('AMDRequireItemDependency', {
  constructor: serial.constructed(AMDRequireItemDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
    range: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const CommonJsRequireContextDependency = require('webpack/lib/dependencies/CommonJsRequireContextDependency');
const CommonJsRequireContextDependencySerial = serial.serial('CommonJsRequireContextDependency', {
  constructor: serial.constructed(CommonJsRequireContextDependency, {
    options: {
      freeze(arg, dependency, extra, methods) {
        if (arg.regExp) {
          return Object.assign({}, arg, {
            regExp: arg.regExp.source,
          });
        }
        return arg;
      },
      thaw(arg, frozen, extra, methods) {
        if (arg.regExp) {
          return Object.assign({}, arg, {
            regExp: new RegExp(arg.regExp),
          });
        }
        return arg;
      },
    },
    range: serial.identity,
    valueRange: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const CommonJsRequireDependency = require('webpack/lib/dependencies/CommonJsRequireDependency');
const CommonJsRequireDependencySerial = serial.serial('CommonJsRequireDependency', {
  constructor: serial.constructed(CommonJsRequireDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
    range: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const ConstDependency = require('webpack/lib/dependencies/ConstDependency');
const ConstDependencySerial = serial.serial('ConstDependency', {
  constructor: serial.constructed(ConstDependency, {
    expression: serial.identity,
    range: serial.identity,
    requireWebpackRequire: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const ContextDependency = require('webpack/lib/dependencies/ContextDependency');
const ContextDependencySerial = serial.serial('ContextDependency', {
  constructor: serial.constructed(ContextDependency, {
    options: {
      freeze(arg, dependency, extra, methods) {
        if (arg.regExp) {
          return Object.assign({}, arg, {
            regExp: arg.regExp.source,
          });
        }
        return arg;
      },
      thaw(arg, frozen, extra, methods) {
        if (arg.regExp) {
          return Object.assign({}, arg, {
            regExp: new RegExp(arg.regExp),
          });
        }
        return arg;
      },
    },
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const ContextElementDependency = require('webpack/lib/dependencies/ContextElementDependency');
const ContextElementDependencySerial = serial.serial('ContextElementDependency', {
  constructor: serial.constructed(ContextElementDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
    userRequest: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const CriticalDependencyWarning = require('webpack/lib/dependencies/CriticalDependencyWarning');
const CriticalDependencyWarningSerial = serial.serial('CriticalDependencyWarning', {
  constructor: serial.constructed(CriticalDependencyWarning, {
    message: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const DelegatedExportsDependency = require('webpack/lib/dependencies/DelegatedExportsDependency');
const DelegatedExportsDependencySerial = serial.serial('DelegatedExportsDependency', {
  constructor: serial.constructed(DelegatedExportsDependency, {
    originModule: {
      freeze(arg, dependency, extra, methods) {
        // This will be in extra, generated or found during the process of thawing.
      },
      thaw(arg, frozen, extra, methods) {
        return extra.module;
      },
    },
    exports: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const DelegatedSourceDependency = require('webpack/lib/dependencies/DelegatedSourceDependency');
const DelegatedSourceDependencySerial = serial.serial('DelegatedSourceDependency', {
  constructor: serial.constructed(DelegatedSourceDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const DllEntryDependency = require('webpack/lib/dependencies/DllEntryDependency');
const DllEntryDependencySerial = serial.serial('DllEntryDependency', {
  constructor: serial.constructed(DllEntryDependency, {
    dependencies: {
      freeze(arg, dependency, extra, methods) {
        return methods.mapFreeze('Dependency', null, arg, extra);
      },
      thaw(arg, frozen, extra, methods) {
        return methods.mapThaw('Dependency', null, arg, extra);
      },
    },
    name: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const HarmonyAcceptDependency = require('webpack/lib/dependencies/HarmonyAcceptDependency');
const HarmonyAcceptDependencySerial = serial.serial('HarmonyAcceptDependency', {
  constructor: serial.constructed(HarmonyAcceptDependency, {
    range: serial.identity,
    dependencies: {
      freeze(arg, dependency, extra, methods) {
        return methods.mapFreeze('Dependency', null, arg, extra);
      },
      thaw(arg, frozen, extra, methods) {
        return methods.mapThaw('Dependency', null, arg, extra);
      },
    },
    hasCallback: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const HarmonyAcceptImportDependency = require('webpack/lib/dependencies/HarmonyAcceptImportDependency');
const HarmonyAcceptImportDependencySerial = serial.serial('HarmonyAcceptImportDependency', {
  constructor: serial.constructed(HarmonyAcceptImportDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
    originModule: {
      freeze(arg, dependency, extra, methods) {
        // This will be in extra, generated or found during the process of thawing.
      },
      thaw(arg, frozen, extra, methods) {
        return extra.module;
      },
    },
    parserScope: {
      freeze(arg, dependencies, extra, methods) {
        return;
      },
      thaw(arg, frozen, { state }, methods) {
        state.harmonyParserScope = state.harmonyParserScope || {};
        return state.harmonyParserScope;
      },
    },
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const HarmonyCompatibilityDependency = require('webpack/lib/dependencies/HarmonyCompatibilityDependency');
const HarmonyCompatibilityDependencySerial = serial.serial('HarmonyCompatibilityDependency', {
  constructor: serial.constructed(HarmonyCompatibilityDependency, {
    originModule: {
      freeze(arg, dependency, extra, methods) {
        // This will be in extra, generated or found during the process of thawing.
      },
      thaw(arg, frozen, extra, methods) {
        return extra.module;
      },
    },
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const HarmonyExportExpressionDependency = require('webpack/lib/dependencies/HarmonyExportExpressionDependency');
const HarmonyExportExpressionDependencySerial = serial.serial('HarmonyExportExpressionDependency', {
  constructor: serial.constructed(HarmonyExportExpressionDependency, {
    originModule: {
      freeze(arg, dependency, extra, methods) {
        // This will be in extra, generated or found during the process of thawing.
      },
      thaw(arg, frozen, extra, methods) {
        return extra.module;
      },
    },
    range: serial.identity,
    rangeStatement: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const HarmonyExportHeaderDependency = require('webpack/lib/dependencies/HarmonyExportHeaderDependency');
const HarmonyExportHeaderDependencySerial = serial.serial('HarmonyExportHeaderDependency', {
  constructor: serial.constructed(HarmonyExportHeaderDependency, {
    range: serial.identity,
    rangeStatement: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const HarmonyExportImportedSpecifierDependency = require('webpack/lib/dependencies/HarmonyExportImportedSpecifierDependency');
const HarmonyExportImportedSpecifierDependencySerial = serial.serial('HarmonyExportImportedSpecifierDependency', {
  constructor: serial.constructed(HarmonyExportImportedSpecifierDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
    originModule: {
      freeze(arg, dependency, extra, methods) {
        // This will be in extra, generated or found during the process of thawing.
      },
      thaw(arg, frozen, extra, methods) {
        return extra.module;
      },
    },
    sourceOrder: serial.identity,
    parserScope: {
      freeze(arg, dependencies, extra, methods) {
        return;
      },
      thaw(arg, frozen, { state }, methods) {
        state.harmonyParserScope = state.harmonyParserScope || {};
        return state.harmonyParserScope;
      },
    },
    id: serial.identity,
    name: serial.identity,
    activeExports: {
      freeze(arg, dependency, extra, methods) {
        return null;
      },
      thaw(arg, { name }, { state }, methods) {
        state.activeExports = state.activeExports || new Set();
        if (name) {
          state.activeExports.add(name);
        }
        return state.activeExports;
      },
    },
    otherStarExports: {
      freeze(arg, dependency, extra, methods) {
        if (arg) {
          // This will be in extra, generated during the process of thawing.
          return 'star';
        }
        return null;
      },
      thaw(arg, frozen, { state }, methods) {
        if (arg === 'star') {
          return state.otherStarExports || [];
        }
        return null;
      },
    },
    strictExportPresence: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,

  exportImportedDependency: {
    freeze(frozen) {
      return frozen;
    },
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
  constructor: serial.constructed(HarmonyExportSpecifierDependency, {
    originModule: {
      freeze(arg, dependency, extra, methods) {
        // This will be in extra, generated or found during the process of thawing.
      },
      thaw(arg, frozen, extra, methods) {
        return extra.module;
      },
    },
    id: serial.identity,
    name: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const HarmonyImportDependency = require('webpack/lib/dependencies/HarmonyImportDependency');
const HarmonyImportDependencySerial = serial.serial('HarmonyImportDependency', {
  constructor: serial.constructed(HarmonyImportDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
    originModule: {
      freeze(arg, dependency, extra, methods) {
        // This will be in extra, generated or found during the process of thawing.
      },
      thaw(arg, frozen, extra, methods) {
        return extra.module;
      },
    },
    sourceOrder: serial.identity,
    parserScope: {
      freeze(arg, dependencies, extra, methods) {
        return;
      },
      thaw(arg, frozen, { state }, methods) {
        state.harmonyParserScope = state.harmonyParserScope || {};
        return state.harmonyParserScope;
      },
    },
  }),

  optional,

  localModuleAssigned,

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
  constructor: serial.constructed(HarmonyImportSideEffectDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
    originModule: {
      freeze(arg, dependency, extra, methods) {
        // This will be in extra, generated or found during the process of thawing.
      },
      thaw(arg, frozen, extra, methods) {
        return extra.module;
      },
    },
    sourceOrder: serial.identity,
    parserScope: {
      freeze(arg, dependencies, extra, methods) {
        return;
      },
      thaw(arg, frozen, { state }, methods) {
        state.harmonyParserScope = state.harmonyParserScope || {};
        return state.harmonyParserScope;
      },
    },
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const HarmonyImportSpecifierDependency = require('webpack/lib/dependencies/HarmonyImportSpecifierDependency');
const HarmonyImportSpecifierDependencySerial = serial.serial('HarmonyImportSpecifierDependency', {
  constructor: serial.constructed(HarmonyImportSpecifierDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
    originModule: {
      freeze(arg, dependency, extra, methods) {
        // This will be in extra, generated or found during the process of thawing.
      },
      thaw(arg, frozen, extra, methods) {
        return extra.module;
      },
    },
    sourceOrder: serial.identity,
    parserScope: {
      freeze(arg, dependencies, extra, methods) {
        return;
      },
      thaw(arg, frozen, { state }, methods) {
        state.harmonyParserScope = state.harmonyParserScope || {};
        return state.harmonyParserScope;
      },
    },
    id: serial.identity,
    name: serial.identity,
    range: serial.identity,
    strictExportPresence: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const HarmonyInitDependency = require('webpack/lib/dependencies/HarmonyInitDependency');
const HarmonyInitDependencySerial = serial.serial('HarmonyInitDependency', {
  constructor: serial.constructed(HarmonyInitDependency, {
    originModule: {
      freeze(arg, dependency, extra, methods) {
        // This will be in extra, generated or found during the process of thawing.
      },
      thaw(arg, frozen, extra, methods) {
        return extra.module;
      },
    },
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const ImportContextDependency = require('webpack/lib/dependencies/ImportContextDependency');
const ImportContextDependencySerial = serial.serial('ImportContextDependency', {
  constructor: serial.constructed(ImportContextDependency, {
    options: {
      freeze(arg, dependency, extra, methods) {
        if (arg.regExp) {
          return Object.assign({}, arg, {
            regExp: arg.regExp.source,
          });
        }
        return arg;
      },
      thaw(arg, frozen, extra, methods) {
        if (arg.regExp) {
          return Object.assign({}, arg, {
            regExp: new RegExp(arg.regExp),
          });
        }
        return arg;
      },
    },
    range: serial.identity,
    valueRange: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const ImportDependency = require('webpack/lib/dependencies/ImportDependency');
const ImportDependencySerial = serial.serial('ImportDependency', {
  constructor: serial.constructed(ImportDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
    originModule: {
      freeze(arg, dependency, extra, methods) {
        // This will be in extra, generated or found during the process of thawing.
      },
      thaw(arg, frozen, extra, methods) {
        return extra.module;
      },
    },
    block: {
      freeze(arg, dependency, extra, methods) {
        // Dependency nested in a parent. Freezing the block is a loop.
        if (arg.dependencies.includes(dependency)) {
          return;
        }
        return methods.freeze('DependencyBlock', null, arg, extra);
      },
      thaw(arg, frozen, extra, methods) {
        // Not having a block, means it needs to create a cycle and refer to its
        // parent.
        if (!arg) {
          return extra.parent;
        }
        return methods.thaw('DependencyBlock', null, arg, extra);
      },
    },
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const ImportEagerDependency = require('webpack/lib/dependencies/ImportEagerDependency');
const ImportEagerDependencySerial = serial.serial('ImportEagerDependency', {
  constructor: serial.constructed(ImportEagerDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
    originModule: {
      freeze(arg, dependency, extra, methods) {
        // This will be in extra, generated or found during the process of thawing.
      },
      thaw(arg, frozen, extra, methods) {
        return extra.module;
      },
    },
    range: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const ImportWeakDependency = require('webpack/lib/dependencies/ImportWeakDependency');
const ImportWeakDependencySerial = serial.serial('ImportWeakDependency', {
  constructor: serial.constructed(ImportWeakDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
    originModule: {
      freeze(arg, dependency, extra, methods) {
        // This will be in extra, generated or found during the process of thawing.
      },
      thaw(arg, frozen, extra, methods) {
        return extra.module;
      },
    },
    range: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const JsonExportsDependency = require('webpack/lib/dependencies/JsonExportsDependency');
const JsonExportsDependencySerial = serial.serial('JsonExportsDependency', {
  constructor: serial.constructed(JsonExportsDependency, {
    exports: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const LoaderDependency = require('webpack/lib/dependencies/LoaderDependency');
const LoaderDependencySerial = serial.serial('LoaderDependency', {
  constructor: serial.constructed(LoaderDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const LocalModuleDependency = require('webpack/lib/dependencies/LocalModuleDependency');
const LocalModuleDependencySerial = serial.serial('LocalModuleDependency', {
  constructor: serial.constructed(LocalModuleDependency, {
    localModule: {
      freeze({ name, idx }, dependency, extra, methods) {
        return {
          name: name,
          idx: idx,
        };
      },
      thaw({ idx, name, used }, frozen, extra, methods) {
        const state = extra.state;
        if (!state.localModules) {
          state.localModules = [];
        }
        if (!state.localModules[idx]) {
          state.localModules[idx] = new LocalModule(extra.module, name, idx);
          state.localModules[idx].used = used;
        }
        return state.localModules[idx];
      },
    },
    range: serial.identity,
    callNew: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const ModuleDependency = require('webpack/lib/dependencies/ModuleDependency');
const ModuleDependencySerial = serial.serial('ModuleDependency', {
  constructor: serial.constructed(ModuleDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const ModuleHotAcceptDependency = require('webpack/lib/dependencies/ModuleHotAcceptDependency');
const ModuleHotAcceptDependencySerial = serial.serial('ModuleHotAcceptDependency', {
  constructor: serial.constructed(ModuleHotAcceptDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
    range: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const ModuleHotDeclineDependency = require('webpack/lib/dependencies/ModuleHotDeclineDependency');
const ModuleHotDeclineDependencySerial = serial.serial('ModuleHotDeclineDependency', {
  constructor: serial.constructed(ModuleHotDeclineDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
    range: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const MultiEntryDependency = require('webpack/lib/dependencies/MultiEntryDependency');
const MultiEntryDependencySerial = serial.serial('MultiEntryDependency', {
  constructor: serial.constructed(MultiEntryDependency, {
    dependencies: {
      freeze(arg, dependency, extra, methods) {
        return methods.mapFreeze('Dependency', null, arg, extra);
      },
      thaw(arg, frozen, extra, methods) {
        return methods.mapThaw('Dependency', null, arg, extra);
      },
    },
    name: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const NullDependency = require('webpack/lib/dependencies/NullDependency');
const NullDependencySerial = serial.serial('NullDependency', {
  constructor: serial.constructed(NullDependency, {
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const PrefetchDependency = require('webpack/lib/dependencies/PrefetchDependency');
const PrefetchDependencySerial = serial.serial('PrefetchDependency', {
  constructor: serial.constructed(PrefetchDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const RequireContextDependency = require('webpack/lib/dependencies/RequireContextDependency');
const RequireContextDependencySerial = serial.serial('RequireContextDependency', {
  constructor: serial.constructed(RequireContextDependency, {
    options: {
      freeze(arg, dependency, extra, methods) {
        if (arg.regExp) {
          return Object.assign({}, arg, {
            regExp: arg.regExp.source,
          });
        }
        return arg;
      },
      thaw(arg, frozen, extra, methods) {
        if (arg.regExp) {
          return Object.assign({}, arg, {
            regExp: new RegExp(arg.regExp),
          });
        }
        return arg;
      },
    },
    range: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const RequireEnsureDependency = require('webpack/lib/dependencies/RequireEnsureDependency');
const RequireEnsureDependencySerial = serial.serial('RequireEnsureDependency', {
  constructor: serial.constructed(RequireEnsureDependency, {
    block: {
      freeze(arg, dependency, extra, methods) {
        // Dependency nested in a parent. Freezing the block is a loop.
        if (arg.dependencies.includes(dependency)) {
          return;
        }
        return methods.freeze('DependencyBlock', null, arg, extra);
      },
      thaw(arg, frozen, extra, methods) {
        // Not having a block, means it needs to create a cycle and refer to its
        // parent.
        if (!arg) {
          return extra.parent;
        }
        return methods.thaw('DependencyBlock', null, arg, extra);
      },
    },
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const RequireEnsureItemDependency = require('webpack/lib/dependencies/RequireEnsureItemDependency');
const RequireEnsureItemDependencySerial = serial.serial('RequireEnsureItemDependency', {
  constructor: serial.constructed(RequireEnsureItemDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const RequireHeaderDependency = require('webpack/lib/dependencies/RequireHeaderDependency');
const RequireHeaderDependencySerial = serial.serial('RequireHeaderDependency', {
  constructor: serial.constructed(RequireHeaderDependency, {
    range: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const RequireIncludeDependency = require('webpack/lib/dependencies/RequireIncludeDependency');
const RequireIncludeDependencySerial = serial.serial('RequireIncludeDependency', {
  constructor: serial.constructed(RequireIncludeDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
    range: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const RequireResolveContextDependency = require('webpack/lib/dependencies/RequireResolveContextDependency');
const RequireResolveContextDependencySerial = serial.serial('RequireResolveContextDependency', {
  constructor: serial.constructed(RequireResolveContextDependency, {
    options: {
      freeze(arg, dependency, extra, methods) {
        if (arg.regExp) {
          return Object.assign({}, arg, {
            regExp: arg.regExp.source,
          });
        }
        return arg;
      },
      thaw(arg, frozen, extra, methods) {
        if (arg.regExp) {
          return Object.assign({}, arg, {
            regExp: new RegExp(arg.regExp),
          });
        }
        return arg;
      },
    },
    range: serial.identity,
    valueRange: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const RequireResolveDependency = require('webpack/lib/dependencies/RequireResolveDependency');
const RequireResolveDependencySerial = serial.serial('RequireResolveDependency', {
  constructor: serial.constructed(RequireResolveDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
    range: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const RequireResolveHeaderDependency = require('webpack/lib/dependencies/RequireResolveHeaderDependency');
const RequireResolveHeaderDependencySerial = serial.serial('RequireResolveHeaderDependency', {
  constructor: serial.constructed(RequireResolveHeaderDependency, {
    range: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const SingleEntryDependency = require('webpack/lib/dependencies/SingleEntryDependency');
const SingleEntryDependencySerial = serial.serial('SingleEntryDependency', {
  constructor: serial.constructed(SingleEntryDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const UnsupportedDependency = require('webpack/lib/dependencies/UnsupportedDependency');
const UnsupportedDependencySerial = serial.serial('UnsupportedDependency', {
  constructor: serial.constructed(UnsupportedDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
    range: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

const WebAssemblyImportDependency = require('webpack/lib/dependencies/WebAssemblyImportDependency');
const WebAssemblyImportDependencySerial = serial.serial('WebAssemblyImportDependency', {
  constructor: serial.constructed(WebAssemblyImportDependency, {
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
    name: serial.identity,
    description: serial.identity,
    onlyDirectImport: serial.identity,
  }),

  optional,

  localModuleAssigned,

  warnings,
});

module.exports = {
  AMDDefineDependency: AMDDefineDependencySerial,
  AMDRequireArrayDependency: AMDRequireArrayDependencySerial,
  AMDRequireContextDependency: AMDRequireContextDependencySerial,
  AMDRequireDependency: AMDRequireDependencySerial,
  AMDRequireItemDependency: AMDRequireItemDependencySerial,
  CommonJsRequireContextDependency: CommonJsRequireContextDependencySerial,
  CommonJsRequireDependency: CommonJsRequireDependencySerial,
  ConstDependency: ConstDependencySerial,
  ContextDependency: ContextDependencySerial,
  ContextElementDependency: ContextElementDependencySerial,
  CriticalDependencyWarning: CriticalDependencyWarningSerial,
  DelegatedExportsDependency: DelegatedExportsDependencySerial,
  DelegatedSourceDependency: DelegatedSourceDependencySerial,
  DllEntryDependency: DllEntryDependencySerial,
  HarmonyAcceptDependency: HarmonyAcceptDependencySerial,
  HarmonyAcceptImportDependency: HarmonyAcceptImportDependencySerial,
  HarmonyCompatibilityDependency: HarmonyCompatibilityDependencySerial,
  HarmonyExportExpressionDependency: HarmonyExportExpressionDependencySerial,
  HarmonyExportHeaderDependency: HarmonyExportHeaderDependencySerial,
  HarmonyExportImportedSpecifierDependency: HarmonyExportImportedSpecifierDependencySerial,
  HarmonyExportSpecifierDependency: HarmonyExportSpecifierDependencySerial,
  HarmonyImportDependency: HarmonyImportDependencySerial,
  HarmonyImportSideEffectDependency: HarmonyImportSideEffectDependencySerial,
  HarmonyImportSpecifierDependency: HarmonyImportSpecifierDependencySerial,
  HarmonyInitDependency: HarmonyInitDependencySerial,
  ImportContextDependency: ImportContextDependencySerial,
  ImportDependency: ImportDependencySerial,
  ImportEagerDependency: ImportEagerDependencySerial,
  ImportWeakDependency: ImportWeakDependencySerial,
  JsonExportsDependency: JsonExportsDependencySerial,
  LoaderDependency: LoaderDependencySerial,
  LocalModuleDependency: LocalModuleDependencySerial,
  ModuleDependency: ModuleDependencySerial,
  ModuleHotAcceptDependency: ModuleHotAcceptDependencySerial,
  ModuleHotDeclineDependency: ModuleHotDeclineDependencySerial,
  MultiEntryDependency: MultiEntryDependencySerial,
  NullDependency: NullDependencySerial,
  PrefetchDependency: PrefetchDependencySerial,
  RequireContextDependency: RequireContextDependencySerial,
  RequireEnsureDependency: RequireEnsureDependencySerial,
  RequireEnsureItemDependency: RequireEnsureItemDependencySerial,
  RequireHeaderDependency: RequireHeaderDependencySerial,
  RequireIncludeDependency: RequireIncludeDependencySerial,
  RequireResolveContextDependency: RequireResolveContextDependencySerial,
  RequireResolveDependency: RequireResolveDependencySerial,
  RequireResolveHeaderDependency: RequireResolveHeaderDependencySerial,
  SingleEntryDependency: SingleEntryDependencySerial,
  UnsupportedDependency: UnsupportedDependencySerial,
  WebAssemblyImportDependency: WebAssemblyImportDependencySerial,
};
