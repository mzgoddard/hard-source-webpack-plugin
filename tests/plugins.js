var expect = require('chai').expect;

var itCompilesTwice = require('./util').itCompilesTwice;

describe('plugin webpack use', function() {

  itCompilesTwice('plugin-dll');
  itCompilesTwice('plugin-dll-reference');
  itCompilesTwice('plugin-extract-text');
  itCompilesTwice('plugin-uglify-1dep');
  itCompilesTwice('plugin-extract-text-uglify');
  itCompilesTwice('plugin-extract-text-uglify-source-map');
  itCompilesTwice('plugin-extract-text-uglify-eval-source-map');
  itCompilesTwice('plugin-extract-text-html-uglify');
  itCompilesTwice('plugin-isomorphic-tools');

});
