const relateContext = require('./util/relate-context');
const pluginCompat = require('./util/plugin-compat');

const GeneratorSchemas4 = [
  ['ByTypeGenerator', 'map'],
  ['JavascriptGenerator'],
  ['JsonGenerator'],
  ['WebAssemblyGenerator'],
  ['WebAssemblyJavascriptGenerator'],
];

try {
  try {
    GeneratorSchemas4[0].Generator = require('webpack/lib/Generator').byType(
      {},
    ).constructor;
  } catch (_) {}
  GeneratorSchemas4[1].Generator = require('webpack/lib/JavascriptGenerator');
  GeneratorSchemas4[2].Generator = require('webpack/lib/JsonGenerator');
  try {
    GeneratorSchemas4[3].Generator = require('webpack/lib/WebAssemblyGenerator');
  } catch (_) {
    GeneratorSchemas4[3].Generator = require('webpack/lib/wasm/WebAssemblyGenerator');
  }
  try {
    GeneratorSchemas4[4].Generator = require('webpack/lib/wasm/WebAssemblyJavascriptGenerator');
  } catch (_) {}
} catch (_) {}

const freezeArgument = {
  map(arg, generator, extra, methods) {
    const map = {};
    for (const key in arg) {
      map[key] = methods.freeze('Generator', null, arg[key], extra);
    }
    return map;
  },
};

const thawArgument = {
  map(arg, generator, extra, methods) {
    const map = {};
    for (const key in arg) {
      map[key] = methods.thaw('Generator', null, arg[key], extra);
    }
    return map;
  },
};

function freezeGenerator(generator, extra, methods) {
  const schemas = extra.schemas;
  for (let i = 0; i < schemas.length; i++) {
    if (generator.constructor === schemas[i].Generator) {
      const frozen = {
        type: schemas[i][0],
      };
      for (let j = 1; j < schemas[i].length; j++) {
        let arg = generator[schemas[i][j]];
        if (freezeArgument[schemas[i][j]]) {
          arg = freezeArgument[schemas[i][j]](arg, generator, extra, methods);
        }
        frozen[schemas[i][j]] = arg;
      }
      return frozen;
    }
  }
}

function thawGenerator(frozen, extra, methods) {
  const schemas = extra.schemas;
  for (let i = 0; i < schemas.length; i++) {
    if (frozen.type === schemas[i][0]) {
      const Generator = schemas[i].Generator;
      const args = [];
      for (let j = 1; j < schemas[i].length; j++) {
        let arg = frozen[schemas[i][j]];
        if (thawArgument[schemas[i][j]]) {
          arg = thawArgument[schemas[i][j]](arg, frozen, extra, methods);
        }
        args.push(arg);
      }
      try {
        return new Generator(...args);
      } catch (_) {
        return new (Function.prototype.bind.apply(
          Generator,
          [null].concat(args),
        ))();
      }
    }
  }
}

class TransformGeneratorPlugin {
  apply(compiler) {
    pluginCompat.register(
      compiler,
      '_hardSourceBeforeFreezeGenerator',
      'syncWaterfall',
      ['frozen', 'item', 'extra'],
    );
    pluginCompat.register(
      compiler,
      '_hardSourceFreezeGenerator',
      'syncWaterfall',
      ['frozen', 'item', 'extra'],
    );
    pluginCompat.register(
      compiler,
      '_hardSourceAfterFreezeGenerator',
      'syncWaterfall',
      ['frozen', 'item', 'extra'],
    );

    pluginCompat.register(
      compiler,
      '_hardSourceBeforeThawGenerator',
      'syncWaterfall',
      ['item', 'frozen', 'extra'],
    );
    pluginCompat.register(
      compiler,
      '_hardSourceThawGenerator',
      'syncWaterfall',
      ['item', 'frozen', 'extra'],
    );
    pluginCompat.register(
      compiler,
      '_hardSourceAfterThawGenerator',
      'syncWaterfall',
      ['item', 'frozen', 'extra'],
    );

    let methods;

    pluginCompat.tap(
      compiler,
      '_hardSourceMethods',
      'TransformGeneratorPlugin',
      _methods => {
        methods = _methods;
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceFreezeGenerator',
      'TransformGeneratorPlugin freeze',
      (frozen, generator, extra) => {
        extra.schemas = GeneratorSchemas4;
        frozen = freezeGenerator(generator, extra, methods);
        frozen.moduleType = extra.module.type;
        frozen.options = {};
        return frozen;
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceThawGenerator',
      'TransformGeneratorPlugin thaw',
      (generator, { moduleType, options }, { normalModuleFactory }) => {
        return normalModuleFactory.getGenerator(moduleType, options);
      },
    );
  }
}

module.exports = TransformGeneratorPlugin;
