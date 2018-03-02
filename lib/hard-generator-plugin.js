const relateContext = require('./util/relate-context');
const pluginCompat = require('./util/plugin-compat');

const GeneratorSchemas4 = [
  ['JavascriptGenerator'],
  ['JsonGenerator'],
  ['WebAssemblyGenerator'],
];

try {
  GeneratorSchemas4[0].Generator = require('webpack/lib/JavascriptGenerator');
  GeneratorSchemas4[1].Generator = require('webpack/lib/JsonGenerator');
  GeneratorSchemas4[2].Generator = require('webpack/lib/WebAssemblyGenerator');
} catch (_) {}

const freezeArgument = {
};

const thawArgument = {
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
        return new (Function.prototype.bind.apply(Generator, [null].concat(args)))();
      }
    }
  }
}

class HardGeneratorPlugin {
  apply(compiler) {
    pluginCompat.register(compiler, '_hardSourceBeforeFreezeGenerator', 'syncWaterfall', ['frozen', 'item', 'extra']);
    pluginCompat.register(compiler, '_hardSourceFreezeGenerator', 'syncWaterfall', ['frozen', 'item', 'extra']);
    pluginCompat.register(compiler, '_hardSourceAfterFreezeGenerator', 'syncWaterfall', ['frozen', 'item', 'extra']);

    pluginCompat.register(compiler, '_hardSourceBeforeThawGenerator', 'syncWaterfall', ['item', 'frozen', 'extra']);
    pluginCompat.register(compiler, '_hardSourceThawGenerator', 'syncWaterfall', ['item', 'frozen', 'extra']);
    pluginCompat.register(compiler, '_hardSourceAfterThawGenerator', 'syncWaterfall', ['item', 'frozen', 'extra']);

    let methods;

    pluginCompat.tap(compiler, '_hardSourceMethods', 'HardGeneratorPlugin', _methods => {
      methods = _methods;
    });

    pluginCompat.tap(compiler, '_hardSourceFreezeGenerator', 'HardGeneratorPlugin freeze', (frozen, generator, extra) => {
      extra.schemas = GeneratorSchemas4;
      frozen = freezeGenerator(generator, extra, methods);
      frozen.moduleType = extra.module.type;
      frozen.options = {};
      return frozen;
    });

    pluginCompat.tap(compiler, '_hardSourceThawGenerator', 'HardGeneratorPlugin thaw', (generator, frozen, extra) => {
      return extra.normalModuleFactory.getGenerator(frozen.moduleType, frozen.options);
    });
  }
}

module.exports = HardGeneratorPlugin;
