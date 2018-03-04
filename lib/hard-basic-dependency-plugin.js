const cachePrefix = require('./util').cachePrefix;
const LoggerFactory = require('./logger-factory');
const pluginCompat = require('./util/plugin-compat');
const relateContext = require('./util/relate-context');
const serial = require('./util/serial');

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

let AMDDefineDependency, AMDRequireArrayDependency,
  AMDRequireContextDependency, AMDRequireDependency, AMDRequireItemDependency,
  CommonJsRequireContextDependency, CommonJsRequireDependency, ConstDependency,
  ContextDependency, ContextElementDependency, CriticalDependencyWarning,
  DelegatedExportsDependency, DelegatedSourceDependency, DllEntryDependency,
  HarmonyAcceptDependency, HarmonyAcceptImportDependency,
  HarmonyCompatibilityDependency, HarmonyExportExpressionDependency,
  HarmonyExportHeaderDependency, HarmonyExportImportedSpecifierDependency,
  HarmonyExportSpecifierDependency, HarmonyImportDependency,
  HarmonyImportSpecifierDependency, ImportContextDependency, ImportDependency,
  ImportEagerContextDependency, ImportEagerDependency,
  ImportLazyContextDependency, ImportLazyOnceContextDependency,
  ImportWeakContextDependency, ImportWeakDependency, LoaderDependency,
  LocalModuleDependency, ModuleDependency, ModuleHotAcceptDependency,
  ModuleHotDeclineDependency, MultiEntryDependency, NullDependency,
  PrefetchDependency, RequireContextDependency, RequireEnsureDependency,
  RequireEnsureItemDependency, RequireHeaderDependency,
  RequireIncludeDependency, RequireResolveContextDependency,
  RequireResolveDependency, RequireResolveHeaderDependency,
  SingleEntryDependency, UnsupportedDependency;

const DependencySchemas2 = [
  ['AMDDefineDependency', 'range', 'arrayRange', 'functionRange', 'objectRange', 'namedModule'],
  ['AMDRequireArrayDependency', 'depsArray', 'range'],
  ['AMDRequireContextDependency', 'request', 'recursive', 'regExp', 'range', 'valueRange'],
  ['AMDRequireDependency', 'block'],
  ['AMDRequireItemDependency', 'request', 'range'],
  ['CommonJsRequireContextDependency', 'request', 'recursive', 'regExp', 'range', 'valueRange'],
  ['CommonJsRequireDependency', 'request', 'range'],
  ['ConstDependency', 'expression', 'range'],
  ['ContextDependency', 'request', 'recursive', 'regExp'],
  ['ContextElementDependency', 'request', 'userRequest'],
  ['DelegatedSourceDependency', 'request'],
  ['DllEntryDependency', 'dependencies', 'name'],
  ['HarmonyAcceptDependency', 'range', 'dependencies', 'hasCallback'],
  ['HarmonyAcceptImportDependency', 'request', 'importedVar', 'range'],
  ['HarmonyCompatibilityDependency', 'originModule'],
  ['HarmonyExportExpressionDependency', 'originModule', 'range', 'rangeStatement'],
  ['HarmonyExportHeaderDependency', 'range', 'rangeStatement'],
  ['HarmonyExportImportedSpecifierDependency', 'originModule', 'importDependency', 'importedVar', 'id', 'name'],
  ['HarmonyExportSpecifierDependency', 'originModule', 'id', 'name', 'position', 'immutable'],
  ['HarmonyImportDependency', 'request', 'importedVar', 'range'],
  ['HarmonyImportSpecifierDependency', 'importDependency', 'importedVar', 'id', 'name', 'range', 'strictExportPresence'],
  ['ImportContextDependency', 'request', 'recursive', 'regExp', 'range', 'valueRange', 'chunkName'],
  ['ImportDependency', 'request', 'block'],
  ['ImportEagerContextDependency', 'request', 'recursive', 'regExp', 'range', 'valueRange', 'chunkName'],
  ['ImportEagerDependency', 'request', 'range'],
  ['ImportLazyContextDependency', 'request', 'recursive', 'regExp', 'range', 'valueRange', 'chunkName'],
  ['ImportLazyOnceContextDependency', 'request', 'recursive', 'regExp', 'range', 'valueRange', 'chunkName'],
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
  ['RequireResolveContextDependency', 'request', 'recursive', 'regExp', 'range', 'valueRange'],
  ['RequireResolveDependency', 'request', 'range'],
  ['RequireResolveHeaderDependency', 'range'],
  ['SingleEntryDependency', 'request'],
  ['UnsupportedDependency', 'request', 'range'],
];

