var expect = require('chai').expect;

var util = require('./util');

var clean = util.clean;

describe('loader webpack use', function() {

  before(function() {
    return clean('loader-css');
  });

  it('builds identical loader-css fixture', function() {
    return util.compileTwiceEqual('loader-css');
  });

});
