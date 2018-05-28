const relateContext = require('./util/relate-context');
const pluginCompat = require('./util/plugin-compat');

const SourceSchemas3 = [
  ['CachedSource', 'source'],
  ['ConcatSource'],
  ['LineToLineMappedSource', 'value', 'name', 'originalSource'],
  ['OriginalSource', 'value', 'name'],
  ['RawSource', 'value'],
  ['ReplaceSource', 'source', 'name'],
  [
    'SourceMapSource',
    'value',
    'name',
    'sourceMap',
    'originalSource',
    'innerSourceMap',
  ],
];

try {
  SourceSchemas3[0].Source = require('webpack-sources/lib/CachedSource');
} catch (_) {}
try {
  SourceSchemas3[1].Source = require('webpack-sources/lib/ConcatSource');
} catch (_) {}
try {
  SourceSchemas3[2].Source = require('webpack-sources/lib/LineToLineMappedSource');
} catch (_) {}
try {
  SourceSchemas3[3].Source = require('webpack-sources/lib/OriginalSource');
} catch (_) {}
try {
  SourceSchemas3[4].Source = require('webpack-sources/lib/RawSource');
} catch (_) {}
try {
  SourceSchemas3[5].Source = require('webpack-sources/lib/ReplaceSource');
} catch (_) {}
try {
  SourceSchemas3[6].Source = require('webpack-sources/lib/SourceMapSource');
} catch (_) {}

const freezeArgument = {
  value(arg, { _value }, extra, methods) {
    return _value;
  },
  name(arg, { _name }, { compilation }, methods) {
    try {
      return relateContext.relateNormalPath(compilation.compiler, _name);
    } catch (e) {
      console.error(e.stack);
      process.exit();
    }
  },
  sourceMap(arg, { _sourceMap }, extra, methods) {
    return _sourceMap;
  },
  originalSource(arg, { _originalSource }, extra, methods) {
    return _originalSource;
  },
  innerSourceMap(arg, { _innerSourceMap }, extra, methods) {
    return _innerSourceMap;
  },
  source(arg, { constructor, _source }, extra, methods) {
    if (constructor.name === 'ReplaceSource') {
      return;
    }
    return methods.freeze('Source', null, _source, extra);
  },
};

const thawArgument = {
  name(arg, source, { compilation }, methods) {
    try {
      return relateContext.contextNormalPath(compilation.compiler, arg);
    } catch (e) {
      console.error(e.stack);
      process.exit();
    }
  },
  source(arg, { type }, extra, methods) {
    if (type === 'ReplaceSource') {
      return extra.source;
    }
    return methods.thaw('Source', null, arg, extra);
  },
  value(arg, frozen, extra, methods) {
    if (arg && arg.type === 'Buffer') {
      return new Buffer(arg.data);
    }
    return arg;
  },
};

function freezeSource(source, extra, methods) {
  const schemas = extra.schemas;
  for (let i = 0; i < schemas.length; i++) {
    if (source.constructor.name === schemas[i].Source.name) {
      const frozen = {
        type: schemas[i][0],
      };
      for (let j = 1; j < schemas[i].length; j++) {
        let arg = source[schemas[i][j]];
        if (freezeArgument[schemas[i][j]]) {
          arg = freezeArgument[schemas[i][j]](arg, source, extra, methods);
        }
        frozen[schemas[i][j]] = arg;
      }
      return frozen;
    }
  }

  throw new Error(`Unfrozen ${source.constructor.name}.`);
}

function thawSource(frozen, extra, methods) {
  const schemas = extra.schemas;
  for (let i = 0; i < schemas.length; i++) {
    if (frozen.type === schemas[i][0]) {
      const Source = schemas[i].Source;
      const args = [];
      for (let j = 1; j < schemas[i].length; j++) {
        let arg = frozen[schemas[i][j]];
        if (thawArgument[schemas[i][j]]) {
          arg = thawArgument[schemas[i][j]](arg, frozen, extra, methods);
        }
        args.push(arg);
      }
      try {
        return new Source(...args);
      } catch (_) {
        return new (Function.prototype.bind.apply(
          Source,
          [null].concat(args),
        ))();
      }
    }
  }
}

class TransformSourcePlugin {
  apply(compiler) {
    let methods;

    pluginCompat.tap(
      compiler,
      '_hardSourceMethods',
      'TransformSourcePlugin',
      _methods => {
        methods = _methods;
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceFreezeSource',
      'TransformSourcePlugin freeze',
      (frozen, source, extra) => {
        if (typeof source === 'string') {
          return {
            type: 'String',
            value: source,
          };
        } else if (Buffer.isBuffer && Buffer.isBuffer(source)) {
          // Serialization layer might transform it into JSON or handle it as binary
          // data
          return source;
        }

        extra.schemas = SourceSchemas3;
        frozen = freezeSource(source, extra, methods);
        if (frozen.type === 'ReplaceSource') {
          frozen.replacements = source.replacements;
        } else if (frozen.type === 'CachedSource') {
          frozen.cachedSource = source._cachedSource;
          frozen.cachedSize = source._cachedSize;
          frozen.cachedMaps = source._cachedMaps;
        } else if (frozen.type === 'ConcatSource') {
          frozen.children = methods.mapFreeze(
            'Source',
            null,
            source.children,
            extra,
          );
        }
        return frozen;
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceThawSource',
      'TransformSourcePlugin thaw',
      (source, frozen, extra) => {
        if (frozen.type === 'String') {
          return frozen.value;
        } else if (frozen.type === 'Buffer') {
          return new Buffer(frozen.data);
        } else if (Buffer.isBuffer && Buffer.isBuffer(frozen)) {
          return frozen;
        }

        extra.schemas = SourceSchemas3;
        source = thawSource(frozen, extra, methods);
        if (frozen.type === 'ReplaceSource') {
          source.replacements = frozen.replacements;
        } else if (frozen.type === 'CachedSource') {
          source._cachedSource = frozen.cachedSource;
          source._cachedSize = frozen.cachedSize;
          source._cachedMaps = frozen.cachedMaps;
        } else if (frozen.type === 'ConcatSource') {
          source.children = methods.mapThaw(
            'Source',
            null,
            frozen.children,
            extra,
          );
        }
        return source;
      },
    );
  }
}

module.exports = TransformSourcePlugin;
