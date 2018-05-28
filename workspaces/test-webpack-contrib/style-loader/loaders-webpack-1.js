var util = require('mocha-hard-source');
var itCompilesTwice = util.itCompilesTwice;
var itCompilesHardModules = util.itCompilesHardModules;

describe('loader webpack use', function() {
  itCompilesTwice('loader-css');

  itCompilesHardModules('loader-css', ['./index.css']);
});
