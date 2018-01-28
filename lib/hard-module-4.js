const path = require('path');

const OldHardModule = require('./hard-module');

const {
  contextNormalPathSet,
} = require('./util/relate-context');

class HardModule extends OldHardModule {
  constructor(cacheItem, compilation, fileMd5s, cachedMd5s) {
    super(cacheItem, compilation, fileMd5s, cachedMd5s);
    const compiler = compilation.compiler;
    const thaw = compilation.__hardSourceMethods.thaw;

    this.type = cacheItem.moduleType;
    this.generator = thaw('Generator', null, cacheItem.generator, {
      module: this,
      compilation: compilation,
    });

    this.buildMeta = cacheItem.buildMeta;
    this.buildInfo = {
      cacheable: true,
      fileDependencies: contextNormalPathSet(compiler, cacheItem.buildInfo.fileDependencies),
      contextDependencies: contextNormalPathSet(compiler, cacheItem.buildInfo.contextDependencies),
      harmonyModule: cacheItem.buildInfo.harmonyModule,
      strict: cacheItem.buildInfo.strict,
      exportsArgument: cacheItem.buildInfo.exportsArgument,
    };
  }

  get fileDependencies() {
    return this.buildInfo.fileDependencies;
  }

  set fileDependencies(value) {
    this.buildInfo.fileDependencies = value;
  }

  get contextDependencies() {
    return this.buildInfo.contextDependencies;
  }

  set contextDependencies(value) {
    this.buildInfo.contextDependencies = value;
  }

  libIdent(options) {
    return contextify(options, this.userRequest);
  }

  originalSource() {
    return this._source;
  }
}

// From webpack/lib/NormalModule.js
function contextify(options, request) {
  return request.split("!").map(r => {
    let rp = path.relative(options.context, r);
    if(path.sep === "\\")
      rp = rp.replace(/\\/g, "/");
    if(rp.indexOf("../") !== 0)
      rp = "./" + rp;
    return rp;
  }).join("!");
}

module.exports = HardModule;
