var expect = require('chai').expect;

var itCompilesTwice = require('./util').itCompilesTwice;

describe('basic webpack use', function() {

  itCompilesTwice('base-1dep');
  itCompilesTwice('base-10deps-1nest');
  itCompilesTwice('base-process-env');
  itCompilesTwice('base-code-split');
  itCompilesTwice('base-code-split-process');
  itCompilesTwice('base-code-split-nest');
  itCompilesTwice('base-devtool-eval');
  itCompilesTwice('base-devtool-eval-source-map');
  itCompilesTwice('base-devtool-source-map');
  itCompilesTwice('base-devtool-cheap-source-map');
  itCompilesTwice('base-target-node-1dep');

});
