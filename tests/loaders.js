var expect = require('chai').expect;

var itCompilesTwice = require('./util').itCompilesTwice;

describe('loader webpack use', function() {

  itCompilesTwice('loader-css');
  itCompilesTwice('loader-file');

});
