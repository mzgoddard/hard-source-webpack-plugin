const relateContext = require('./util/relate-context');
const pluginCompat = require('./util/plugin-compat');

const ParserSchemas3 = [
  ['Parser', 'options'],
];
const ParserSchemas4 = [
  ['Parser', 'options', 'sourceType'],
];

try {
  ParserSchemas3[0].Parser = require('webpack/lib/Parser');
  ParserSchemas4[0].Parser = require('webpack/lib/Parser');
} catch (_) {}

const freezeArgument = {
};

const thawArgument = {
};

function freezeParser(parser, extra, methods) {
  const schemas = extra.schemas;
  for (let i = 0; i < schemas.length; i++) {
    if (parser.constructor === schemas[i].Parser) {
      const frozen = {
        type: schemas[i][0],
      };
      for (let j = 1; j < schemas[i].length; j++) {
        let arg = parser[schemas[i][j]];
        if (freezeArgument[schemas[i][j]]) {
          arg = freezeArgument[schemas[i][j]](arg, parser, extra, methods);
        }
        frozen[schemas[i][j]] = arg;
      }
      return frozen;
    }
  }
}

function thawParser(frozen, extra, methods) {
  const schemas = extra.schemas;
  for (let i = 0; i < schemas.length; i++) {
    if (frozen.type === schemas[i][0]) {
      const Parser = schemas[i].Parser;
      const args = [];
      for (let j = 1; j < schemas[i].length; j++) {
        let arg = frozen[schemas[i][j]];
        if (thawArgument[schemas[i][j]]) {
          arg = thawArgument[schemas[i][j]](arg, frozen, extra, methods);
        }
        args.push(arg);
      }
      try {
        return new Parser(...args);
      } catch (_) {
        return new (Function.prototype.bind.apply(Parser, [null].concat(args)))();
      }
    }
  }
}

class HardParserPlugin {
  constructor(options) {
    this.options = options || {};
  }

  apply(compiler) {
    const schema = this.options.schema;
    let schemas = ParserSchemas4;
    if (schema < 4) {
      schemas = ParserSchemas3;
    }

    pluginCompat.register(compiler, '_hardSourceBeforeFreezeParser', 'syncWaterfall', ['frozen', 'item', 'extra']);
    pluginCompat.register(compiler, '_hardSourceFreezeParser', 'syncWaterfall', ['frozen', 'item', 'extra']);
    pluginCompat.register(compiler, '_hardSourceAfterFreezeParser', 'syncWaterfall', ['frozen', 'item', 'extra']);

    pluginCompat.register(compiler, '_hardSourceBeforeThawParser', 'syncWaterfall', ['item', 'frozen', 'extra']);
    pluginCompat.register(compiler, '_hardSourceThawParser', 'syncWaterfall', ['item', 'frozen', 'extra']);
    pluginCompat.register(compiler, '_hardSourceAfterThawParser', 'syncWaterfall', ['item', 'frozen', 'extra']);

    let methods;

    pluginCompat.tap(compiler, '_hardSourceMethods', 'HardParserPlugin', _methods => {
      methods = _methods;
    });

    pluginCompat.tap(compiler, '_hardSourceFreezeParser', 'HardParserPlugin freeze', (frozen, parser, extra) => {
      extra.schemas = schemas;
      frozen = freezeParser(parser, extra, methods);
      if (schema === 4) {
        frozen.moduleType = extra.module.type;
      }
      return frozen;
    });

    pluginCompat.tap(compiler, '_hardSourceThawParser', 'HardParserPlugin thaw', (parser, frozen, extra) => {
      if (schema < 4) {
        return extra.normalModuleFactory.getParser(frozen.options);
      }
      else {
        return extra.normalModuleFactory.getParser(frozen.moduleType, frozen.options);
      }
    });
  }
}

module.exports = HardParserPlugin;
