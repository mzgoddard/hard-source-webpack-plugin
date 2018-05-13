var hookTypes;

var callStyles = {
  sync: 'applyPlugins',
  syncWaterfall: 'applyPluginsWaterfall',
  syncBail: 'applyPluginsBailResult',
  asyncWaterfall: 'applyPluginsAsyncWaterfall',
  asyncParallel: 'applyPluginsAsync',
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
    compilation: ['sync', ['compilation', 'params']]
  },
  NormalModuleFactory: {
    createModule: ['syncBail', ['data']]
  },
  ContextModuleFactory: {
    afterResolve: ['asyncWaterfall', ['data']]
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
        async: style.starsWith('async'),
        args: args,
      };
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
