import path from 'path';
import AsyncDependenciesBlock from 'webpack/lib/AsyncDependenciesBlock';
import DependenciesBlockVariable from 'webpack/lib/DependenciesBlockVariable';
import RawModule from 'webpack/lib/RawModule';
import ModuleError from 'webpack-core/lib/ModuleError';
import ModuleWarning from 'webpack-core/lib/ModuleWarning';
import {RawSource} from 'webpack-sources';
import deserializeDependencies from './deserialize-dependencies';
import HardSource from './hard-source';
export default HardModule;

class HardModule extends RawModule {
  constructor(cacheItem) {
    super(cacheItem.source, cacheItem.identifier, cacheItem.userRequest);

    this.cacheItem = cacheItem;

    this.request = cacheItem.request;
    this.userRequest = cacheItem.userRequest;
    this.rawRequest = cacheItem.rawRequest;
    this.resource = cacheItem.resource;
    this.context = cacheItem.context;
    this.loaders = cacheItem.loaders;

    this.strict = cacheItem.strict;
    this.meta = cacheItem.meta;
    this.buildTimestamp = cacheItem.buildTimestamp;
    this.fileDependencies = cacheItem.fileDependencies;
    this.contextDependencies = cacheItem.contextDependencies;
  }

  isHard() {
    return true;
  }

  needRebuild(fileTimestamps, contextTimestamps) {
    return this.cacheItem.invalid || needRebuild(this.cacheItem, this.fileDependencies, this.contextDependencies, fileTimestamps, contextTimestamps);
  }

  source() {
    return this._renderedSource;
  }

  updateHash(hash) {
    hash.update(this.cacheItem.hashContent);
  }

  libIdent(options) {
    return contextify(options, this.userRequest);
  }

  build(options, compilation, resolver, fs, callback) {
    // Non-rendered source used by Stats.
    if (this.cacheItem.rawSource) {
      this._source = new RawSource(this.cacheItem.rawSource);
    }
    // Rendered source used in built output.
    this._renderedSource = new HardSource(this.cacheItem);

    var state = {state: {imports: {}}};
    this.dependencies = deserializeDependencies.dependencies.call(state, this.cacheItem.dependencies, this);
    this.variables = deserializeDependencies.variables.call(state, this.cacheItem.variables, this);
    this.warnings = this.cacheItem.warnings.map(deserializeError(ModuleWarning, state), this);
    this.errors = this.cacheItem.errors.map(deserializeError(ModuleError, state), this);
    deserializeDependencies.blocks.call(state, this.cacheItem.blocks, this);

    var cacheItem = this.cacheItem;
    this.assets = Object.keys(cacheItem.assets).reduce((carry, key) => {
      var source = cacheItem.assets[key];
      if (source.type === 'Buffer') {
        source = new Buffer(source);
      }
      carry[key] = new RawSource(source);
      return carry;
    }, {});

    callback();
  }
}

function needRebuild(cacheItem, fileDependencies, contextDependencies, fileTimestamps, contextTimestamps, fileMd5s, cachedMd5s) {
  var timestamp = 0;
  var buildTimestamp = cacheItem.buildTimestamp;
  var needsMd5Rebuild = !(fileMd5s && cachedMd5s);

  if (fileDependencies) {
    fileDependencies.forEach(file => {
      if (!needsMd5Rebuild) {
        needsMd5Rebuild = cachedMd5s[file] !== fileMd5s[file] || !cachedMd5s[file];
      }
      var ts = fileTimestamps[file];
      if(!ts) timestamp = Infinity;
      if(ts > timestamp) timestamp = ts;
    });
  }
  if (contextDependencies) {
    contextDependencies.forEach(context => {
      if (!needsMd5Rebuild) {
        needsMd5Rebuild = cachedMd5s[context] !== fileMd5s[context] || !cachedMd5s[context];
      }
      var ts = contextTimestamps[context];
      if(!ts) timestamp = Infinity;
      if(ts > timestamp) timestamp = ts;
    });
  }
  if (needsMd5Rebuild && fileMd5s && cachedMd5s) {
    cacheItem.invalid = true;
  }
  return (
    cacheItem.invalid ||
    timestamp >= buildTimestamp && needsMd5Rebuild ||
    needsMd5Rebuild && fileMd5s && cachedMd5s
  );
}

HardModule.needRebuild = needRebuild;

// HardModule.prototype.libIdent = function(options) {
//   return this.cacheItem.libIdent;
// };

// From webpack/lib/NormalModule.js
function contextify(options, request) {
  return request.split("!").map(r => {
    var rp = path.relative(options.context, r);
    if(path.sep === "\\")
      rp = rp.replace(/\\/g, "/");
    if(rp.indexOf("../") !== 0)
      rp = `./${rp}`;
    return rp;
  }).join("!");
}

// HardModule.prototype.isUsed = function(exportName) {
//   return exportName ? exportName : false;
// };

function deserializeError(ErrorClass, state) {
  return function(serialized) {
    var err = new ErrorClass(this, serialized.message);
    if (serialized.origin) {
      err.origin = deserializeDependencies.dependencies.call(state, [serialized.origin], this)[0];
    }
    if (serialized.dependencies) {
      err.dependencies = deserializeDependencies.dependencies.call(state, serialized.dependencies, this);
    }
    return err;
  };
}
