var makeDevToolOptions = require('./devtool-options');

function removeRedundantSource(map, source, originalSource, cb) {
  var removedQuality = '';
  if (
    map &&
    map.sourcesContent &&
    (
      source.constructor.name === 'CachedSource' &&
      source._source.constructor.name === 'ReplaceSource' &&
      source._source._source._value ||
      source.constructor.name === 'ReplaceSource' &&
      source._source._value
    )
  ) {
    removedQuality = '';
    var _value = source._value ||
      source._source && source._source._value ||
      source._source && source._source._source &&
        source._source._source._value;

    if (map.sourcesContent[0] === _value) {
      removedQuality = 'transformed';
    } else if (map.sourcesContent[0] === originalSource) {
      removedQuality = 'original';
    }
    // else if (originalSource) {
    //   console.warn('unknown source content');
    // }
    // else {
    //   console.warn('unknown source content, unknown original source ' + (extra.module._source && extra.module._source.constructor.name));
    // }
    if (removedQuality) {
      map = Object.assign({}, map, {
        sourcesContent: []
      });
    }
  }
  cb(map, removedQuality);
}

function HardSourceMapPlugin() {}

HardSourceMapPlugin.prototype.apply = function(compiler) {
  var devtoolOptions = makeDevToolOptions(compiler.options);

  compiler.plugin('--hard-source-freeze-source-map', function(frozen, source, extra) {
    var originalSource = source._originalSource ||
      source._source && source._source._originalSource ||
      source._source && source._source._source &&
        source._source._source._originalSource;
    if (!originalSource && extra.module._source) {
      originalSource = originalSource && extra.module._source._originalSource;
    }

    var map;
    var removedQuality = '';

    var _map = devtoolOptions && source.map(devtoolOptions);
    removeRedundantSource(_map, source, originalSource, function(_map, _q) {
      map = _map;
      removedQuality = _q;
    });

    var baseMap;
    var baseMapRemovedQuality = '';

    var _baseMap = extra.module.useSourceMap && source.map();
    removeRedundantSource(_baseMap, source, originalSource, function(_map, _q) {
      baseMap = _map;
      baseMapRemovedQuality = _q;
    });

    return {
      originalSource: originalSource,

      mapRemovedQuality: removedQuality,
      map: map,
      // Some plugins (e.g. UglifyJs) set useSourceMap on a module. If that
      // option is set we should always store some source map info and
      // separating it from the normal devtool options may be necessary.
      baseMapRemovedQuality: baseMapRemovedQuality,
      baseMap: baseMap,
    };
  });
};

module.exports = HardSourceMapPlugin;
