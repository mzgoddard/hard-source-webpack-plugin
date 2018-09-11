/** prelude
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
**/

const constructorArguments = {
/** dependencies
    dependencies: {
      freeze(arg, dependency, extra, methods) {
        return methods.mapFreeze('Dependency', null, arg, extra);
      },
      thaw(arg, frozen, extra, methods) {
        return methods.mapThaw('Dependency', null, arg, extra);
      },
    },
**/
/** freeze dependencies
        dependencies: methods.mapFreeze('Dependency', null, dependency.dependencies, extra),
**/
/** thaw dependencies
        methods.mapThaw('Dependency', null, frozen.dependencies, extra),
**/
/** depsArray
    depsArray: {
      freeze(arg, dependency, extra, methods) {
        return methods.mapFreeze('Dependency', null, arg, extra);
      },
      thaw(arg, frozen, extra, methods) {
        return methods.mapThaw('Dependency', null, arg, extra);
      },
    },
**/
/** freeze depsArray
        depsArray: methods.mapFreeze('Dependency', null, dependency.depsArray, extra),
**/
/** thaw depsArray
        methods.mapThaw('Dependency', null, frozen.depsArray, extra),
**/
/** localModule
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
**/
/** freeze localModule
        localModule: {
          name: dependency.localModule.name,
          name: dependency.localModule.idx,
        },
**/
/** thaw prep localModule
      if (!extra.state.localModules) {
        extra.state.localModules = [];
      }
      if (!extra.state.localModules[frozen.localModule.idx]) {
        extra.state.localModules[frozen.localModule.idx] = new LocalModule(extra.module, frozen.localModule.name, frozen.localModule.idx);
        extra.state.localModules[frozen.localModule.idx].used = frozen.localModule.used;
      }
**/
/** thaw localModule
        extra.state.localModules[frozen.localModule.idx],
**/
/** regExp
    regExp: {
      freeze(arg, dependency, extra, methods) {
        return arg ? arg.source : false;
      },
      thaw(arg, frozen, extra, methods) {
        return arg ? new RegExp(arg) : arg;
      },
    },
**/
/** freeze regExp
        regExp: dependency.regExp ? dependency.regExp.source : false,
**/
/** thaw regExp
        frozen.regExp ? new RegExp(frozen.regExp) : frozen.regExp,
**/
/** request
    request: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
**/
/** freeze request
        request: relateContext.relateAbsoluteRequest(extra.module.context, dependency.request),
**/
/** thaw request
        frozen.request,
**/
/** userRequest
    userRequest: {
      freeze(arg, dependency, extra, methods) {
        return relateContext.relateAbsoluteRequest(extra.module.context, arg);
      },
      thaw(arg, dependency, extra, methods) {
        return arg;
        // return relateContext.contextNormalRequest(extra.compilation.compiler, arg);
      },
    },
**/
/** freeze userRequest
        userRequest: relateContext.relateAbsoluteRequest(extra.module.context, dependency.userRequest),
**/
/** thaw userRequest
        frozen.userRequest,
**/
/** block
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
**/
/** freeze block
        block: !dependency.block.dependencies.includes(dependency) ?
          methods.freeze('DependencyBlock', null, dependency.block, extra) :
          undefined,
**/
/** thaw block
        !frozen.block ? extra.parent : methods.thaw('DependencyBlock', null, frozen.block, extra),
**/
/** importDependency
    importDependency: {
      freeze(arg, dependency, extra, methods) {
        return methods.freeze('Dependency', null, arg, extra);
      },
      thaw(arg, frozen, extra, methods) {
        return methods.thaw('Dependency', null, arg, extra);
      },
    },
**/
/** freeze importDependency
        importDependency: methods.freeze('Dependency', null, dependency.importDependency, extra),
**/
/** thaw importDependency
        methods.thaw('Dependency', null, frozen.importDependency, extra),
**/
/** originModule
    originModule: {
      freeze(arg, dependency, extra, methods) {
        // This will be in extra, generated or found during the process of thawing.
      },
      thaw(arg, frozen, extra, methods) {
        return extra.module;
      },
    },
**/
/** freeze originModule
        originModule: null,
**/
/** thaw originModule
        extra.module,
**/
/** activeExports
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
**/
/** freeze activeExports
        activeExports: null,
**/
/** thaw prep activeExports
      extra.state.activeExports = extra.state.activeExports || new Set();
      if (frozen.name) {
        extra.state.activeExports.add(frozen.name);
      }
**/
/** thaw activeExports
        extra.state.activeExports,
**/
/** otherStarExports
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
**/
/** freeze otherStarExports
        otherStarExports: dependency.otherStarExports ? 'star' : null,
**/
/** thaw otherStarExports
        frozen.otherStarExports === 'star' ?
          (extra.state.otherStarExports || []) :
          null,
**/
/** options
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
**/
/** freeze options
        options: dependency.options.regExp ?
          Object.assign({}, dependency.options, {
            regExp: dependency.options.regExp.source,
          }) :
          dependency.options,
**/
/** thaw options
        frozen.options.regExp ?
          Object.assign({}, frozen.options, {
            regExp: new RegExp(frozen.options.regExp),
          }) :
          frozen.options,
**/
/** parserScope
    parserScope: {
      freeze(arg, dependencies, extra, methods) {
        return;
      },
      thaw(arg, frozen, { state }, methods) {
        state.harmonyParserScope = state.harmonyParserScope || {};
        return state.harmonyParserScope;
      },
    },
**/
/** freeze parserScope
        parserScope: null,
**/
/** thaw prep parserScope
      extra.state.harmonyParserScope = extra.state.harmonyParserScope || {};
**/
/** thaw parserScope
        extra.state.harmonyParserScope,
**/
};

