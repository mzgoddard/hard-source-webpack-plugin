var fs = require('fs');
var join = require('path').join;

var expect = require('chai').expect;

function promisify(f, o) {
  var ctx = o && o.context || null;
  return function() {
    var args = Array.from(arguments);
    return new Promise(function(resolve, reject) {
      args.push(function(err, value) {
        if (err) {return reject(err);}
        return resolve(value);
      });
      f.apply(ctx, args);
    });
  };
}

var AppendSerializerPlugin = require('../lib/SerializerAppendPlugin');
var Append2SerializerPlugin = require('../lib/SerializerAppend2Plugin');

var itCompilesChange = require('mocha-hard-source').itCompilesChange;
var itCompilesHardModules = require('mocha-hard-source').itCompilesTwice;
var itCompilesTwice = require('mocha-hard-source').itCompilesTwice;

describe('hard source serializers - compiles identically', function() {

  itCompilesTwice('serializer-append-base-1dep');
  itCompilesTwice('serializer-append-2-base-1dep');
  itCompilesTwice('serializer-cacache-base-1dep');
  itCompilesTwice('serializer-json-base-1dep');
  itCompilesTwice('serializer-leveldb-base-1dep');
  itCompilesTwice('plugin-serializer-json-base-1dep');

  itCompilesHardModules('plugin-serializer-json-base-1dep', ['./fib.js', './index.js']);

});

describe('hard source serializers - serializer abilities', function() {

  itCompilesChange('serializer-append-base-1dep-compact', {
    'fib.js': [
      'module.exports = function(n) {',
      '  return n + (n > 0 ? n - 1 : 0);',
      '};',
    ].join('\n'),
    'fib/index.js': null,
  }, {
    'fib.js': null,
    'fib/index.js': [
      'module.exports = function(n) {',
      '  return n + (n > 0 ? n - 2 : 0);',
      '};',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/n - 1/);
    expect(output.run2['main.js'].toString()).to.match(/n - 2/);

    var cachePath = join(__dirname, 'fixtures/serializer-append-base-1dep-compact/tmp/cache');

    var stat = promisify(fs.stat);
    var oldSize;

    return Promise.resolve()
    .then(function() {
      return stat(join(cachePath, 'md5/log0000'));
    })
    .then(function(_stat) {
      oldSize = _stat.size;
    })
    .then(function() {
      return AppendSerializerPlugin.createSerializer({
        name: 'md5',
        cacheDirPath: cachePath
      })
      .compact();
    })
    .then(function() {
      return stat(join(cachePath, 'md5/log0000'));
    })
    .then(function(_stat) {
      expect(oldSize).to.be.gt(_stat.size);
    });
  });

  itCompilesChange('serializer-append-2-base-1dep-compact', {
    'fib.js': [
      'module.exports = function(n) {',
      '  return n + (n > 0 ? n - 1 : 0);',
      '};',
    ].join('\n'),
    'fib/index.js': null,
  }, {
    'fib.js': null,
    'fib/index.js': [
      'module.exports = function(n) {',
      '  return n + (n > 0 ? n - 2 : 0);',
      '};',
    ].join('\n'),
  }, function(output) {
    expect(output.run1['main.js'].toString()).to.match(/n - 1/);
    expect(output.run2['main.js'].toString()).to.match(/n - 2/);

    var cachePath = join(__dirname, 'fixtures/serializer-append-2-base-1dep-compact/tmp/cache');

    var stat = promisify(fs.stat);
    var oldSize;

    return Promise.resolve()
    .then(function() {
      return Append2SerializerPlugin.createSerializer({
        name: 'md5',
        autoParse: true,
        cacheDirPath: cachePath
      })
      .sizes();
    })
    .then(function(_stat) {
      oldSize = _stat.total;
    })
    .then(function() {
      return Append2SerializerPlugin.createSerializer({
        name: 'md5',
        autoParse: true,
        cacheDirPath: cachePath
      })
      .compact();
    })
    .then(function() {
      return Append2SerializerPlugin.createSerializer({
        name: 'md5',
        autoParse: true,
        cacheDirPath: cachePath
      })
      .sizes();
    })
    .then(function(_stat) {
      expect(oldSize).to.be.gt(_stat.total);
    });
  });

});
