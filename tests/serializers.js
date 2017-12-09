var expect = require('chai').expect;

var itCompilesTwice = require('./util').itCompilesTwice;

describe('hard source serializers - compiles identically', function() {

  itCompilesTwice('serializer-append-base-1dep');
  itCompilesTwice('serializer-json-base-1dep');
  itCompilesTwice('serializer-leveldb-base-1dep');

});