const DependencySchemas3 = [
  ['AMDDefineDependency', 'range', 'arrayRange', 'functionRange', 'objectRange', 'namedModule'],
  ['AMDRequireArrayDependency', 'depsArray', 'range'],
  ['AMDRequireContextDependency', 'request', 'recursive', 'regExp', 'range', 'valueRange'],
  ['AMDRequireDependency', 'block'],
  ['AMDRequireItemDependency', 'request', 'range'],
  ['CommonJsRequireContextDependency', 'request', 'recursive', 'regExp', 'range', 'valueRange'],
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
  ['HarmonyExportExpressionDependency', 'originModule', 'range', 'rangeStatement'],
  ['HarmonyExportHeaderDependency', 'range', 'rangeStatement'],
  ['HarmonyExportImportedSpecifierDependency', 'originModule', 'importDependency', 'importedVar', 'id', 'name', 'activeExports', 'otherStarExports'],
  ['HarmonyExportSpecifierDependency', 'originModule', 'id', 'name', 'position', 'immutable'],
  ['HarmonyImportDependency', 'request', 'importedVar', 'range'],
  ['HarmonyImportSpecifierDependency', 'importDependency', 'importedVar', 'id', 'name', 'range', 'strictExportPresence'],
  ['ImportContextDependency', 'request', 'recursive', 'regExp', 'range', 'valueRange', 'chunkName'],
  ['ImportDependency', 'request', 'block'],
  ['ImportEagerContextDependency', 'request', 'recursive', 'regExp', 'range', 'valueRange', 'chunkName'],
  ['ImportEagerDependency', 'request', 'range'],
  ['ImportLazyContextDependency', 'request', 'recursive', 'regExp', 'range', 'valueRange', 'chunkName'],
  ['ImportLazyOnceContextDependency', 'request', 'recursive', 'regExp', 'range', 'valueRange', 'chunkName'],
  ['ImportWeakContextDependency', 'request', 'recursive', 'regExp', 'range', 'valueRange', 'chunkName'],
  ['ImportWeakDependency', 'request', 'range'],
  ['LoaderDependency', 'request'],
  ['LocalModuleDependency', 'localModule', 'range'],
  ['ModuleDependency', 'request'],
  ['ModuleHotAcceptDependency', 'request', 'range'],
  ['ModuleHotDeclineDependency', 'request', 'range'],
  ['MultiEntryDependency', 'dependencies', 'name'],
  ['NullDependency'],
  ['PrefetchDependency', 'request'],
  ['RequireContextDependency', 'request', 'recursive', 'regExp', 'asyncMode', 'range'],
  ['RequireEnsureDependency', 'block'],
  ['RequireEnsureItemDependency', 'request'],
  ['RequireHeaderDependency', 'range'],
  ['RequireIncludeDependency', 'request', 'range'],
  ['RequireResolveContextDependency', 'request', 'recursive', 'regExp', 'range', 'valueRange'],
  ['RequireResolveDependency', 'request', 'range'],
  ['RequireResolveHeaderDependency', 'range'],
  ['SingleEntryDependency', 'request'],
  ['UnsupportedDependency', 'request', 'range'],
];

