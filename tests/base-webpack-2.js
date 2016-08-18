var expect = require('chai').expect;

var util = require('./util');

var clean = util.clean;

var describeWP2 = function() {
  var wpVersion = Number(require('webpack/package.json').version[0]);
  if (wpVersion > 1) {
    describe.apply(null, arguments);
  }
  else {
    describe.skip.apply(null, arguments);
  }
};

describeWP2('basic webpack 2 use', function() {

  before(function() {
    return clean('base-es2015-module');
  });

  it('builds identical base-es2015-module fixture', function() {
    return util.compileTwiceEqual('base-es2015-module');
  });

});
