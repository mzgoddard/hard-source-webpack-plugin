const pluginCompat = require('./util/plugin-compat');

const matchTest = (test, source) => {
  if (Array.isArray(test)) {
    return test.some(subtest => matchTest(subtest, source));
  } else if (test instanceof RegExp) {
    return test.test(source);
  } else if (typeof test === 'string') {
    return source.startsWith(test);
  } else if (typeof test === 'function') {
    return test(source);
  }
  return false;
};

const matchOne = ({ test, include, exclude }, source) => {
  return (
    (test ? matchTest(test, source) : true) &&
    (include ? matchTest(include, source) : true) &&
    (exclude ? !matchTest(exclude, source) : true)
  );
};

const matchAny = (test, source) => {
  if (Array.isArray(test)) {
    return test.some(subtest => matchOne(subtest, source));
  }
  return matchOne(test, source);
};

class ExcludeModulePlugin {
  constructor(match) {
    this.match = match;
  }

  apply(compiler) {
    const compilerHooks = pluginCompat.hooks(compiler);

    compilerHooks.afterPlugins.tap('HardSource - ExcludeModulePlugin', () => {
      compilerHooks._hardSourceAfterFreezeModule.tap(
        'HardSource - ExcludeModulePlugin',
        (frozen, module, extra) => {
          if (matchAny(this.match, module.identifier())) {
            return null;
          }
          return frozen;
        },
      );
    });
  }
}

module.exports = ExcludeModulePlugin;
