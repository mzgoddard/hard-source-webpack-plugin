var itCompilesTwice = require('mocha-hard-source').itCompilesTwice;
var itCompilesHardModules = require('mocha-hard-source').itCompilesHardModules;

var c = require('mocha-hard-source/features');

describe('plugin webpack use', function() {
  itCompilesTwice.skipIf([c.html])('plugin-html-lodash');
  itCompilesHardModules.skipIf([c.html])('plugin-html-lodash', [
    /lodash\/lodash\.js$/,
    /\!\.\/index\.html$/,
  ]);
});
