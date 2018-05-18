const pluginCompat = require('./util/plugin-compat');

function freezeDependency(dependency, extra, methods) {
  if (extra.schemas.map.has(dependency.constructor)) {
    return extra.schemas.map
      .get(dependency.constructor)
      .freeze(dependency, dependency, extra, methods);
  }
  if (extra.schemas[dependency.constructor.name]) {
    return extra.schemas[dependency.constructor.name].freeze(
      dependency,
      dependency,
      extra,
      methods,
    );
  }
}

function thawDependency(frozen, extra, methods) {
  if (extra.schemas[frozen.type]) {
    return extra.schemas[frozen.type].thaw(null, frozen, extra, methods);
  }
}

class TransformBasicDependencyPlugin {
  constructor(options) {
    this.options = options;
  }

  apply(compiler) {
    if (this.options.schema < 4) {
      const TransformBasicDependencyPluginLegacy = require('./TransformBasicDependencyPluginLegacy');
      new TransformBasicDependencyPluginLegacy(this.options).apply(compiler);
    } else {
      const schemas = require('./schema-4');

      let methods;

      pluginCompat.tap(
        compiler,
        '_hardSourceMethods',
        'TransformBasicDependencyPlugin methods',
        _methods => {
          methods = _methods;
        },
      );

      pluginCompat.tap(
        compiler,
        '_hardSourceFreezeDependency',
        'TransformBasicDependencyPlugin freeze',
        (frozen, dependency, extra) => {
          extra.schemas = schemas;
          const _frozen = freezeDependency(dependency, extra, methods);
          if (_frozen) {
            return _frozen;
          }
          return frozen;
        },
      );

      pluginCompat.tap(
        compiler,
        '_hardSourceThawDependency',
        'TransformBasicDependencyPlugin',
        (dependency, frozen, extra) => {
          extra.schemas = schemas;
          const _thawed = thawDependency(frozen, extra, methods);
          if (_thawed) {
            return _thawed;
          }
          return dependency;
        },
      );
    }
  }
}

module.exports = TransformBasicDependencyPlugin;
