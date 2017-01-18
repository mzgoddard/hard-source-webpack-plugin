import RawModule from 'webpack/lib/RawModule';
import {RawSource} from 'webpack-sources';
import {SourceNode} from 'source-map';
import {SourceMapConsumer} from 'source-map';
import {fromStringWithSourceMap} from 'source-list-map';
export default HardSource;

class HardSource extends RawSource {
  constructor(cacheItem) {
    super(cacheItem.source);
    this.cacheItem = cacheItem;
  }

  map(options) {
    return chooseMap(options, this.cacheItem);
  }

  node(options) {
    var node = SourceNode.fromStringWithSourceMap(
      this.cacheItem.source,
      new SourceMapConsumer(chooseMap(options, this.cacheItem))
    );
    var sources = Object.keys(node.sourceContents);
    for (var i = 0; i < sources.length; i++) {
      var key = sources[i];
      var content = node.sourceContents[key];
      delete node.sourceContents[key];
      SourceNode_setSourceContent.call(node, key, content);
    }
    return node;
  }

  listMap(options) {
    return fromStringWithSourceMap(
      this.cacheItem.source,
      chooseMap(options, this.cacheItem)
    );
  }
}

function chooseMap(options, cacheItem) {
  if (options && Object.keys(options).length) {
    return cacheItem.map;
  }
  else {
    return cacheItem.baseMap;
  }
}

// We need a function to help rehydrate source keys, webpack 1 uses source-map
// 0.4 which needs an appended $. webpack 2 uses source-map 0.5 which may append
// $. Either way setSourceContent will provide the needed behaviour. This is
// pretty round about and ugly but this is less prone to failure than trying to
// determine whether we're in webpack 1 or 2 and if they are using webpack-core
// or webpack-sources and the version of source-map in that.
var SourceNode_setSourceContent = new RawModule('')
.source().node().setSourceContent;
