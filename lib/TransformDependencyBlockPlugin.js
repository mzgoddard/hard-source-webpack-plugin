const DependenciesBlockVariable = require('webpack/lib/DependenciesBlockVariable');

const pluginCompat = require('./util/plugin-compat');

const BlockSchemas3 = [
  [
    'AMDRequireDependenciesBlock',
    'expr',
    'arrayRange',
    'functionRange',
    'errorCallbackRange',
    'module',
    'loc',
  ],
  ['ImportDependenciesBlock', 'request', 'range', 'chunkName', 'module', 'loc'],
  [
    'RequireEnsureDependenciesBlock',
    'expr',
    'successExpression',
    'errorExpression',
    'chunkName',
    'chunkNameRange',
    'module',
    'loc',
  ],
  ['AsyncDependenciesBlock', 'name', 'module'],
];

const BlockSchemas4 = [
  [
    'AMDRequireDependenciesBlock',
    'expr',
    'arrayRange',
    'functionRange',
    'errorCallbackRange',
    'module',
    'loc',
    'request',
  ],
  [
    'ImportDependenciesBlock',
    'request',
    'range',
    'groupOptions',
    'module',
    'loc',
    'originModule',
  ],
  [
    'RequireEnsureDependenciesBlock',
    'expr',
    'successExpression',
    'errorExpression',
    'chunkName',
    'chunkNameRange',
    'module',
    'loc',
  ],
  ['AsyncDependenciesBlock', 'groupOptions', 'module', 'loc', 'request'],
];

try {
  BlockSchemas3[0].DependencyBlock = require('webpack/lib/dependencies/AMDRequireDependenciesBlock');
  BlockSchemas4[0].DependencyBlock = require('webpack/lib/dependencies/AMDRequireDependenciesBlock');
} catch (_) {}
try {
  BlockSchemas3[1].DependencyBlock = require('webpack/lib/dependencies/ImportDependenciesBlock');
  BlockSchemas4[1].DependencyBlock = require('webpack/lib/dependencies/ImportDependenciesBlock');
} catch (_) {}
try {
  BlockSchemas3[2].DependencyBlock = require('webpack/lib/dependencies/RequireEnsureDependenciesBlock');
  BlockSchemas4[2].DependencyBlock = require('webpack/lib/dependencies/RequireEnsureDependenciesBlock');
} catch (_) {}
try {
  BlockSchemas3[3].DependencyBlock = require('webpack/lib/AsyncDependenciesBlock');
  BlockSchemas4[3].DependencyBlock = require('webpack/lib/AsyncDependenciesBlock');
} catch (_) {}

const freezeArgument = {
  chunkName(arg, { chunkName }, extra, methods) {
    return chunkName;
  },
  name(arg, { name }, extra, methods) {
    return name;
  },
  groupOptions(arg, { groupOptions }) {
    return groupOptions;
  },
  module(arg, block, extra, methods) {},
  originModule(arg, block, extra, methods) {},
};

const thawArgument = {
  module(arg, frozen, extra, methods) {
    return extra.module;
  },
  originModule(arg, block, extra, methods) {
    return extra.module;
  },
};

function freezeDependencyBlock(dependencyBlock, extra, methods) {
  const schemas = extra.schemas;
  for (let i = 0; i < schemas.length; i++) {
    if (dependencyBlock.constructor === schemas[i].DependencyBlock) {
      const frozen = {
        type: schemas[i][0],
      };
      for (let j = 1; j < schemas[i].length; j++) {
        let arg = dependencyBlock[schemas[i][j]];
        if (freezeArgument[schemas[i][j]]) {
          arg = freezeArgument[schemas[i][j]](
            arg,
            dependencyBlock,
            extra,
            methods,
          );
        }
        frozen[schemas[i][j]] = arg;
      }
      return frozen;
    }
  }
}

function thawDependencyBlock(frozen, extra, methods) {
  const schemas = extra.schemas;
  for (let i = 0; i < schemas.length; i++) {
    if (frozen.type === schemas[i][0]) {
      const DependencyBlock = schemas[i].DependencyBlock;
      const args = [];
      for (let j = 1; j < schemas[i].length; j++) {
        let arg = frozen[schemas[i][j]];
        if (thawArgument[schemas[i][j]]) {
          arg = thawArgument[schemas[i][j]](arg, frozen, extra, methods);
        }
        args.push(arg);
      }
      try {
        return new DependencyBlock(...args);
      } catch (_) {
        return new (Function.prototype.bind.apply(
          DependencyBlock,
          [null].concat(args),
        ))();
      }
    }
  }
}

function assertFrozen({ length }, original, typeName, freeze) {
  if (length !== original.length) {
    const didNotFreeze = original.filter(item => !freeze(item));
    if (didNotFreeze.length > 0) {
      throw new Error(
        `Unfrozen ${typeName} (${didNotFreeze.length} / ${
          original.length
        }): ${didNotFreeze
          .map(({ constructor }) => constructor.name)
          .filter((name, i, names) => !names.slice(0, i).includes(name))
          .join(', ')}`,
      );
    }
  }
}

class TransformDependencyBlockPlugin {
  constructor(options) {
    this.options = options;
  }

