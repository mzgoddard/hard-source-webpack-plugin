const relateContext = require('./relate-context');

const pipe = exports.pipe = (...fns) => ({
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
});

const contextual = exports.contextual = (fnname) => {
  const relate = relateContext[`relateNormal${fnname}`];
  const context = relateContext[`contextNormal${fnname}`];
  return {
    freeze: (arg, module, extra, methods) => relate(extra.compilation.compiler, arg),
    thaw: (arg, module, extra, methods) => context(extra.compilation.compiler, arg),
  };
};

const archetype = exports.archetype = (type) => ({
  freeze: (arg, module, extra, {freeze}) => freeze(type, null, arg, extra),
  thaw: (arg, module, extra, {thaw}) => thaw(type, null, arg, extra),
});
const mapArchetype = exports.mapArchetype = (type) => ({
  freeze: (arg, module, extra, {mapFreeze}) => mapFreeze(type, null, arg, extra),
  thaw: (arg, module, extra, {mapThaw}) => mapThaw(type, null, arg, extra),
});

const path = exports.path = contextual('Path');
const pathSet = exports.pathSet = contextual('PathSet');
const request = exports.request = contextual('Request');
const loaders = exports.loaders = contextual('Loaders');

// const parser = exports.parser = archetype('Parser');
const parser = exports.parser = ({
  freeze: () => null,
  thaw: () => null,
});
const generator = exports.generator = archetype('Generator');
const source = exports.source = archetype('Source');
const moduleAssets = exports.moduleAssets = archetype('ModuleAssets');
const moduleError = exports.moduleError = mapArchetype('ModuleError');
const moduleWarning = exports.moduleWarning = mapArchetype('ModuleWarning');
const dependencyBlock = exports.dependencyBlock = ({
  freeze: (arg, module, extra, {freeze}) => freeze('DependencyBlock', null, arg, extra),
  thaw: (arg, module, extra, {thaw}) => thaw('DependencyBlock', arg, module, extra),
});

const identity = exports.identity = {
  freeze: (arg, module, extra, methods) => arg,
  thaw: (arg, module, extra, methods) => arg,
};

const assigned = exports.assigned = (members) => ({
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
});

const created = exports.created = (members) => ({
  freeze(arg, module, extra, methods) {
    const out = {};
    for (const key in members) {
      out[key] = members[key].freeze(arg[key], module, extra, methods);
    }
    return out;
  },
  thaw(arg, frozen, extra, methods) {
    console.log(arg, frozen, members);
    const out = {};
    for (const key in members) {
      out[key] = members[key].thaw(arg[key], frozen, extra, methods);
    }
    return out;
  },
});

const constructed = exports.constructed = (Type, args) => ({
  freeze(arg, module, extra, methods) {
    const out = {};
    for (const key in args) {
      out[key] = args[key].freeze(arg[key], module, extra, methods);
    }
    return out;
  },
  thaw(arg, frozen, extra, methods) {
    console.log(arg, frozen);
    const newArgs = [];
    for (const key in args) {
      newArgs.push(args[key].thaw(frozen[key], frozen, extra, methods));
    }
    return new Type(...newArgs);
  },
});

const serial = exports.serial = (name, stages) => ({
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
    console.log(arg, frozen);
    let out;
    for (const key in stages) {
      out = stages[key].thaw(out, frozen[key], extra, methods);
    }
    return out;
  },
});

exports.NormalModule = serial('NormalModule', {
  constructor: constructed(require('webpack/lib/NormalModule'), {
    data: pipe(
      ({freeze: (arg, module) => module, thaw: arg => arg}),
      created({
        type: identity,
        request: request,
        userRequest: request,
        loaders: loaders,
        resource: path,
        parser: parser,
        generator: generator,
        resolveOptions: identity,
      }),
    ),
  }),

  setModule: ({
    freeze(arg, module, extra, methods) {},
    thaw(arg, frozen, extra, methods) {
      extra.module = arg;
      return arg;
    },
  }),

  assigned: assigned({
    useSourceMap: identity,
    lineToLine: identity,
  }),

  build: assigned({
    buildTimestamp: identity,
    buildMeta: identity,
    buildInfo: created({
      assets: moduleAssets,
      fileDependencies: pathSet,
      contextDependencies: pathSet,
      harmonyModule: identity,
      strict: identity,
      exportsArgument: identity,
    }),
    warnings: moduleWarning,
    errors: moduleWarning,
    _source: source,
    hash: identity,
  }),

  dependencyBlock: dependencyBlock,

  source: assigned({
    _cachedSource: source,
    _cachedSourceHash: identity,
    renderedHash: identity,
  }),
});
