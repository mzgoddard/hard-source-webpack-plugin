const cachePrefix = require('./util').cachePrefix;
const LoggerFactory = require('./loggerFactory');
const pluginCompat = require('./util/plugin-compat');
const relateContext = require('./util/relate-context');

let LocalModule;
try {
  LocalModule = require('webpack/lib/dependencies/LocalModule');
} catch (_) {}

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

let AMDDefineDependency;
let AMDRequireArrayDependency;
let AMDRequireContextDependency;
let AMDRequireDependency;
let AMDRequireItemDependency;
let CommonJsRequireContextDependency;
let CommonJsRequireDependency;
let ConstDependency;
let ContextDependency;
let ContextElementDependency;
let CriticalDependencyWarning;
let DelegatedExportsDependency;
let DelegatedSourceDependency;
let DllEntryDependency;
let HarmonyAcceptDependency;
let HarmonyAcceptImportDependency;
let HarmonyCompatibilityDependency;
let HarmonyExportExpressionDependency;
let HarmonyExportHeaderDependency;
let HarmonyExportImportedSpecifierDependency;
let HarmonyExportSpecifierDependency;
let HarmonyImportDependency;
let HarmonyImportSpecifierDependency;
let ImportContextDependency;
let ImportDependency;
let ImportEagerContextDependency;
let ImportEagerDependency;
let ImportLazyContextDependency;
let ImportLazyOnceContextDependency;
let ImportWeakContextDependency;
let ImportWeakDependency;
let LoaderDependency;
let LocalModuleDependency;
let ModuleDependency;
let ModuleHotAcceptDependency;
let ModuleHotDeclineDependency;
let MultiEntryDependency;
let NullDependency;
let PrefetchDependency;
let RequireContextDependency;
let RequireEnsureDependency;
let RequireEnsureItemDependency;
let RequireHeaderDependency;
let RequireIncludeDependency;
let RequireResolveContextDependency;
let RequireResolveDependency;
let RequireResolveHeaderDependency;
let SingleEntryDependency;
let UnsupportedDependency;

const DependencySchemas2 = [
  [
    'AMDDefineDependency',
    'range',
    'arrayRange',
    'functionRange',
    'objectRange',
    'namedModule',
  ],
  ['AMDRequireArrayDependency', 'depsArray', 'range'],
  [
    'AMDRequireContextDependency',
    'request',
    'recursive',
    'regExp',
    'range',
    'valueRange',
  ],
  ['AMDRequireDependency', 'block'],
  ['AMDRequireItemDependency', 'request', 'range'],
  [
    'CommonJsRequireContextDependency',
    'request',
    'recursive',
    'regExp',
    'range',
    'valueRange',
  ],
  ['CommonJsRequireDependency', 'request', 'range'],
  ['ConstDependency', 'expression', 'range'],
  ['ContextDependency', 'request', 'recursive', 'regExp'],
  ['ContextElementDependency', 'request', 'userRequest'],
  ['DelegatedSourceDependency', 'request'],
  ['DllEntryDependency', 'dependencies', 'name'],
  ['HarmonyAcceptDependency', 'range', 'dependencies', 'hasCallback'],
  ['HarmonyAcceptImportDependency', 'request', 'importedVar', 'range'],
  ['HarmonyCompatibilityDependency', 'originModule'],
  [
    'HarmonyExportExpressionDependency',
    'originModule',
    'range',
    'rangeStatement',
  ],
  ['HarmonyExportHeaderDependency', 'range', 'rangeStatement'],
  [
    'HarmonyExportImportedSpecifierDependency',
    'originModule',
    'importDependency',
    'importedVar',
    'id',
    'name',
  ],
  [
    'HarmonyExportSpecifierDependency',
    'originModule',
    'id',
    'name',
    'position',
    'immutable',
  ],
  ['HarmonyImportDependency', 'request', 'importedVar', 'range'],
  [
    'HarmonyImportSpecifierDependency',
    'importDependency',
    'importedVar',
    'id',
    'name',
    'range',
    'strictExportPresence',
  ],
  [
    'ImportContextDependency',
    'request',
    'recursive',
    'regExp',
    'range',
    'valueRange',
    'chunkName',
  ],
  ['ImportDependency', 'request', 'block'],
  [
    'ImportEagerContextDependency',
    'request',
    'recursive',
    'regExp',
    'range',
    'valueRange',
    'chunkName',
  ],
  ['ImportEagerDependency', 'request', 'range'],
  [
    'ImportLazyContextDependency',
    'request',
    'recursive',
    'regExp',
    'range',
    'valueRange',
    'chunkName',
  ],
  [
    'ImportLazyOnceContextDependency',
    'request',
    'recursive',
    'regExp',
    'range',
    'valueRange',
    'chunkName',
  ],
  ['LoaderDependency', 'request'],
  ['LocalModuleDependency', 'localModule', 'range'],
  ['ModuleDependency', 'request'],
  ['ModuleHotAcceptDependency', 'request', 'range'],
  ['ModuleHotDeclineDependency', 'request', 'range'],
  ['MultiEntryDependency', 'dependencies', 'name'],
  ['NullDependency'],
  ['PrefetchDependency', 'request'],
  ['RequireContextDependency', 'request', 'recursive', 'regExp', 'range'],
  ['RequireEnsureDependency', 'block'],
  ['RequireEnsureItemDependency', 'request'],
  ['RequireHeaderDependency', 'range'],
  ['RequireIncludeDependency', 'request', 'range'],
  [
    'RequireResolveContextDependency',
    'request',
    'recursive',
    'regExp',
    'range',
    'valueRange',
  ],
  ['RequireResolveDependency', 'request', 'range'],
  ['RequireResolveHeaderDependency', 'range'],
  ['SingleEntryDependency', 'request'],
  ['UnsupportedDependency', 'request', 'range'],
];

