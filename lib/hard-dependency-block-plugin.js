var AsyncDependenciesBlock = require('webpack/lib/AsyncDependenciesBlock');
var DependenciesBlockVariable = require('webpack/lib/DependenciesBlockVariable');

const BlockSchemas3 = [
  ['AMDRequireDependenciesBlock', 'expr', 'arrayRange', 'functionRange', 'errorCallbackRange', 'module', 'loc'],
  ['ImportDependenciesBlock', 'request', 'range', 'chunkName', 'module', 'loc'],
  ['RequireEnsureDependenciesBlock', 'expr', 'successExpression', 'errorExpression', 'chunkName', 'chunkNameRange', 'module', 'loc'],
];

try {
  BlockSchemas3[0].DependencyBlock = require('webpack/lib/dependencies/AMDRequireDependenciesBlock');
} catch (_) {}
try {
  BlockSchemas3[1].DependencyBlock = require('webpack/lib/dependencies/ImportDependenciesBlock');
} catch (_) {}
try {
  BlockSchemas3[2].DependencyBlock = require('webpack/lib/dependencies/RequireEnsureDependenciesBlock');
} catch (_) {}

const freezeArgument = {
  chunkName: function(arg, block, extra, methods) {
    return block.name;
  },
  module: function(arg, block, extra, methods) {},
};

const thawArgument = {
  module: function(arg, frozen, extra, methods) {
    return extra.module;
  },
};

function freezeDependencyBlock(dependencyBlock, extra, methods) {
  var schemas = extra.schemas;
  for (let i = 0; i < schemas.length; i++) {
    if (dependencyBlock.constructor === schemas[i].DependencyBlock) {
      var frozen = {
        type: schemas[i][0],
      };
      for (let j = 1; j < schemas[i].length; j++) {
        var arg = dependencyBlock[schemas[i][j]];
        if (freezeArgument[schemas[i][j]]) {
          arg = freezeArgument[schemas[i][j]](arg, dependencyBlock, extra, methods);
        }
        frozen[schemas[i][j]] = arg;
      }
      return frozen;
    }
  }
}

function thawDependencyBlock(frozen, extra, methods) {
  var schemas = extra.schemas;
  for (let i = 0; i < schemas.length; i++) {
    if (frozen.type === schemas[i][0]) {
      var DependencyBlock = schemas[i].DependencyBlock;
      var args = [];
      for (let j = 1; j < schemas[i].length; j++) {
        var arg = frozen[schemas[i][j]];
        if (thawArgument[schemas[i][j]]) {
          arg = thawArgument[schemas[i][j]](arg, frozen, extra, methods);
        }
        args.push(arg);
      }
      try {
        return new (Function.prototype.bind.apply(A, [null].concat(args)))();
      } catch (_) {
        return eval('new DependencyBlock(...args)');
      }
    }
  }
}

function HardDependencyBlockPlugin() {}

HardDependencyBlockPlugin.prototype.apply = function(compiler) {
  var methods;

  compiler.plugin('--hard-source-methods', function(_methods) {
    methods = _methods;
  });

  var mapFreeze, mapThaw;

  compiler.plugin('--hard-source-methods', function(methods) {
    // store = methods.store;
    // fetch = methods.fetch;
    // freeze = methods.freeze;
    // thaw = methods.thaw;
    mapFreeze = methods.mapFreeze;
    mapThaw = methods.mapThaw;
  });

  compiler.plugin('--hard-source-freeze-dependency-variable', function(frozen, variable, extra) {
    return {
      type: 'DependenciesBlockVariable',
      name: variable.name,
      expression: variable.expression,
      dependencies: mapFreeze('dependency', null, variable.dependencies, extra),
    };
  });

  compiler.plugin('--hard-source-freeze-dependency-block', function(frozen, block, extra) {
    extra.schemas = BlockSchemas3;
    const _frozen = freezeDependencyBlock(block, extra, methods);
    if (_frozen) {
      if (block.dependencies && block.dependencies.length > 0) {
        _frozen.dependencies = mapFreeze('dependency', null, block.dependencies, extra);
        _frozen.variables = mapFreeze('dependency-variable', null, block.variables, extra);
        _frozen.blocks = mapFreeze('dependency-block', null, block.blocks, extra);
      }
      if (block.parent) {
        _frozen.parent = true;
      }
      return _frozen;
    }
    return {
      name: block.chunkName,
      type: block instanceof AsyncDependenciesBlock ?
        'AsyncDependenciesBlock' :
        'DependenciesBlock',
      dependencies: mapFreeze('dependency', null, block.dependencies, extra),
      variables: mapFreeze('dependency-variable', null, block.variables, extra),
      blocks: mapFreeze('dependency-block', null, block.blocks, extra),
    };
  });

  compiler.plugin('--hard-source-thaw-dependency-variable', function(variable, frozen, extra) {
    return new DependenciesBlockVariable(
      frozen.name,
      frozen.expression,
      mapThaw('dependency', null, frozen.dependencies, extra)
    );
  });

  compiler.plugin('--hard-source-thaw-dependency-block', function(block, frozen, extra) {
    extra.schemas = BlockSchemas3;
    const _thawed = thawDependencyBlock(frozen, extra, methods);
    if (_thawed) {
      if (_thawed.dependencies) {
        var blockExtra = {
          state: extra.state,
          module: extra.module,
          parent: _thawed,
        };
        _thawed.dependencies = mapThaw('dependency', null, frozen.dependencies, blockExtra);
        _thawed.variables = mapThaw('dependency-variable', null, frozen.variables, blockExtra);
        mapThaw('dependency-block', null, frozen.blocks, blockExtra);
      }
      if (frozen.parent) {
        extra.parent.addBlock(_thawed);
      }
      return _thawed;
    }
    if (frozen.type === 'AsyncDependenciesBlock') {
      block = new AsyncDependenciesBlock(frozen.name, extra.module);
    }
    if (block) {
      var blockExtra = {
        state: extra.state,
        module: extra.module,
        parent: block,
      };
      block.dependencies = mapThaw('dependency', null, frozen.dependencies, blockExtra);
      block.variables = mapThaw('dependency-variable', null, frozen.variables, blockExtra);
      mapThaw('dependency-block', null, frozen.blocks, blockExtra);
    }
    if (frozen.type === 'AsyncDependenciesBlock') {
      extra.parent.addBlock(block);
    }

    return block;
  });
};

module.exports = HardDependencyBlockPlugin;
