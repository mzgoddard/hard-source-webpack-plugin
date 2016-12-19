var cachePrefix = require('./util').cachePrefix;

module.exports = SourceCache;

function SourceCache() {
  this._cache = {};
  this._new = [];

  this.load = this.load.bind(this);
}

SourceCache.prototype.initModuleItem = function(compilation, module) {
  if (module.source) {return module;}

  var identifierPrefix = cachePrefix(compilation);
  if (identifierPrefix === null) {
    return;
  }
  var identifier = identifierPrefix + module.identifier;

  var item = this._cache[identifier];

  module.rawSource = item.rawSource;
  module.source = item.source;
  module.map = item.map;
  module.baseMap = item.baseMap;
  module.hashContent = item.hashContent;

  return module;
};

function serializeHashContent(module) {
  var content = [];
  module.updateHash({
    update: function(str) {
      content.push(str);
    },
  });
  return content.join('');
}

SourceCache.prototype.setModule = function(compilation, devtool, module) {
  var identifierPrefix = cachePrefix(compilation);
  if (identifierPrefix === null) {
    return;
  }
  var identifier = identifierPrefix + module.identifier();

  var source = module.source(
    compilation.dependencyTemplates,
    compilation.moduleTemplate.outputOptions,
    compilation.moduleTemplate.requestShortener
  );

  this._cache[identifier] = {
    rawSource: module._source ? module._source.source() : null,
    source: source.source(),
    hashContent: serializeHashContent(module),

    map: devtool && source.map(devtool),
    // Some plugins (e.g. UglifyJs) set useSourceMap on a module. If that
    // option is set we should always store some source map info and
    // separating it from the normal devtool options may be necessary.
    baseMap: module.useSourceMap && source.map(),
  };

  this._new.push(identifier);
};

SourceCache.prototype.reset = function() {
  this._cache = {};
  this._new.length = 0;
};

function join(a, b) {
  return a + ',' + b;
}

function split(a) {
  var i = a.indexOf(',');
  if (i !== -1) {
    return [a.substring(0, i), a.substring(i + 1)];
  }
  return [a];
}

SourceCache.prototype.load = function(data) {
  var _this = this;
  _this._cache = {};

  Object.keys(data).forEach(function(key) {
    var keySplit = split(key);
    var itemKey = keySplit[0];
    var identifier = keySplit[1];

    if (!_this._cache[identifier]) {
      _this._cache[identifier] = {};
    }
    if (data[key][0] === '{') {
      _this._cache[identifier][itemKey] = JSON.parse(data[key]);
    }
    else {
      _this._cache[identifier][itemKey] = data[key];
    }
  });
};

SourceCache.prototype.save = function() {
  var ops = [];

  var _this = this;
  _this._new.forEach(function(identifier) {
    var item = _this._cache[identifier];
    ['rawSource', 'source', 'hashContent'].forEach(function(key) {
      if (item[key] === null) {return;}
      ops.push({
        key: join(key, identifier),
        value: item[key],
      });
    });
    ['map', 'baseMap'].forEach(function(key) {
      if (!item[key]) {return;}
      ops.push({
        key: join(key, identifier),
        value: JSON.stringify(item[key]),
      });
    });
  });

  _this._new.length = 0;

  return ops;
};
