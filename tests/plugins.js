var expect = require('chai').expect;

var util = require('./util');

var clean = util.clean;

describe('plugin webpack use', function() {

  before(function() {
    return clean('plugin-extract-text');
  });

  it('builds identical plugin-extract-text fixture', function() {
    return util.compileTwiceEqual('plugin-extract-text');
  });

  before(function() {
    return clean('plugin-uglify-1dep');
  });

  it('builds identical plugin-uglify-1dep', function() {
    return util.compileTwiceEqual('plugin-uglify-1dep');
  });

});