const DependencySchemas3 = [
  [
    'AMDDefineDependency',
    'range',
    'arrayRange',
    'functionRange',
    'objectRange',
    'namedModule',
  ],
  ['AMDRequireArrayDependency', 'depsArray', 'range'],
  [
    'AMDRequireContextDependency',
    'request',
    'recursive',
    'regExp',
    'range',
    'valueRange',
  ],
  ['AMDRequireDependency', 'block'],
  ['AMDRequireItemDependency', 'request', 'range'],
  [
    'CommonJsRequireContextDependency',
    'request',
    'recursive',
    'regExp',
    'range',
    'valueRange',
  ],
  ['CommonJsRequireDependency', 'request', 'range'],
  ['ConstDependency', 'expression', 'range'],
  ['ContextDependency', 'request', 'recursive', 'regExp'],
  ['ContextElementDependency', 'request', 'userRequest'],
  ['CriticalDependencyWarning', 'message'],
  ['DelegatedExportsDependency', 'originModule', 'exports'],
  ['DelegatedSourceDependency', 'request'],
  ['DllEntryDependency', 'dependencies', 'name'],
  ['HarmonyAcceptDependency', 'range', 'dependencies', 'hasCallback'],
  ['HarmonyAcceptImportDependency', 'request', 'importedVar', 'range'],
  ['HarmonyCompatibilityDependency', 'originModule'],
  [
    'HarmonyExportExpressionDependency',
    'originModule',
    'range',
    'rangeStatement',
  ],
  ['HarmonyExportHeaderDependency', 'range', 'rangeStatement'],
  [
    'HarmonyExportImportedSpecifierDependency',
    'originModule',
    'importDependency',
    'importedVar',
    'id',
    'name',
    'activeExports',
    'otherStarExports',
  ],
  [
    'HarmonyExportSpecifierDependency',
    'originModule',
    'id',
    'name',
    'position',
    'immutable',
  ],
  ['HarmonyImportDependency', 'request', 'importedVar', 'range'],
  [
    'HarmonyImportSpecifierDependency',
    'importDependency',
    'importedVar',
    'id',
    'name',
    'range',
    'strictExportPresence',
  ],
  [
    'ImportContextDependency',
    'request',
    'recursive',
    'regExp',
    'range',
    'valueRange',
    'chunkName',
  ],
  ['ImportDependency', 'request', 'block'],
  [
    'ImportEagerContextDependency',
    'request',
    'recursive',
    'regExp',
    'range',
    'valueRange',
    'chunkName',
  ],
  ['ImportEagerDependency', 'request', 'range'],
  [
    'ImportLazyContextDependency',
    'request',
    'recursive',
    'regExp',
    'range',
    'valueRange',
    'chunkName',
  ],
  [
    'ImportLazyOnceContextDependency',
    'request',
    'recursive',
    'regExp',
    'range',
    'valueRange',
    'chunkName',
  ],
  [
    'ImportWeakContextDependency',
    'request',
    'recursive',
    'regExp',
    'range',
    'valueRange',
    'chunkName',
  ],
  ['ImportWeakDependency', 'request', 'range'],
  ['LoaderDependency', 'request'],
  ['LocalModuleDependency', 'localModule', 'range'],
  ['ModuleDependency', 'request'],
  ['ModuleHotAcceptDependency', 'request', 'range'],
  ['ModuleHotDeclineDependency', 'request', 'range'],
  ['MultiEntryDependency', 'dependencies', 'name'],
  ['NullDependency'],
  ['PrefetchDependency', 'request'],
  [
    'RequireContextDependency',
    'request',
    'recursive',
    'regExp',
    'asyncMode',
    'range',
  ],
  ['RequireEnsureDependency', 'block'],
  ['RequireEnsureItemDependency', 'request'],
  ['RequireHeaderDependency', 'range'],
  ['RequireIncludeDependency', 'request', 'range'],
  [
    'RequireResolveContextDependency',
    'request',
    'recursive',
    'regExp',
    'range',
    'valueRange',
  ],
  ['RequireResolveDependency', 'request', 'range'],
  ['RequireResolveHeaderDependency', 'range'],
  ['SingleEntryDependency', 'request'],
  ['UnsupportedDependency', 'request', 'range'],
];

