var expect = require('chai').expect;

var itCompilesTwice = require('./util').itCompilesTwice;

describe('plugin webpack use', function() {

  itCompilesTwice('plugin-extract-text');
  itCompilesTwice('plugin-uglify-1dep');

});