/** importDependencyState
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
**/

/** exportImportedDependencyState
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
**/

const fs = require('graceful-fs');
const path = require('path');

const generateRaw = fs.readFileSync(path.join(__dirname, '_generate.js'), 'utf8');
const generateBlocks = generateRaw
.split(/((?:\/\*\*)((?!\*\*\/)[^\r\n]*\r?\n)+)/g)
.filter(Boolean)
.filter(str => !str.startsWith('**/'))
.reduce((carry, item, index) => index % 2 === 0 ? [...carry, item] : carry, []);

const getBlock = name => {
  let lines = generateBlocks
    .find(block => block.startsWith(`/** ${name}`));
  if (lines) {
    lines = lines.split('\n');
    lines = lines.slice(1, lines.length - 1);
  }
  return lines || [];
};

const dependencyInfo = require('./basic-dependency.json');

let output = getBlock('prelude');

for (const dependency of dependencyInfo) {
  const DepName = dependency[0];
  const depName = DepName[0].toLowerCase() + DepName.slice(1);
  const DepNameSerial = `${DepName}Serial`;
  output.push(`const ${dependency[0]} = require('webpack/lib/dependencies/${dependency[0]}');`);
  output.push(`const ${DepNameSerial} = serial.serial('${DepName}', {`);

  // output.push(`  constructor: serial.constructed(${DepName}, {`);
  // for (const argument of dependency.slice(1)) {
  //   let block = getBlock(argument);
  //   if (!block.length) {
  //     block = [`    ${argument}: serial.identity,`];
  //   }
  //   output.push(...block);
  // }
  // output.push(`  }),`);

  output.push(`  constructor: {`);
  output.push(`    freeze(_, dependency, extra, methods) {`);
  output.push(`      return {`);
  for (const argument of dependency.slice(1)) {
    let block = getBlock(`freeze ${argument}`);
    if (!block.length) {
      block = [`        ${argument}: dependency.${argument},`];
    }
    output.push(...block);
  }
  output.push(`      };`);
  output.push(`    },`);
  output.push(`    thaw(thawed, frozen, extra, methods) {`);
  for (const argument of dependency.slice(1)) {
    let block = getBlock(`thaw prep ${argument}`);
    output.push(...block);
  }
  output.push(`      return new ${DepName}(`);
  for (const argument of dependency.slice(1)) {
    let block = getBlock(`thaw ${argument}`);
    if (!block.length) {
      block = [`        frozen.${argument},`];
    }
    output.push(...block);
  }
  output.push(`      );`);
  output.push(`    },`);
  output.push(`  },`);

  output.push(``);
  output.push(`  optional,`);

  if (DepName === 'AMDDefineDependency' || DepName === 'LocalModuleDependency') {
    output.push(``);
    output.push(`  localModuleAssigned,`);
  }

  output.push(``);
  output.push(`  warnings,`);

  if (DepName === 'HarmonyImportDependency') {
    output.push(``);
    output.push(...getBlock('importDependencyState'));
  }

  if (DepName === 'HarmonyExportImportedSpecifierDependency') {
    output.push(``);
    output.push(...getBlock('exportImportedDependencyState'));
  }

  output.push(`});`);
  output.push(``);
}

output.push(`exports.map = new Map();`);
for (const dependency of dependencyInfo) {
  const DepName = dependency[0];
  const DepNameSerial = `${DepName}Serial`;
  output.push(`exports.${DepName} = ${DepNameSerial};`);
  output.push(`exports.map.set(${DepName}, ${DepNameSerial});`);
}
output.push(``);

require('graceful-fs').writeFileSync(require('path').join(__dirname, 'index.js'), output.join('\n'), 'utf8');