const freezeArgument = {
  dependencies(arg, dependency, extra, methods) {
    return methods.mapFreeze('Dependency', null, arg, extra);
  },
  depsArray(arg, dependency, extra, methods) {
    return methods.mapFreeze('Dependency', null, arg, extra);
  },
  localModule({ name, idx }, dependency, extra, methods) {
    return {
      name: name,
      idx: idx,
    };
  },
  regExp(arg, dependency, extra, methods) {
    return arg ? arg.source : false;
  },
  request(arg, dependency, extra, methods) {
    return relateContext.relateAbsoluteRequest(extra.module.context, arg);
  },
  userRequest(arg, dependency, extra, methods) {
    return relateContext.relateAbsoluteRequest(extra.module.context, arg);
  },
  block(arg, dependency, extra, methods) {
    // Dependency nested in a parent. Freezing the block is a loop.
    if (arg.dependencies.includes(dependency)) {
      return;
    }
    return methods.freeze('DependencyBlock', null, arg, extra);
  },
  importDependency(arg, dependency, extra, methods) {
    return methods.freeze('Dependency', null, arg, extra);
  },
  originModule(arg, dependency, extra, methods) {
    // This will be in extra, generated or found during the process of thawing.
  },
  activeExports(arg, dependency, extra, methods) {
    return null;
  },
  otherStarExports(arg, dependency, extra, methods) {
    if (arg) {
      // This will be in extra, generated during the process of thawing.
      return 'star';
    }
    return null;
  },
  options(arg, dependency, extra, methods) {
    if (arg.regExp) {
      return Object.assign({}, arg, {
        regExp: arg.regExp.source,
      });
    }
    return arg;
  },
  parserScope(arg, dependencies, extra, methods) {
    return;
  },
};

