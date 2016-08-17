var expect = require('chai').expect;

var util = require('./util');

var clean = util.clean;

describe('basic webpack use', function() {

  before(function() {
    return clean('base-1dep');
  });

  it('builds identical base-1dep fixture', function() {
    return util.compileTwiceEqual('base-1dep');
  });

  before(function() {
    return clean('base-10deps-1nest');
  });

  it('builds identical base-10deps-1nest fixture', function() {
    return util.compileTwiceEqual('base-10deps-1nest');
  });

  before(function() {
    return clean('base-process-env');
  });

  it('builds identical base-process-env fixture', function() {
    return util.compileTwiceEqual('base-process-env');
  });

  before(function() {
    return clean('base-code-split');
  });

  it('builds identical base-code-split fixture', function() {
    return util.compileTwiceEqual('base-code-split');
  });

  before(function() {
    return clean('base-code-split-process');
  });

  it('builds identical base-code-split-process fixture', function() {
    return util.compileTwiceEqual('base-code-split-process');
  });

  before(function() {
    return clean('base-code-split-nest');
  });

  it('builds identical base-code-split-nest fixture', function() {
    return util.compileTwiceEqual('base-code-split-nest');
  });

  before(function() {
    return clean('base-devtool-eval');
  });

  it('builds identical base-devtool-eval fixture', function() {
    return util.compileTwiceEqual('base-devtool-eval');
  });

  before(function() {
    return clean('base-devtool-eval-source-map');
  });

  it('builds identical base-devtool-eval-source-map fixture', function() {
    return util.compileTwiceEqual('base-devtool-eval-source-map');
  });

  before(function() {
    return clean('base-devtool-source-map');
  });

  it('builds identical base-devtool-source-map fixture', function() {
    return util.compileTwiceEqual('base-devtool-source-map');
  });

  before(function() {
    return clean('base-devtool-cheap-source-map');
  });

  it('builds identical base-devtool-cheap-source-map fixture', function() {
    return util.compileTwiceEqual('base-devtool-cheap-source-map');
  });

});
