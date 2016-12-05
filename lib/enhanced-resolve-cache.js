module.exports = EnhancedResolveCache;

function EnhancedResolveCache() {
  this._new = {};
  this._old = {};
  this._raw = {};
  this._rawMissing = {};

  this.load = this.load.bind(this);
}

EnhancedResolveCache.prototype.get = function(group, context, request) {};

EnhancedResolveCache.prototype.getResult = function(group, context, request) {
  return (
    this._raw[group] &&
    this._raw[group][context] &&
    this._raw[group][context][request]
  );
};

EnhancedResolveCache.prototype.getMissing = function(group, context, result) {
  return (
    this._rawMissing[group] &&
    this._rawMissing[group][context] &&
    this._rawMissing[group][context][result]
  );
};

EnhancedResolveCache.prototype.set = function(group, context, request, result, missing) {
  if (!this._raw[group]) {this._raw[group] = {};}
  if (!this._raw[group][context]) {this._raw[group][context] = {};}

  if (!this._rawMissing[group]) {this._rawMissing[group] = {};}
  if (!this._rawMissing[group][context]) {this._rawMissing[group][context] = {};}

  if (!this._raw[group][context][request]) {
    if (!this._new[group]) {this._new[group] = {};}
    if (!this._new[group][context]) {this._new[group][context] = {};}
    this._new[group][context][request] = {
      result: result,
      missing: missing,
    };
  }
  if (this._old[group] && this._old[group][context] && this._old[group][context][request]) {
    this._old[group][context][request] = false;
  }

  this._raw[group][context][request] = result;
  this._rawMissing[group][context][result] = missing;
};

EnhancedResolveCache.prototype.invalidate = function(group, context, request) {
  // console.log('invalid', group, context, request);
  if (this._raw[group][context][request]) {
    if (!this._old[group]) {this._old[group] = {};}
    if (!this._old[group][context]) {this._old[group][context] = {};}
    this._old[group][context][request] = true;
    if (this._new[group] && this._new[group][context] && this._new[group][context][request]) {
      this._new[group][context][request] = null;
    }
    var result = this._raw[group][context][request];
    this._raw[group][context][request] = null;
    this._rawMissing[group][context][result] = null;
  }
};

EnhancedResolveCache.prototype.forEach = function(handle, ctx) {
  var group, context, request;
  var _this = this;
  var item = {
    _group: null, group: function() {return this._group;},
    _context: null, context: function() {return this._context;},
    _raw: this._raw,
    _rawMissing: this._rawMissing,
    request: function() {return request;},
    result: function() {
      return this._raw[this._group][this._context][request];
    },
    missing: function() {
      return this._rawMissing[this._group][this._context][this.result()];
    },
  };
  for (group in this._raw) {
    item._group = group;
    for (context in this._raw[group]) {
      item._context = context;
      for (request in this._raw[group][context]) {
        if (this._raw[group][context][request]) {
          handle.call(ctx, item);
        }
      }
    }
  }
};

EnhancedResolveCache.prototype.reset = function() {
  this._new = {};
  this._old = {};
  this._raw = {};
  this._rawMissing = {};
};

EnhancedResolveCache.prototype.load = function(data) {
  this.reset();
  for (var key in data) {
    var keyParts = JSON.parse(key);
    var group = keyParts[0];
    var context = keyParts[1];
    var request = keyParts[2];
    if (!this._raw[group]) {this._raw[group] = {};}
    if (!this._raw[group][context]) {this._raw[group][context] = {};}

    if (!this._rawMissing[group]) {this._rawMissing[group] = {};}
    if (!this._rawMissing[group][context]) {this._rawMissing[group][context] = {};}

    var value = JSON.parse(data[key]);
    var result = value.result;
    var missing = value.missing;

    this._raw[group][context][request] = result;
    this._rawMissing[group][context][result] = missing;
  }
};

EnhancedResolveCache.prototype.save = function() {
  var ops = [];
  for (var group in this._new) {
    for (var context in this._new[group]) {
      for (var request in this._new[group][context]) {
        if (this._new[group][context][request]) {
          ops.push({
            key: JSON.stringify([group, context, request]),
            value: JSON.stringify(this._new[group][context][request]),
          });
        }
      }
    }
  }
  this._new = {};
  for (var group in this._old) {
    for (var context in this._old[group]) {
      for (var request in this._old[group][context]) {
        if (this._old[group][context][request]) {
          ops.push({
            key: JSON.stringify([group, context, request]),
            value: null,
          });
        }
      }
    }
  }
  this._old = {};
  return ops;
};

EnhancedResolveCache.prototype.bustOldItems = function(fs, stats, lastBuild) {
  var handles = [];
  var _this = this;
  _this.forEach(function(item) {
    var group = item.group();
    var context = item.context();
    var request = item.request();
    var result = item.result();

    if (!stats[result]) {stats[result] = fs.stat(result);}
    handles.push(stats[result]
    .then(function(stat) {
      if (
        ['normal', 'loader'].indexOf(group) !== -1 && stat.isDirectory() ||
        group === 'context' && stat.isFile()
      ) {
        _this.invalidate(group, context, request);
      }
    })
    .catch(function() {
      _this.invalidate(group, context, request);
    }));

    if (lastBuild) {return;}

    item.missing().forEach(function(missed) {
      var missedPath = missed;
      if (typeof missed === 'object') {
        missedPath = missed.path;
      }
      if (!stats[missedPath]) {stats[missedPath] = fs.stat(missedPath);}
      handles.push(stats[missedPath]
      .then(function(stat) {
        if (typeof missed === 'object') {
          if (
            missed.type === 'directory' && stat.isFile() ||
            missed.type === 'file' && stat.isDirectory()
          ) {
            _this.invalidate(group, context, request);
          }
        }
        else {
          _this.invalidate(group, context, request);
        }
      })
      .catch(function() {}));
    });
  });
  return Promise.all(handles);
};
