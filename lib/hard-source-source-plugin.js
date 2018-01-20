const SourceSchemas3 = [
  ['RawSource', 'value'],
  ['OriginalSource', 'value', 'name'],
  ['SourceMapSource', 'value', 'name', 'sourceMap', 'originalSource', 'innerSourceMap'],
  ['LineToLineMappedSource', 'value', 'name', 'originalSource'],
];

try {
  SourceSchemas3[0].Source = require('webpack-sources/lib/RawSource');
} catch (_) {}
try {
  SourceSchemas3[1].Source = require('webpack-sources/lib/OriginalSource');
} catch (_) {}
try {
  SourceSchemas3[2].Source = require('webpack-sources/lib/SourceMapSource');
} catch (_) {}
try {
  SourceSchemas3[3].Source = require('webpack-sources/lib/LineToLineMappedSource');
} catch (_) {}

const freezeArgument = {
  value: function(arg, block, extra, methods) {
    return block._value;
  },
  name: function(arg, block, extra, methods) {
    return block._name;
  },
  sourceMap: function(arg, block, extra, methods) {
    return block._sourceMap;
  },
  originalSource: function(arg, block, extra, methods) {
    return block._originalSource;
  },
  innerSourceMap: function(arg, block, extra, methods) {
    return block._innerSourceMap;
  },
};

const thawArgument = {
};

function freezeSource(source, extra, methods) {
  var schemas = extra.schemas;
  for (let i = 0; i < schemas.length; i++) {
    if (source.constructor === schemas[i].Source) {
      var frozen = {
        type: schemas[i][0],
      };
      for (let j = 1; j < schemas[i].length; j++) {
        var arg = source[schemas[i][j]];
        if (freezeArgument[schemas[i][j]]) {
          arg = freezeArgument[schemas[i][j]](arg, source, extra, methods);
        }
        frozen[schemas[i][j]] = arg;
      }
      return frozen;
    }
  }
  console.log(source.constructor.name);
}

function thawSource(frozen, extra, methods) {
  var schemas = extra.schemas;
  for (let i = 0; i < schemas.length; i++) {
    if (frozen.type === schemas[i][0]) {
      var Source = schemas[i].Source;
      var args = [];
      for (let j = 1; j < schemas[i].length; j++) {
        var arg = frozen[schemas[i][j]];
        if (thawArgument[schemas[i][j]]) {
          arg = thawArgument[schemas[i][j]](arg, frozen, extra, methods);
        }
        args.push(arg);
      }
      try {
        return new (Function.prototype.bind.apply(A, [null].concat(args)))();
      } catch (_) {
        return eval('new Source(...args)');
      }
    }
  }
  console.log(frozen.type);
}

function HardSourceSourcePlugin() {}

HardSourceSourcePlugin.prototype.apply = function(compiler) {
  var methods;

  compiler.plugin('--hard-source-methods', function(_methods) {
    methods = _methods;
  });

  compiler.plugin('--hard-source-freeze-source', function(frozen, variable, extra) {
    extra.schemas = SourceSchemas3;
    return freezeSource(variable, extra, methods);
  });

  compiler.plugin('--hard-source-thaw-source', function(variable, frozen, extra) {
    extra.schemas = SourceSchemas3;
    return thawSource(frozen, extra, methods);
  });
};

module.exports = HardSourceSourcePlugin;
