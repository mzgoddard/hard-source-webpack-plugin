var AsyncDependenciesBlock = require('webpack/lib/AsyncDependenciesBlock');
var DependenciesBlockVariable = require('webpack/lib/DependenciesBlockVariable');

function HardDependencyBlockPlugin() {}

HardDependencyBlockPlugin.prototype.apply = function(compiler) {
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
      dependencies: mapFreeze('dependency', null, variable.dependencies, extra),
    };
  });

  compiler.plugin('--hard-source-freeze-dependency-block', function(frozen, block, extra) {
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
