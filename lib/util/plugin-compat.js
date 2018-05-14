var hookTypes;

var callStyles = {
  sync: 'applyPlugins',
  syncWaterfall: 'applyPluginsWaterfall',
  syncBail: 'applyPluginsBailResult',
  sync_map: 'applyPlugins',
  asyncWaterfall: 'applyPluginsAsyncWaterfall',
  asyncParallel: 'applyPluginsParallelAsync',
  asyncSerial: 'applyPluginsAsync',
};

var camelToDash = function(camel) {
  return camel.replace(/_/g, '--').replace(/[A-Z]/g, function(c) {
    return '-' + c.toLowerCase();
  });
};

var knownPluginRegistrations = {
  Compilation: {
    needAdditionalPass: ['sync', []],
    succeedModule: ['sync', ['module']]
  },
  Compiler: {
    afterEnvironment: ['sync', []],
    afterPlugins: ['sync', []],
    afterResolvers: ['sync', []],
    compilation: ['sync', ['compilation', 'params']],
    watchRun: ['asyncSerial', ['watcher']],
    run: ['asyncSerial', ['compiler']],
  },
  NormalModuleFactory: {
    createModule: ['syncBail', ['data']],
    parser: ['sync_map)', ['parser', 'parserOptions']],
    resolver: ['syncWaterfall', ['nextResolver']],
  },
  ContextModuleFactory: {
    afterResolve: ['asyncWaterfall', ['data']],
  },
};

exports.register = function(tapable, name, style, args) {
  if (tapable.hooks) {
    if (!hookTypes) {
      var Tapable = require('tapable');
      hookTypes = {
        sync: Tapable.SyncHook,
        syncWaterfall: Tapable.SyncWaterfallHook,
        syncBail: Tapable.SyncBailHook,
        asyncWaterfall: Tapable.AsyncWaterfallHook,
        asyncParallel: Tapable.AsyncParallelHook,
      };
    }
    if (!tapable.hooks[name]) {
      tapable.hooks[name] = new (hookTypes[style])(args);
    }
  }
  else {
    if (!tapable.__hardSource_hooks) {
      tapable.__hardSource_hooks = {};
    }
    if (!tapable.__hardSource_hooks[name]) {
      tapable.__hardSource_hooks[name] = {
        name: name,
        dashName: camelToDash(name),
        style: style,
        args: args,
        async: style.startsWith('async'),
        map: style.endsWith('_map'),
      };
    }
    if (!tapable.__hardSource_proxy) {
      tapable.__hardSource_proxy = {};
    }
    if (!tapable.__hardSource_proxy[name]) {
      if (tapable.__hardSource_hooks[name].map) {
        const _forCache = {};
        tapable.__hardSource_proxy[name] = {
          _forCache,
          for: key => {
            let hook = _forCache[key];
            if (hook) {
              return hook;
            }
            _forCache[key] = {
              tap: (...args) => exports.tapFor(tapable, name, key, ...args),
              tapPromise: (...args) => exports.tapPromiseFor(tapable, name, key, ...args),
              call: (...args) => exports.callFor(tapable, name, key, ...args),
              promise: (...args) => exports.promiseFor(tapable, name, key, ...args),
            };
            return _forCache[key]
          },
          tap: (...args) => exports.tapFor(tapable, name, ...args),
          tapPromise: (...args) => exports.tapPromiseFor(tapable, name, ...args),
          call: (...args) => exports.callFor(tapable, name, ...args),
          promise: (...args) => exports.promiseFor(tapable, name, ...args),
        };
      }
      else {
        tapable.__hardSource_proxy[name] = {
          tap: (...args) => exports.tap(tapable, name, ...args),
          tapPromise: (...args) => exports.tapPromise(tapable, name, ...args),
          call: (...args) => exports.call(tapable, name, ...args),
          promise: (...args) => exports.promise(tapable, name, ...args),
        };
      }
    }
  }
};

exports.tap = function(tapable, name, reason, callback) {
  if (tapable.hooks) {
    tapable.hooks[name].tap(reason, callback);
  }
  else {
    if (!tapable.__hardSource_hooks || !tapable.__hardSource_hooks[name]) {
      var registration = knownPluginRegistrations[tapable.constructor.name][name];
      exports.register(tapable, name, registration[0], registration[1]);
    }
    var dashName = tapable.__hardSource_hooks[name].dashName;
    if (tapable.__hardSource_hooks[name].async) {
      tapable.plugin(dashName, (...args) => {
        const cb = args.pop();
        cb(null, callback(...args));
      });
    }
    else {
      tapable.plugin(dashName, callback);
    }
  }
};

exports.tapPromise = function(tapable, name, reason, callback) {
  if (tapable.hooks) {
    tapable.hooks[name].tapPromise(reason, callback);
  }
  else {
    if (!tapable.__hardSource_hooks || !tapable.__hardSource_hooks[name]) {
      var registration = knownPluginRegistrations[tapable.constructor.name][name];
      exports.register(tapable, name, registration[0], registration[1]);
    }
    var dashName = tapable.__hardSource_hooks[name].dashName;
    tapable.plugin(dashName, (...args) => {
      const cb = args.pop();
      return callback(...args)
      .then(value => cb(null, value), cb);
    });
  }
};

exports.call = function(tapable, name, args) {
  if (tapable.hooks) {
    var hook = tapable.hooks[name];
    return hook.call.apply(hook, args);
  }
  else {
    var dashName = tapable.__hardSource_hooks[name].dashName;
    var style = tapable.__hardSource_hooks[name].style;
    return tapable[callStyles[style]].apply(tapable, [dashName].concat(args));
  }
};

exports.promise = function(tapable, name, args) {
  if (tapable.hooks) {
    var hook = tapable.hooks[name];
    return hook.promise.apply(hook, args);
  }
  else {
    var dashName = tapable.__hardSource_hooks[name].dashName;
    var style = tapable.__hardSource_hooks[name].style;
    return new Promise((resolve, reject) => {
      tapable[callStyles[style]].apply(tapable, [dashName].concat(args, (err, value) => {
        if (err) {
          reject(err);
        }
        else {
          resolve(value);
        }
      }));
    });
  }
};

exports.tapFor = function(tapable, name, key, reason, callback) {
  if (tapable.hooks) {
    tapable.hooks[name].for(key).tap(reason, callback);
  }
  else {
    exports.tap(tapable, name, reason, callback);
  }
};

exports.tapPromiseFor = function(tapable, name, key, reason, callback) {
  if (tapable.hooks) {
    tapable.hooks[name].for(key).tapPromise(reason, callback);
  }
  else {
    exports.tapPromise(tapable, name, reason, callback);
  }
};

exports.callFor = function(tapable, name, key, args) {
  if (tapable.hooks) {
    tapable.hooks[name].for(key).call.apply(tapable.hooks[name].for(key), args);
  }
  else {
    exports.call(tapable, name, args);
  }
};

exports.promiseFor = function(tapable, name, key, args) {
  if (tapable.hooks) {
    tapable.hooks[name].for(key).promise.apply(tapable.hooks[name].for(key), args);
  }
  else {
    exports.promise(tapable, name, args);
  }
};

exports.hooks = function(tapable) {
  if (tapable.hooks) {
    return tapable.hooks;
  }
  if (!tapable.__hardSource_proxy) {
    tapable.__hardSource_proxy = {};
  }
  var registrations = knownPluginRegistrations[tapable.constructor.name];
  if (registrations) {
    for (const name in registrations) {
      const registration = registrations[name];
      exports.register(tapable, name, registration[0], registration[1]);
    }
  }
  return tapable.__hardSource_proxy;
};
