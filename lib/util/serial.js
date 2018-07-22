const relateContext = require('./relate-context');

const pipe = (exports.pipe = (...fns) => ({
  freeze(arg, module, extra, methods) {
    for (const fn of fns) {
      arg = fn.freeze(arg, module, extra, methods);
    }
    return arg;
  },
  thaw(arg, frozen, extra, methods) {
    for (const fn of fns) {
      arg = fn.thaw(arg, frozen, extra, methods);
    }
    return arg;
  },
}));

const serialMap = (exports.map = (keyOp, valueOp) => ({
  freeze(arg, module, extra) {
    const resolved = [];
    for (const key in arg) {
      resolved.push([
        keyOp.freeze(key, key, extra),
        valueOp.freeze(arg[key], arg[key], extra),
      ]);
    }
    return resolved;
  },
  thaw(arg, frozen, extra) {
    const resolved = {};
    for (const item of arg) {
      const key = keyOp.thaw(item[0], item[0], extra);
      const value = valueOp.thaw(item[1], item[1], extra);
      resolved[key] = value;
    }
    return resolved;
  },
}));

const contextual = (exports.contextual = fnname => {
  const relate = relateContext[`relateNormal${fnname}`];
  const context = relateContext[`contextNormal${fnname}`];
  return {
    freeze: (arg, module, { compiler, compilation }, methods) =>
      arg ? relate(compiler || compilation.compiler, arg) : arg,
    thaw: (arg, module, { compiler, compilation }, methods) =>
      arg ? context(compiler || compilation.compiler, arg) : arg,
  };
});

const archetype = (exports.archetype = type => ({
  freeze: (arg, module, extra, { freeze }) => freeze(type, null, arg, extra),
  thaw: (arg, module, extra, { thaw }) => thaw(type, null, arg, extra),
}));
const mapArchetype = (exports.mapArchetype = type => ({
  freeze: (arg, module, extra, { mapFreeze }) =>
    mapFreeze(type, null, arg, extra),
  thaw: (arg, module, extra, { mapThaw }) => mapThaw(type, null, arg, extra),
}));

const path = (exports.path = contextual('Path'));
const pathArray = (exports.pathArray = contextual('PathArray'));
const pathSet = (exports.pathSet = contextual('PathSet'));
const request = (exports.request = contextual('Request'));
const _loaders = (exports._loaders = contextual('Loaders'));
const loaders = (exports.loaders = {
  freeze: _loaders.freeze,
  thaw(arg, frozen, extra, methods) {
    return _loaders.thaw(arg, frozen, extra, methods).map(loader => {
      if (loader.ident) {
        let ruleSet =
          extra.normalModuleFactory && extra.normalModuleFactory.ruleSet;
        if (!ruleSet) {
          ruleSet = extra.compiler.__hardSource_ruleSet;
          if (!ruleSet) {
            const RuleSet = require('webpack/lib/RuleSet');
            if (extra.compiler.options.module.defaultRules) {
              // webpack 4
              ruleSet = extra.compiler.__hardSource_ruleSet = new RuleSet(
                extra.compiler.options.module.defaultRules.concat(
                  extra.compiler.options.module.rules,
                ),
              );
            } else {
              // webpack <4
              ruleSet = extra.compiler.__hardSource_ruleSet = new RuleSet(
                extra.compiler.options.module.rules ||
                  extra.compiler.options.module.loaders,
              );
            }
          }
        }
        return {
          loader: loader.loader,
          ident: loader.ident,
          options: ruleSet.findOptionsByIdent(loader.ident),
        };
      }
      return loader;
    });
  },
});
const regExp = (exports.regExp = {
  freeze: arg => (arg ? arg.source : false),
  thaw: arg => (arg ? new RegExp(arg) : false),
});

const parser = (exports.parser = archetype('Parser'));
const generator = (exports.generator = archetype('Generator'));
const source = (exports.source = archetype('Source'));
const moduleAssets = (exports.moduleAssets = archetype('ModuleAssets'));
const moduleError = (exports.moduleError = mapArchetype('ModuleError'));
const moduleWarning = (exports.moduleWarning = mapArchetype('ModuleWarning'));
const dependencyBlock = (exports.dependencyBlock = {
  freeze: (arg, module, extra, { freeze }) =>
    freeze('DependencyBlock', null, arg, extra),
  thaw: (arg, module, extra, { thaw }) =>
    thaw('DependencyBlock', arg, module, extra),
});

const _null = (exports.null = {
  freeze: () => null,
  thaw: () => null,
});
const identity = (exports.identity = {
  freeze: (arg, module, extra, methods) => arg,
  thaw: (arg, module, extra, methods) => arg,
});

const assigned = (exports.assigned = members => ({
  freeze(arg, module, extra, methods) {
    const out = {};
    for (const key in members) {
      out[key] = members[key].freeze(arg[key], module, extra, methods);
    }
    return out;
  },
  thaw(arg, frozen, extra, methods) {
    for (const key in members) {
      arg[key] = members[key].thaw(frozen[key], frozen, extra, methods);
    }
    return arg;
  },
}));

const created = (exports.created = members => ({
  freeze(arg, module, extra, methods) {
    if (!arg) {
      return null;
    }
    const out = {};
    for (const key in members) {
      out[key] = members[key].freeze(arg[key], module, extra, methods);
    }
    return out;
  },
  thaw(arg, frozen, extra, methods) {
    if (!arg) {
      return null;
    }
    const out = {};
    for (const key in members) {
      out[key] = members[key].thaw(arg[key], frozen, extra, methods);
    }
    return out;
  },
}));

const objectAssign = (exports.objectAssign = opts => ({
  freeze(arg, module, extra) {
    const out = Object.assign({}, arg);
    for (const key in opts) {
      out[key] = opts[key].freeze(arg[key], arg, extra);
    }
    return out;
  },
  thaw(arg, frozen, extra) {
    const out = Object.assign({}, arg);
    for (const key in opts) {
      out[key] = opts[key].thaw(arg[key], arg, extra);
    }
    return out;
  },
}));

const constructed = (exports.constructed = (Type, args) => ({
  freeze(arg, module, extra, methods) {
    const out = {};
    for (const key in args) {
      out[key] = args[key].freeze(arg[key], module, extra, methods);
    }
    return out;
  },
  thaw(arg, frozen, extra, methods) {
    const newArgs = [];
    for (const key in args) {
      newArgs.push(args[key].thaw(frozen[key], frozen, extra, methods));
    }
    return new Type(...newArgs);
  },
}));

const serial = (exports.serial = (name, stages) => ({
  freeze(arg, module, extra, methods) {
    const out = {
      type: name,
    };
    for (const key in stages) {
      out[key] = stages[key].freeze(module, module, extra, methods);
    }
    return out;
  },
  thaw(arg, frozen, extra, methods) {
    let out = arg;
    for (const key in stages) {
      out = stages[key].thaw(out, frozen[key], extra, methods);
    }
    return out;
  },
}));
