let hookTypes;

const callStyles = {
  sync: 'applyPlugins',
  syncWaterfall: 'applyPluginsWaterfall',
  syncBail: 'applyPluginsBailResult',
  sync_map: 'applyPlugins',
  asyncWaterfall: 'applyPluginsAsyncWaterfall',
  asyncParallel: 'applyPluginsParallel',
  asyncSerial: 'applyPluginsAsync',
};

const camelToDash = camel =>
  camel.replace(/_/g, '--').replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);

const knownPluginRegistrations = {
  Compilation: {
    needAdditionalPass: ['sync', []],
    succeedModule: ['sync', ['module']],
    buildModule: ['sync', ['module']],
    seal: ['sync', []],
  },
  Compiler: {
    afterCompile: ['asyncSerial', ['compilation']],
    afterEnvironment: ['sync', []],
    afterPlugins: ['sync', []],
    afterResolvers: ['sync', []],
    compilation: ['sync', ['compilation', 'params']],
    emit: ['asyncSerial', ['compilation']],
    make: ['asyncParallel', ['compilation']],
    watchRun: ['asyncSerial', ['watcher']],
    run: ['asyncSerial', ['compiler']],
  },
  NormalModuleFactory: {
    createModule: ['syncBail', ['data']],
    parser: ['sync_map', ['parser', 'parserOptions']],
    resolver: ['syncWaterfall', ['nextResolver']],
  },
  ContextModuleFactory: {
    afterResolve: ['asyncWaterfall', ['data']],
  },
};

exports.register = (tapable, name, style, args) => {
  if (tapable.hooks) {
    if (!hookTypes) {
      const Tapable = require('tapable');
      hookTypes = {
        sync: Tapable.SyncHook,
        syncWaterfall: Tapable.SyncWaterfallHook,
        syncBail: Tapable.SyncBailHook,
        asyncWaterfall: Tapable.AsyncWaterfallHook,
        asyncParallel: Tapable.AsyncParallelHook,
        asyncSerial: Tapable.AsyncSeriesHook,
        asyncSeries: Tapable.AsyncSeriesHook,
      };
    }
    if (!tapable.hooks[name]) {
      tapable.hooks[name] = new hookTypes[style](args);
    }
  } else {
    if (!tapable.__hardSource_hooks) {
      tapable.__hardSource_hooks = {};
    }
    if (!tapable.__hardSource_hooks[name]) {
      tapable.__hardSource_hooks[name] = {
        name,
        dashName: camelToDash(name),
        style,
        args,
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
              tapPromise: (...args) =>
                exports.tapPromiseFor(tapable, name, key, ...args),
              call: (...args) => exports.callFor(tapable, name, key, ...args),
              promise: (...args) =>
                exports.promiseFor(tapable, name, key, ...args),
            };
            return _forCache[key];
          },
          tap: (...args) => exports.tapFor(tapable, name, ...args),
          tapPromise: (...args) =>
            exports.tapPromiseFor(tapable, name, ...args),
          call: (...args) => exports.callFor(tapable, name, ...args),
          promise: (...args) => exports.promiseFor(tapable, name, ...args),
        };
      } else {
        tapable.__hardSource_proxy[name] = {
          tap: (...args) => exports.tap(tapable, name, ...args),
          tapPromise: (...args) => exports.tapPromise(tapable, name, ...args),
          call: (...args) => exports.call(tapable, name, args),
          promise: (...args) => exports.promise(tapable, name, args),
        };
      }
    }
  }
};

exports.tap = (tapable, name, reason, callback) => {
  if (tapable.hooks) {
    tapable.hooks[name].tap(reason, callback);
  } else {
    if (!tapable.__hardSource_hooks || !tapable.__hardSource_hooks[name]) {
      const registration =
        knownPluginRegistrations[tapable.constructor.name][name];
      exports.register(tapable, name, registration[0], registration[1]);
    }
    const dashName = tapable.__hardSource_hooks[name].dashName;
    if (tapable.__hardSource_hooks[name].async) {
      tapable.plugin(dashName, (...args) => {
        const cb = args.pop();
        cb(null, callback(...args));
      });
    } else {
      tapable.plugin(dashName, callback);
    }
  }
};

exports.tapPromise = (tapable, name, reason, callback) => {
  if (tapable.hooks) {
    tapable.hooks[name].tapPromise(reason, callback);
  } else {
    if (!tapable.__hardSource_hooks || !tapable.__hardSource_hooks[name]) {
      const registration =
        knownPluginRegistrations[tapable.constructor.name][name];
      exports.register(tapable, name, registration[0], registration[1]);
    }
    const dashName = tapable.__hardSource_hooks[name].dashName;
    tapable.plugin(dashName, (...args) => {
      const cb = args.pop();
      return callback(...args).then(value => cb(null, value), cb);
    });
  }
};

exports.tapAsync = (tapable, name, reason, callback) => {
  if (tapable.hooks) {
    tapable.hooks[name].tapAsync(reason, callback);
  } else {
    if (!tapable.__hardSource_hooks || !tapable.__hardSource_hooks[name]) {
      const registration =
        knownPluginRegistrations[tapable.constructor.name][name];
      exports.register(tapable, name, registration[0], registration[1]);
    }
    const dashName = tapable.__hardSource_hooks[name].dashName;
    tapable.plugin(dashName, callback);
  }
};

exports.call = (tapable, name, args) => {
  if (tapable.hooks) {
    const hook = tapable.hooks[name];
    return hook.call(...args);
  } else {
    const dashName = tapable.__hardSource_hooks[name].dashName;
    const style = tapable.__hardSource_hooks[name].style;
    return tapable[callStyles[style]](...[dashName].concat(args));
  }
};

exports.promise = (tapable, name, args) => {
  if (tapable.hooks) {
    const hook = tapable.hooks[name];
    return hook.promise(...args);
  } else {
    const dashName = tapable.__hardSource_hooks[name].dashName;
    const style = tapable.__hardSource_hooks[name].style;
    return new Promise((resolve, reject) => {
      tapable[callStyles[style]](
        ...[dashName].concat(args, (err, value) => {
          if (err) {
            reject(err);
          } else {
            resolve(value);
          }
        }),
      );
    });
  }
};

exports.tapFor = (tapable, name, key, reason, callback) => {
  if (tapable.hooks) {
    tapable.hooks[name].for(key).tap(reason, callback);
  } else {
    exports.tap(tapable, name, reason, callback);
  }
};

exports.tapPromiseFor = (tapable, name, key, reason, callback) => {
  if (tapable.hooks) {
    tapable.hooks[name].for(key).tapPromise(reason, callback);
  } else {
    exports.tapPromise(tapable, name, reason, callback);
  }
};

exports.callFor = (tapable, name, key, args) => {
  if (tapable.hooks) {
    tapable.hooks[name].for(key).call(...args);
  } else {
    exports.call(tapable, name, args);
  }
};

exports.promiseFor = (tapable, name, key, args) => {
  if (tapable.hooks) {
    tapable.hooks[name].for(key).promise(...args);
  } else {
    exports.promise(tapable, name, args);
  }
};

exports.hooks = tapable => {
  if (tapable.hooks) {
    return tapable.hooks;
  }
  if (!tapable.__hardSource_proxy) {
    tapable.__hardSource_proxy = {};
  }
  const registrations = knownPluginRegistrations[tapable.constructor.name];
  if (registrations) {
    for (const name in registrations) {
      const registration = registrations[name];
      exports.register(tapable, name, registration[0], registration[1]);
    }
  }
  return tapable.__hardSource_proxy;
};
