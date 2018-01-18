var RawModule = require('webpack/lib/RawModule');

var RawSource = require('webpack-sources').RawSource;

var SourceNode = require('source-map').SourceNode;
var SourceMapConsumer = require('source-map').SourceMapConsumer;

var fromStringWithSourceMap = require('source-list-map').fromStringWithSourceMap;

module.exports = HardSource;

function HardSource(cacheItem) {
  Object.setPrototypeOf(this,
    Object.setPrototypeOf(
      new RawSource(cacheItem.source),
      HardSource.prototype
    )
  );

  // RawSource.call(this, cacheItem.source);
  this.cacheItem = cacheItem;
}
HardSource.prototype = Object.create(RawSource.prototype);
HardSource.prototype.constructor = HardSource;

function fixWebpack1MissingFile(map) {
  if (!map.file) {
    // Copy, delete, and reassign the keys so the object has the keys in the
    // proper order and when stringified will create an identical object to the
    // previous builds.
    var clone = {
      version: map.version,
      file: map.file,
      sources: map.sources,
      sourcesContent: map.sourcesContent,
      mappings: map.mappings,
    };
    delete map.version;
    delete map.file;
    delete map.sources;
    delete map.sourcesContent;
    delete map.mappings;
    Object.assign(map, clone);
  }
}

function setRedundantSource(map, mapRemovedQuality, cacheItem) {
  if (
    map.sourcesContent &&
    map.sourcesContent.length === 0
  ) {
    if (mapRemovedQuality === 'original') {
      map.sourcesContent = [cacheItem.sourceMap.originalSource];
    }
    else {
      map.sourcesContent = [cacheItem.rawSource];
    }
  }
}

function chooseMap(options, cacheItem) {
  if (cacheItem.sourceMap.map && (
      options && Object.keys(options).length ||
      !cacheItem.sourceMap.baseMap
  )) {
    fixWebpack1MissingFile(cacheItem.sourceMap.map);
    setRedundantSource(
      cacheItem.sourceMap.map,
      cacheItem.sourceMap.mapRemovedQuality,
      cacheItem
    );
    return cacheItem.sourceMap.map;
  }
  else if (cacheItem.sourceMap.baseMap) {
    fixWebpack1MissingFile(cacheItem.sourceMap.baseMap);
    setRedundantSource(
      cacheItem.sourceMap.baseMap,
      cacheItem.sourceMap.baseMapRemovedQuality,
      cacheItem
    );
    return cacheItem.sourceMap.baseMap;
  }
}

HardSource.prototype.sourceAndMap = function(options) {
  return {
    source: this.source(),
    map: this.map(options)
  };
};

HardSource.prototype.map = function(options) {
  var mapId = JSON.stringify(options);
  if (!this._cachedMap) {
    this._cachedMap = {};
  }
  if (!this._cachedMap[mapId]) {
    this._cachedMap[mapId] = chooseMap(options, this.cacheItem);
  }
  return this._cachedMap[mapId];
};

// We need a function to help rehydrate source keys, webpack 1 uses source-map
// 0.4 which needs an appended $. webpack 2 uses source-map 0.5 which may append
// $. Either way setSourceContent will provide the needed behaviour. This is
// pretty round about and ugly but this is less prone to failure than trying to
// determine whether we're in webpack 1 or 2 and if they are using webpack-core
// or webpack-sources and the version of source-map in that.
var SourceNode_setSourceContent = new RawModule('')
.source().node().setSourceContent;

HardSource.prototype.node = function(options) {
  var mapId = JSON.stringify(options);
  if (!this._cachedMapNode) {
    this._cachedMapNode = {};
  }
  if (!this._cachedMapNode[mapId]) {
    var node = SourceNode.fromStringWithSourceMap(
      this.cacheItem.source,
      new SourceMapConsumer(this.map(options))
    );
    var sources = Object.keys(node.sourceContents);
    for (var i = 0; i < sources.length; i++) {
      var key = sources[i];
      var content = node.sourceContents[key];
      delete node.sourceContents[key];
      SourceNode_setSourceContent.call(node, key, content);
    }
    this._cachedMapNode[mapId] = node;
  }
  return this._cachedMapNode[mapId];
};

HardSource.prototype.listMap = function(options) {
  var mapId = JSON.stringify(options);
  if (!this._cachedListMap) {
    this._cachedListMap = {};
  }
  if (!this._cachedListMap[mapId]) {
    this._cachedListMap[mapId] = fromStringWithSourceMap(
      this.cacheItem.source,
      this.map(options)
    );
  }
  return this._cachedListMap[mapId];
};
