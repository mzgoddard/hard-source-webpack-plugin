var path = require('path');

var rootCompiler = function(compiler) {
  while (compiler.parentCompilation) {
    compiler = compiler.parentCompilation.compiler;
  }
  return compiler;
};

var compilerContext = exports.compilerContext = function compilerContext(compiler) {
  return rootCompiler(compiler.compiler ? compiler.compiler : compiler).context;
};

var relateNormalPath = exports.relateNormalPath = function relateNormalPath(compiler, key) {
  if (typeof key !== 'string') {return key;}
  if (compilerContext(compiler) === key) {
    return '.';
  }
  if (key === '') {
    return key;
  }
  return path.relative(compilerContext(compiler), key).replace(/\\/g, '/');
};

var relateNormalRequest = exports.relateNormalRequest = function relateNormalRequest(compiler, key) {
  return key
  .split('!')
  .map(function(subkey) {
    return relateNormalPath(compiler, subkey);
  })
  .join('!');
};

var relateNormalModuleId = exports.relateNormalModuleId = function relateNormalModuleId(compiler, id) {
  return id.substring(0, 24) + relateNormalRequest(compiler, id.substring(24));
};

var relateNormalLoaders = exports.relateNormalLoaders = function relateNormalLoaders(compiler, loaders) {
  return loaders.map(function(loader) {
    return Object.assign({}, loader, {
      loader: relateNormalPath(compiler, loader.loader),
    });
  });
};

var relateNormalPathArray = exports.relateNormalPathArray = function relateNormalPathArray(compiler, paths) {
  return paths.map(function(subpath) {
    return relateNormalPath(compiler, subpath);
  });
};

/**
 *
 */

var contextNormalPath = exports.contextNormalPath = function contextNormalPath(compiler, key) {
  if (typeof key !== 'string') {return key;}
  if (key === '.') {
    return compilerContext(compiler);
  }
  if (key === '') {
    return '';
  }
  return path.join(compilerContext(compiler), key).replace(/\//g, path.sep);
};

var contextNormalRequest = exports.contextNormalRequest = function contextNormalRequest(compiler, key) {
  return key
  .split('!')
  .map(function(subkey) {
    return contextNormalPath(compiler, subkey);
  })
  .join('!');
};

var contextNormalModuleId = exports.contextNormalModuleId = function contextNormalModuleId(compiler, id) {
  return id.substring(0, 24) + contextNormalRequest(compiler, id.substring(24));
};

var contextNormalLoaders = exports.contextNormalLoaders = function contextNormalLoaders(compiler, loaders) {
  return loaders.map(function(loader) {
    return Object.assign({}, loader, {
      loader: contextNormalPath(compiler, loader.loader),
    });
  });
};

var contextNormalPathArray = exports.contextNormalPathArray = function contextNormalPathArray(compiler, paths) {
  return paths.map(function(subpath) {
    return contextNormalPath(compiler, subpath);
  });
};

/**
 *
 */

var maybeAbsolutePath = exports.maybeAbsolutePath = function maybeAbsolutePath(path) {
  return /^([a-zA-Z]:\\\\|\/)/.test(path);
};

var relateAbsolutePath = exports.relateAbsolutePath = function relateAbsolutePath(context, absPath) {
  if (maybeAbsolutePath(absPath)) {
    return path.relative(context, absPath);
  }
  return absPath;
};

var relateAbsoluteRequest = exports.relateAbsoluteRequest = function relateAbsoluteRequest(context, absReq) {
  return absReq
  .split(/!/g)
  .map(function(path) {
    return relateAbsolutePath(context, path);
  })
  .join('!');
};
