var makeDevToolOptions = require('./devtool-options');

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
    var removedQuality = '';

    var map = devtoolOptions && source.map(devtoolOptions);
    if (
      map &&
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
      }
      else if (map.sourcesContent[0] === originalSource) {
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

    var baseMap = extra.module.useSourceMap && source.map();
    if (
      baseMap &&
      (
        source.constructor.name === 'CachedSource' &&
        source._source.constructor.name === 'ReplaceSource' &&
        source._source._source._value ||
        source.constructor.name === 'ReplaceSource' &&
        source._source._value
      )
    ) {
      baseMap = Object.assign({}, baseMap, {
        sourcesContent: []
      });
    }

    return {
      originalSource: originalSource,

      mapRemovedQuality: removedQuality,
      map: map,
      // Some plugins (e.g. UglifyJs) set useSourceMap on a module. If that
      // option is set we should always store some source map info and
      // separating it from the normal devtool options may be necessary.
      baseMap: baseMap,
    };
  });
};

module.exports = HardSourceMapPlugin;