const DependencySchemas4 = [
  ['AMDDefineDependency', 'range', 'arrayRange', 'functionRange', 'objectRange', 'namedModule'],
  ['AMDRequireArrayDependency', 'depsArray', 'range'],
  ['AMDRequireContextDependency', 'options', 'range', 'valueRange'],
  ['AMDRequireDependency', 'block'],
  ['AMDRequireItemDependency', 'request', 'range'],
  ['CommonJsRequireContextDependency', 'options', 'range', 'valueRange'],
  ['CommonJsRequireDependency', 'request', 'range'],
  ['ConstDependency', 'expression', 'range', 'requireWebpackRequire'],
  ['ContextDependency', 'options'],
  ['ContextElementDependency', 'request', 'userRequest'],
  ['CriticalDependencyWarning', 'message'],
  ['DelegatedExportsDependency', 'originModule', 'exports'],
  ['DelegatedSourceDependency', 'request'],
  ['DllEntryDependency', 'dependencies', 'name'],
  ['HarmonyAcceptDependency', 'range', 'dependencies', 'hasCallback'],
  ['HarmonyAcceptImportDependency', 'request', 'originModule', 'parserScope'],
  ['HarmonyCompatibilityDependency', 'originModule'],
  ['HarmonyExportExpressionDependency', 'originModule', 'range', 'rangeStatement'],
  ['HarmonyExportHeaderDependency', 'range', 'rangeStatement'],
  ['HarmonyExportImportedSpecifierDependency', 'request', 'originModule', 'sourceOrder', 'parserScope', 'id', 'name', 'activeExports', 'otherStarExports', 'strictExportPresence'],
  ['HarmonyExportSpecifierDependency', 'originModule', 'id', 'name'],
  ['HarmonyImportDependency', 'request', 'originModule', 'sourceOrder', 'parserScope'],
  ['HarmonyImportSideEffectDependency', 'request', 'originModule', 'sourceOrder', 'parserScope'],
  ['HarmonyImportSpecifierDependency', 'request', 'originModule', 'sourceOrder', 'parserScope', 'id', 'name', 'range', 'strictExportPresence'],
  ['HarmonyInitDependency', 'originModule'],
  ['ImportContextDependency', 'options', 'range', 'valueRange'],
  ['ImportDependency', 'request', 'originModule', 'block'],
  ['ImportEagerDependency', 'request', 'originModule', 'range'],
  ['ImportWeakDependency', 'request', 'originModule', 'range'],
  ['JsonExportsDependency', 'exports'],
  ['LoaderDependency', 'request'],
  ['LocalModuleDependency', 'localModule', 'range'],
  ['ModuleDependency', 'request'],
  ['ModuleHotAcceptDependency', 'request', 'range'],
  ['ModuleHotDeclineDependency', 'request', 'range'],
  ['MultiEntryDependency', 'dependencies', 'name'],
  ['NullDependency', ],
  ['PrefetchDependency', 'request'],
  ['RequireContextDependency', 'options', 'range'],
  ['RequireEnsureDependency', 'block'],
  ['RequireEnsureItemDependency', 'request'],
  ['RequireHeaderDependency', 'range'],
  ['RequireIncludeDependency', 'request', 'range'],
  ['RequireResolveContextDependency', 'options', 'range', 'valueRange'],
  ['RequireResolveDependency', 'request', 'range'],
  ['RequireResolveHeaderDependency', 'range'],
  ['SingleEntryDependency', 'request'],
  ['UnsupportedDependency', 'request', 'range'],
  ['WebAssemblyImportDependency', 'request', 'name'],
];

