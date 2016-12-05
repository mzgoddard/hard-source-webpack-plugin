var bluebird = require('bluebird');

module.exports = EnhancedResolvePlugin;

function EnhancedResolvePlugin(cache) {
  this.cache = cache;
}

EnhancedResolvePlugin.prototype.apply = function(compiler) {
  var stat;

  var cache = this.cache;

  function configureMissing(key, resolver) {
    var _resolve = resolver.resolve;
    resolver.resolve = function(info, context, request, cb) {
      var numArgs = 4;
      if (!cb) {
        numArgs = 3;
        cb = request;
        request = context;
        context = info;
      }

      var resolve = cache.getResult(key, context, request);
      if (resolve && !resolve.invalid) {
        return cb(null, resolve + request.split('?').slice(1).join('?'));
      }

      var localMissing = [];
      var callback = function(err, result) {
        if (result) {
          var _result = result.split('?')[0];
          var missing = localMissing.filter(function(missed, missedIndex) {
            var index = localMissing.indexOf(missed);
            if (index === -1 || index < missedIndex) {
              return false;
            }
            if (missed === _result) {
              return false;
            }
            return true;
          });
          return Promise.all(missing.map(function(missed) {
            // We know the stats just happened so their results are cached
            // letting this be a very good time to see what wasn't on the file
            // system and what is. Letting us filter out the "actually
            // missing" as opposed to the items that aren't the right type.
            // Like searching for a file and finding a directory, ignoring it
            // to move on and try another possible file.
            return stat(missed)
            .then(function(stat) {
              if (['loader', 'normal'].indexOf(key) !== -1 && stat.isDirectory()) {
                return {path: missed, type: 'directory'};
              }
              if (key === 'context' && stat.isFile()) {
                return {path: missed, type: 'file'};
              }
            }, function() {return missed;});
          }))
          .then(function(missing) {
            missing = missing.filter(Boolean);
            cache.set(key, context, request, _result, missing);
            cb(err, result);
          });
        }
        cb(err, result);
      };
      if (callback.missing) {
        var _missing = callback.missing;
        callback.missing = {push: function(path) {
          localMissing.push(path);
          _missing.push(path);
        }};
      }
      else {
        callback.missing = localMissing;
      }
      if (numArgs === 3) {
        _resolve.call(this, context, request, callback);
      }
      else {
        _resolve.call(this, info, context, request, callback);
      }
    };
  }

  compiler.plugin('after-plugins', function() {
    configureMissing('normal', compiler.resolvers.normal);
    configureMissing('loader', compiler.resolvers.loader);
    configureMissing('context', compiler.resolvers.context);
  });

  compiler.plugin('after-environment', function() {
    stat = bluebird.promisify(
      compiler.inputFileSystem.stat,
      {context: compiler.inputFileSystem}
    );
  });
};