const thawArgument = {
  dependencies(arg, frozen, extra, methods) {
    return methods.mapThaw('Dependency', null, arg, extra);
  },
  depsArray(arg, frozen, extra, methods) {
    return methods.mapThaw('Dependency', null, arg, extra);
  },
  localModule({ idx, name, used }, frozen, extra, methods) {
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
  regExp(arg, frozen, extra, methods) {
    return arg ? new RegExp(arg) : arg;
  },
  // request: function(arg, dependency, extra, methods) {
  //   return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
  // },
  block(arg, frozen, extra, methods) {
    // Not having a block, means it needs to create a cycle and refer to its
    // parent.
    if (!arg) {
      return extra.parent;
    }
    return methods.thaw('DependencyBlock', null, arg, extra);
  },
  importDependency(arg, frozen, extra, methods) {
    return methods.thaw('Dependency', null, arg, extra);
  },
  originModule(arg, frozen, extra, methods) {
    return extra.module;
  },
  activeExports(arg, { name }, { state }, methods) {
    state.activeExports = state.activeExports || new Set();
    if (name) {
      state.activeExports.add(name);
    }
    return state.activeExports;
  },
  otherStarExports(arg, frozen, { state }, methods) {
    if (arg === 'star') {
      return state.otherStarExports || [];
    }
    return null;
  },
  options(arg, frozen, extra, methods) {
    if (arg.regExp) {
      return Object.assign({}, arg, {
        regExp: new RegExp(arg.regExp),
      });
    }
    return arg;
  },
  parserScope(arg, frozen, { state }, methods) {
    state.harmonyParserScope = state.harmonyParserScope || {};
    return state.harmonyParserScope;
  },
};

function freezeDependency(dependency, extra, methods) {
  const schemas = extra.schemas;
  for (let i = 0; i < schemas.length; i++) {
    if (dependency.constructor === schemas[i].Dependency) {
      const frozen = {
        type: schemas[i][0],
      };
      for (let j = 1; j < schemas[i].length; j++) {
        let arg = dependency[schemas[i][j]];
        if (freezeArgument[schemas[i][j]]) {
          arg = freezeArgument[schemas[i][j]](arg, dependency, extra, methods);
        }
        frozen[schemas[i][j]] = arg;
      }
      return frozen;
    }
  }
}

function thawDependency(frozen, extra, methods) {
  const schemas = extra.schemas;
  schemas.map = schemas.map || {};
  if (schemas.map[frozen.type]) {
    const depSchema = schemas.map[frozen.type];
    const Dependency = depSchema.Dependency;
    try {
      return new Dependency(...depSchema.args(frozen, extra, methods));
    } catch (_) {
      return new (Function.prototype.bind.apply(
        Dependency,
        [null].concat(depSchema.args(frozen, extra, methods)),
      ))();
    }
  }

  for (const depSchema of schemas) {
    if (frozen.type === depSchema[0]) {
      schemas.map[frozen.type] = depSchema;
      const Dependency = depSchema.Dependency;
      const lines = [];
      for (let j = 1; j < depSchema.length; j++) {
        const argName = depSchema[j];
        if (thawArgument[argName]) {
          lines.push(
            `  thawArgument.${argName}(frozen.${argName}, frozen, extra, methods)`,
          );
        } else {
          lines.push(`  frozen.${argName}`);
        }
      }
      depSchema.args = new Function(
        'thawArgument',
        `
        return function(frozen, extra, methods) {
          return [
          ${lines.join(',\n')}
          ];
        };
      `,
      )(thawArgument);
      try {
        return new Dependency(...depSchema.args(frozen, extra, methods));
      } catch (_) {
        return new (Function.prototype.bind.apply(
          Dependency,
          [null].concat(depSchema.args(frozen, extra, methods)),
        ))();
      }
    }
  }
}

class TransformBasicDependencyPluginLegacy {
  constructor(options) {
    this.options = options;
  }

  apply(compiler) {
    let schemas = DependencySchemas3;
    if (this.options.schema < 3) {
      schemas = DependencySchemas2;
    }

    pluginCompat.tap(
      compiler,
      'afterPlugins',
      'TransformBasicDependencyPlugin scan Dependency types',
      () => {
        pluginCompat.tap(
          compiler,
          'compilation',
          'TransformBasicDependencyPlugin scan Dependencies types',
          ({ dependencyFactories }) => {
            const Dependencies = dependencyFactories.keys();
            for (const Dep of Dependencies) {
              for (let i = 0; i < schemas.length; i++) {
                if (Dep.name === schemas[i][0]) {
                  schemas[i].Dependency = Dep;
                }
              }
            }
            for (let i = 0; i < schemas.length; i++) {
              if (!schemas[i].Dependency) {
                if (this.options.schema < 4) {
                } else {
                  if (schemas[i][0] === 'JsonExportsDependency') {
                    try {
                      schemas[
                        i
                      ].Dependency = require('webpack/lib/dependencies/JsonExportsDependency');
                    } catch (_) {}
                  } else if (schemas[i][0] === 'DelegatedExportsDependency') {
                    try {
                      schemas[
                        i
                      ].Dependency = require('webpack/lib/dependencies/DelegatedExportsDependency');
                    } catch (_) {}
                  } else if (schemas[i][0] === 'DelegatedSourceDependency') {
                    try {
                      schemas[
                        i
                      ].Dependency = require('webpack/lib/dependencies/DelegatedSourceDependency');
                    } catch (_) {}
                  }
                }
              }
            }
          },
        );
      },
    );

    let methods;

    pluginCompat.tap(
      compiler,
      '_hardSourceMethods',
      'TransformBasicDependencyPlugin methods',
      _methods => {
        methods = _methods;
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceFreezeDependency',
      'TransformBasicDependencyPlugin freeze',
      (frozen, dependency, extra) => {
        extra.schemas = schemas;
        const _frozen = freezeDependency(dependency, extra, methods);
        if (_frozen) {
          if (dependency.prepend) {
            _frozen.prepend = dependency.prepend;
          }
          if (dependency.replaces) {
            _frozen.replaces = dependency.replaces;
          }
          if (dependency.critical) {
            _frozen.critical = dependency.critical;
          }
          if (typeof dependency.namespaceObjectAsContext !== 'undefined') {
            _frozen.namespaceObjectAsContext =
              dependency.namespaceObjectAsContext;
          }
          if (typeof dependency.callArgs !== 'undefined') {
            _frozen.callArgs = dependency.callArgs;
          }
          if (typeof dependency.call !== 'undefined') {
            _frozen.call = dependency.call;
          }
          if (typeof dependency.directImport !== 'undefined') {
            _frozen.directImport = dependency.directImport;
          }
          if (typeof dependency.shorthand !== 'undefined') {
            _frozen.shorthand = dependency.shorthand;
          }
          if (
            typeof dependency.localModule === 'object' &&
            dependency.localModule !== null
          ) {
            _frozen.localModule = {
              name: dependency.localModule.name,
              idx: dependency.localModule.idx,
              used: dependency.localModule.used,
            };
          }
          return _frozen;
        }

        return frozen;
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceAfterFreezeDependency',
      'TransformBasicDependencyPlugin after freeze',
      (frozen, dependency, extra) => {
        if (frozen && dependency.loc) {
          frozen.loc = flattenPrototype(dependency.loc);
        }

        if (frozen && dependency.optional) {
          frozen.optional = dependency.optional;
        }

        if (frozen && dependency.getWarnings) {
          const warnings = dependency.getWarnings();
          if (warnings && warnings.length) {
            frozen.warnings = warnings.map(
              ({ stack }) =>
                stack.includes('\n    at pluginCompat.tap')
                  ? stack.split('\n    at pluginCompat.tap')[0]
                  : stack.split('\n    at Compiler.pluginCompat.tap')[0],
            );
          }
        }

        return frozen;
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceThawDependency',
      'TransformBasicDependencyPlugin',
      (dependency, frozen, extra) => {
        extra.schemas = schemas;
        const _thawed = thawDependency(frozen, extra, methods);
        if (_thawed) {
          const state = extra.state;
          // console.log('Thawed', frozen.type);
          if (frozen.prepend) {
            _thawed.prepend = frozen.prepend;
          }
          if (frozen.replaces) {
            _thawed.replaces = frozen.replaced;
          }
          if (frozen.critical) {
            _thawed.critical = frozen.critical;
          }
          if (typeof frozen.namespaceObjectAsContext !== 'undefined') {
            _thawed.namespaceObjectAsContext = frozen.namespaceObjectAsContext;
          }
          if (typeof frozen.callArgs !== 'undefined') {
            _thawed.callArgs = frozen.callArgs;
          }
          if (typeof frozen.call !== 'undefined') {
            _thawed.call = frozen.call;
          }
          if (typeof frozen.directImport !== 'undefined') {
            _thawed.directImport = frozen.directImport;
          }
          if (typeof frozen.shorthand !== 'undefined') {
            _thawed.shorthand = frozen.shorthand;
          }
          if (
            typeof frozen.localModule === 'object' &&
            frozen.localModule !== null
          ) {
            if (!state.localModules) {
              state.localModules = [];
            }
            if (!state.localModules[frozen.localModule.idx]) {
              state.localModules[frozen.localModule.idx] = new LocalModule(
                extra.module,
                frozen.localModule.name,
                frozen.localModule.idx,
              );
              state.localModules[frozen.localModule.idx].used =
                frozen.localModule.used;
            }
            _thawed.localModule = state.localModules[frozen.localModule.idx];
          }
          if (frozen.type === 'HarmonyImportDependency') {
            const ref = frozen.range.toString();
            if (state.imports[ref]) {
              return state.imports[ref];
            }
            state.imports[ref] = _thawed;
          } else if (
            frozen.type === 'HarmonyExportImportedSpecifierDependency'
          ) {
            if (_thawed.otherStarExports) {
              extra.state.otherStarExports = (
                extra.state.otherStarExports || []
              ).concat(_thawed);
            }
          }
          return _thawed;
        }

        return dependency;
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceAfterThawDependency',
      'TransformBasicDependencyPlugin',
      (dependency, { loc, optional, warnings }, extra) => {
        if (dependency && loc) {
          dependency.loc = loc;
        }

        if (dependency && optional) {
          dependency.optional = true;
        }

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
    );
  }
}

module.exports = TransformBasicDependencyPluginLegacy;