  apply(compiler) {
    let schemas = BlockSchemas4;
    if (this.options.schema < 4) {
      schemas = BlockSchemas3;
    }

    let methods;

    pluginCompat.tap(
      compiler,
      '_hardSourceMethods',
      'TransformDependencyBlockPlugin',
      _methods => {
        methods = _methods;
      },
    );

    let freeze;
    let mapFreeze;
    let mapThaw;

    pluginCompat.tap(
      compiler,
      '_hardSourceMethods',
      'TransformDependencyBlockPlugin',
      methods => {
        // store = methods.store;
        // fetch = methods.fetch;
        freeze = methods.freeze;
        // thaw = methods.thaw;
        mapFreeze = methods.mapFreeze;
        mapThaw = methods.mapThaw;
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceFreezeDependencyVariable',
      'TransformDependencyBlockPlugin',
      (frozen, { name, expression, dependencies }, extra) => ({
        type: 'DependenciesBlockVariable',
        name: name,
        expression: expression,
        dependencies: mapFreeze('Dependency', null, dependencies, extra),
      }),
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceFreezeDependencyBlock',
      'TransformDependencyBlockPlugin',
      (frozen, block, extra) => {
        extra.schemas = schemas;
        const _frozen = freezeDependencyBlock(block, extra, methods);
        if (_frozen) {
          if (
            (block.dependencies && block.dependencies.length > 0) ||
            (block.variables && block.variables.length > 0) ||
            (block.blocks && block.blocks.length > 0)
          ) {
            _frozen.dependencies = mapFreeze(
              'Dependency',
              null,
              block.dependencies,
              extra,
            );
            assertFrozen(
              _frozen.dependencies,
              block.dependencies,
              'dependencies',
              item => freeze('Dependency', null, item, extra),
            );
            _frozen.variables = mapFreeze(
              'DependencyVariable',
              null,
              block.variables,
              extra,
            );
            assertFrozen(
              _frozen.variables,
              block.variables,
              'dependency variables',
              item => freeze('DependencyVariable', null, item, extra),
            );
            _frozen.blocks = mapFreeze(
              'DependencyBlock',
              null,
              block.blocks,
              extra,
            );
            assertFrozen(_frozen.blocks, block.blocks, 'blocks', item =>
              freeze('DependencyBlock', null, item, extra),
            );
          }
          if (block.parent) {
            _frozen.parent = true;
          }
          return _frozen;
        }

        const _frozenBlock = {
          type: 'DependenciesBlock',
          dependencies: mapFreeze(
            'Dependency',
            null,
            block.dependencies,
            extra,
          ),
          variables: mapFreeze(
            'DependencyVariable',
            null,
            block.variables,
            extra,
          ),
          blocks: mapFreeze('DependencyBlock', null, block.blocks, extra),
        };

        assertFrozen(
          _frozenBlock.dependencies,
          block.dependencies,
          'dependencies',
          item => freeze('Dependency', null, item, extra),
        );
        assertFrozen(
          _frozenBlock.variables,
          block.variables,
          'dependency variables',
          item => freeze('DependencyVariable', null, item, extra),
        );
        assertFrozen(_frozenBlock.blocks, block.blocks, 'blocks', item =>
          freeze('DependencyBlock', null, item, extra),
        );

        return _frozenBlock;
      },
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceThawDependencyVariable',
      'TransformDependencyBlockPlugin',
      (variable, { name, expression, dependencies }, extra) =>
        new DependenciesBlockVariable(
          name,
          expression,
          mapThaw('Dependency', null, dependencies, extra),
        ),
    );

    pluginCompat.tap(
      compiler,
      '_hardSourceThawDependencyBlock',
      'TransformDependencyBlockPlugin',
      (block, frozen, extra) => {
        extra.schemas = schemas;
        const _thawed = thawDependencyBlock(frozen, extra, methods);
        if (_thawed) {
          if (_thawed.dependencies) {
            var blockExtra = {
              state: extra.state,
              module: extra.module,
              parent: _thawed,
              compilation: extra.compilation,
            };
            _thawed.dependencies = mapThaw(
              'Dependency',
              null,
              frozen.dependencies,
              blockExtra,
            );
            _thawed.variables = mapThaw(
              'DependencyVariable',
              null,
              frozen.variables,
              blockExtra,
            );
            mapThaw('DependencyBlock', null, frozen.blocks, blockExtra);
          }
          if (frozen.parent) {
            extra.parent.addBlock(_thawed);
          }
          return _thawed;
        }

        if (block) {
          var blockExtra = {
            state: extra.state,
            module: extra.module,
            parent: block,
            compilation: extra.compilation,
          };
          block.dependencies = mapThaw(
            'Dependency',
            null,
            frozen.dependencies,
            blockExtra,
          );
          block.variables = mapThaw(
            'DependencyVariable',
            null,
            frozen.variables,
            blockExtra,
          );
          block.blocks = mapThaw(
            'DependencyBlock',
            null,
            frozen.blocks,
            blockExtra,
          );
        }

        return block;
      },
    );
  }
}

module.exports = TransformDependencyBlockPlugin;