const freezeArgument = {
  dependencies(arg, dependency, extra, methods) {
    return methods.mapFreeze('Dependency', null, arg, extra);
  },
  depsArray(arg, dependency, extra, methods) {
    return methods.mapFreeze('Dependency', null, arg, extra);
  },
  localModule(arg, dependency, extra, methods) {
    // ...
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
    if (
      dependency.constructor.name === 'AMDRequireDependency' ||
      dependency.constructor.name === 'ImportDependency'
    ) {
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
    return Array.from(arg);
  },
  otherStarExports(arg, dependency, extra, methods) {
    // This will be in extra, generated during the process of thawing.
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
  localModule(arg, frozen, extra, methods) {
    
  },
  regExp(arg, frozen, extra, methods) {
    return arg ? new RegExp(arg) : arg;
  },
  // request: function(arg, dependency, extra, methods) {
  //   return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
  // },
  block(arg, frozen, extra, methods) {
    if (
      frozen.type === 'AMDRequireDependency' ||
      frozen.type === 'ImportDependency'
    ) {
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
  activeExports(arg, frozen, extra, methods) {
    return new Set(arg);
  },
  otherStarExports(arg, frozen, extra, methods) {
    return extra.state.otherStarExports || [];
  },
  options(arg, frozen, extra, methods) {
    if (arg.regExp) {
      return Object.assign({}, arg, {
        regExp: new RegExp(arg.regExp),
      });
    }
    return arg;
  },
  parserScope(arg, frozen, extra, methods) {
    extra.state.harmonyParserScope = extra.state.harmonyParserScope || {};
    return extra.state.harmonyParserScope;
  },
};

function freezeDependency(dependency, extra, methods) {
  const schemas = extra.schemas;
  for (let i = 0; i < schemas.length; i++) {
    if (dependency.constructor === schemas[i].Dependency) {
      if (schemas[i].freeze) {
        return schemas[i].freeze(null, dependency, extra, methods);
      }
      // console.log('missing freeze', dependency.constructor.name);
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
    if (depSchema.thaw) {
      return depSchema.thaw(null, frozen, extra, methods);
    }
    // console.log('missing thaw', dependency.constructor.name);
    const Dependency = depSchema.Dependency;
    try {
      return new Dependency(...depSchema.args(frozen, extra, methods));
    } catch (_) {
      return new (Function.prototype.bind.apply(Dependency, [null].concat(depSchema.args(frozen, extra, methods))))();
    }
  }
  for (let i = 0; i < schemas.length; i++) {
    const depSchema = schemas[i];
    if (frozen.type === depSchema[0]) {
      schemas.map[frozen.type] = depSchema;
      if (depSchema.thaw) {
        return depSchema.thaw(null, frozen, extra, methods);
      }
      // console.log('missing thaw', dependency.constructor.name);
      const Dependency = depSchema.Dependency;
      const lines = [];
      for (let j = 1; j < depSchema.length; j++) {
        const argName = depSchema[j];
        if (thawArgument[argName]) {
          lines.push(`  thawArgument.${argName}(frozen.${argName}, frozen, extra, methods)`);
        }
        else {
          lines.push(`  frozen.${argName}`);
        }
      }
      depSchema.args = new Function('thawArgument', `
        return function(frozen, extra, methods) {
          return [
          ${lines.join(',\n')}
          ];
        };
      `)(thawArgument);
      try {
        return new Dependency(...depSchema.args(frozen, extra, methods));
      } catch (_) {
        return new (Function.prototype.bind.apply(Dependency, [null].concat(depSchema.args(frozen, extra, methods))))();
      }
    }
  }
}

function HardBasicDependencyPlugin(options) {
  this.options = options;
}

HardBasicDependencyPlugin.prototype.apply = function(compiler) {
  let schemas = DependencySchemas4;
  if (this.options.schema < 4) {
    schemas = DependencySchemas3;
  }
  if (this.options.schema < 3) {
    schemas = DependencySchemas2;
  }

  const emptyAssigned = serial.assigned({});

  const contextAssigned = serial.assigned({
    prepend: serial.identity,
    replaces: serial.identity,
    critical: serial.identity,
  });

  const importSpecifierAssigned = serial.assigned({
    namespaceObjectAsContext: serial.identity,
    callArgs: serial.identity,
    call: serial.identity,
    directImport: serial.identity,
    shorthand: serial.identity,
  });

  pluginCompat.tap(compiler, 'afterPlugins', 'HardBasicDependencyPlugin scan Dependency types', () => {
    pluginCompat.tap(compiler, 'compilation', 'HardBasicDependencyPlugin scan Dependencies types', compilation => {
      const Dependencies = compilation.dependencyFactories.keys();
      for (const Dep of Dependencies) {
        for (let i = 0; i < schemas.length; i++) {
          if (Dep.name === schemas[i][0]) {
            schemas[i].Dependency = Dep;
            const constructor = {};
            for (const argument of schemas[i].slice(1)) {
              let argShape;
              if (freezeArgument[argument] && thawArgument[argument]) {
                argShape = 'both';
                constructor[argument] = {
                  freeze: freezeArgument[argument],
                  thaw: thawArgument[argument],
                };
              }
              else if (freezeArgument[argument]) {
                argShape = 'freeze';
                constructor[argument] = {
                  freeze: freezeArgument[argument],
                  thaw: serial.identity.thaw,
                };
              }
              else if (thawArgument[argument]) {
                argShape = 'thaw';
                constructor[argument] = {
                  freeze: freezeArgument[argument],
                  thaw: serial.identity.thaw,
                };
              }
              else {
                argShape = 'identity';
                constructor[argument] = serial.identity;
              }
              // console.log(Dep.name, argument, argShape, constructor[argument]);
            }
            let assigned = emptyAssigned;
            if (Dep.name.indexOf('Context') !== -1) {
              assigned = contextAssigned;
            }
            else if (Dep.name.indexOf('ImportSpecifier') !== -1) {
              assigned = importSpecifierAssigned;
            }
            // console.log(Dep.name, Object.keys(constructor));
            Object.assign(schemas[i], serial.serial(schemas[i][0], {
              constructor: serial.constructed(Dep, constructor),
              assigned: assigned,
            }));
            // const _assigned = serial.assigned(assigned);
            // const _constructed = serial.constructed(Dep, constructor);
            // Object.assign(schemas[i], {
            //   freeze(arg, source, extra, methods) {
            //     return Object.assign(
            //       {
            //         type: schemas[i][0],
            //       },
            //       _assigned.freeze(source, source, extra, methods),
            //       _constructed.freeze(source, source, extra, methods),
            //     );
            //   },
            //   thaw(arg, frozen, extra, methods) {
            //     return _assigned.thaw(_constructed.thaw(null, frozen, extra, methods), frozen, extra, methods);
            //   },
            // });
          }
        }
      }
    });
  });

  let methods;

  pluginCompat.tap(compiler, '_hardSourceMethods', 'HardBasicDependencyPlugin methods', _methods => {
    methods = _methods;
  });

  pluginCompat.tap(compiler, '_hardSourceFreezeDependency', 'HardBasicDependencyPlugin freeze', function(frozen, dependency, extra) {
    extra.schemas = schemas;
    const _frozen = freezeDependency(dependency, extra, methods);
    // console.log(_frozen);
    return _frozen;
    if (_frozen) {
      if (dependency.prepend) {
        console.log(dependency.constructor.name, 'prepend');
        _frozen.prepend = dependency.prepend;
      }
      if (dependency.replaces) {
        console.log(dependency.constructor.name, 'replaces');
        _frozen.replaces = dependency.replaces;
      }
      if (dependency.critical) {
        console.log(dependency.constructor.name, 'critical');
        _frozen.critical = dependency.critical;
      }
      if (typeof dependency.namespaceObjectAsContext !== 'undefined') {
        console.log(dependency.constructor.name, 'namespaceObjectAsContext');
        _frozen.namespaceObjectAsContext = dependency.namespaceObjectAsContext;
      }
      if (typeof dependency.callArgs !== 'undefined') {
        console.log(dependency.constructor.name, 'callArgs');
        _frozen.callArgs = dependency.callArgs;
      }
      if (typeof dependency.call !== 'undefined') {
        console.log(dependency.constructor.name, 'call');
        _frozen.call = dependency.call;
      }
      if (typeof dependency.directImport !== 'undefined') {
        console.log(dependency.constructor.name, 'directImport');
        _frozen.directImport = dependency.directImport;
      }
      if (typeof dependency.shorthand !== 'undefined') {
        console.log(dependency.constructor.name, 'shorthand');
        _frozen.shorthand = dependency.shorthand;
      }
      // console.log('Frozen', _frozen.type);
      return _frozen;
    }
    // console.log('Missed', dependency.constructor.name);

    return frozen;
  });

  pluginCompat.tap(compiler, '_hardSourceAfterFreezeDependency', 'HardBasicDependencyPlugin after freeze', (frozen, dependency, extra) => {
    if (frozen && dependency.loc) {
      frozen.loc = flattenPrototype(dependency.loc);
    }

    if (frozen && dependency.optional) {
      frozen.optional = dependency.optional;
    }

    if (frozen && dependency.getWarnings) {
      const warnings = dependency.getWarnings();
      if (warnings && warnings.length) {
        frozen.warnings = warnings.map(warning => (
          warning.stack.indexOf('\n    at pluginCompat.tap') !== -1 ?
            warning.stack.split('\n    at pluginCompat.tap')[0] :
            warning.stack.split('\n    at Compiler.pluginCompat.tap')[0]
        ));
      }
    }

    return frozen;
  });

  pluginCompat.tap(compiler, '_hardSourceThawDependency', 'HardBasicDependencyPlugin', function(dependency, frozen, extra) {
    extra.schemas = schemas;
    const _thawed = thawDependency(frozen, extra, methods);
    // console.log(_thawed);
    return _thawed;
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
      if (frozen.type === 'HarmonyImportDependency') {
        const ref = frozen.range.toString();
        if (state.imports[ref]) {
          return state.imports[ref];
        }
        state.imports[ref] = _thawed;
      }
      else if (frozen.type === 'HarmonyExportImportedSpecifierDependency') {
        // console.log(frozen);
        // console.log(_thawed);
        extra.state.otherStarExports = (extra.state.otherStarExports || [])
        .concat(_thawed);
      }
      return _thawed;
    }
    // console.log('Missed', frozen.type);

    return dependency;
  });

  pluginCompat.tap(compiler, '_hardSourceAfterThawDependency', 'HardBasicDependencyPlugin', function(dependency, frozen, extra) {
    if (dependency && frozen.loc) {
      dependency.loc = frozen.loc;
    }

    if (dependency && frozen.optional) {
      dependency.optional = true;
    }

    if (dependency && frozen.warnings && dependency.getWarnings) {
      const frozenWarnings = frozen.warnings;
      const _getWarnings = dependency.getWarnings;
      dependency.getWarnings = function() {
        const warnings = _getWarnings.call(this);
        if (warnings && warnings.length) {
          return warnings.map((warning, i) => {
            const stack = warning.stack.split('\n    at Compilation.reportDependencyErrorsAndWarnings')[1];
            warning.stack = frozenWarnings[i] + '\n    at Compilation.reportDependencyErrorsAndWarnings' + stack;
            return warning;
          });
        }
        return warnings;
      };
    }

    return dependency;
  });
};

module.exports = HardBasicDependencyPlugin;
