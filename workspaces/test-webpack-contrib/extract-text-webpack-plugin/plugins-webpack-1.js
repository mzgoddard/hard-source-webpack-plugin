var itCompilesTwice = require('mocha-hard-source').itCompilesTwice;

var c = require('mocha-hard-source/features');

describe('plugin webpack use', function() {
  itCompilesTwice.skipIf([c.extractText])('plugin-extract-text');
  itCompilesTwice.skipIf([c.extractText])('plugin-extract-text-loader-file');
  itCompilesTwice.skipIf([c.extractText])(
    'plugin-extract-text-throw-on-freeze',
  );
  itCompilesTwice.skipIf([c.extractText, c.uglify])(
    'plugin-extract-text-uglify',
  );
  itCompilesTwice.skipIf([c.extractText, c.uglify])(
    'plugin-extract-text-uglify-source-map',
  );
  itCompilesTwice.skipIf([c.extractText, c.uglify])(
    'plugin-extract-text-uglify-eval-source-map',
  );
  itCompilesTwice.skipIf([c.extractText, c.uglify, c.html])(
    'plugin-extract-text-html-uglify',
  );
});
