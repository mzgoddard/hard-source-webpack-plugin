{
  cacheDirectory: "cache",
  recordsPath: "cache/records.json",
  environmentHash: function(config) {
    return new Promise(function(resolve, reject) {
      fs.readFile(__dirname + "/env-hash", "utf8", function(err, src) {
        if (err) {return reject(err);}
        resolve(src);
      });
    });
  },
}