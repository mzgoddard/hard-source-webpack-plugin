var itCompilesTwice = require('mocha-hard-source').itCompilesTwice;

describe('plugin webpack use', function() {
  itCompilesTwice('plugin-isomorphic-tools');
});
