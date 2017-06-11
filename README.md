# HardSourceWebpackPlugin

[![Build Status](https://travis-ci.org/mzgoddard/hard-source-webpack-plugin.svg?branch=master)](https://travis-ci.org/mzgoddard/hard-source-webpack-plugin) [![Build status](https://ci.appveyor.com/api/projects/status/761saaelxem01xo5/branch/master?svg=true)](https://ci.appveyor.com/project/mzgoddard/hard-source-webpack-plugin/branch/master)

`HardSourceWebpackPlugin` is a plugin for webpack to provide an intermediate caching step for modules. In order to see results, you'll need to run webpack twice with this plugin: the first build will take the normal amount of time. The second build will be signficantly faster.

Install with `npm install --save hard-source-webpack-plugin` or `yarn`. And include the plugin in your webpack's plugins configuration.

```js
plugins: [
  new HardSourceWebpackPlugin()
]
```

Before version `0.4` a few required configuration values were needed for the plugin. Since those options are the most useful ones here is an example.

```js
new HardSourceWebpackPlugin({
  cacheDirectory: 'node_modules/.cache/hard-source/[confighash]',
  recordsPath: 'node_modules/.cache/hard-source/[confighash]/records.json',
  configHash: require('node-object-hash')({sort: false}).hash,
})
```

The values in this example are the defaults hard source uses. If you want to store your cache somewhere else you can freely set these to modify that. `'node-object-hash'` is the recommended library to build a hash of the configuration that hard-source can use in the `cacheDirectory` if specified. It's now included as a dependency for the defaults. If you want to customize your `configHash` it's recommended to have your package depend on `node-object-hash` and not use hard-source's version.

_Please note:_ this plugin cannot track all possible changes that may invalidate a member of the cache. If you make a change outside of your project's source code like updating a depending loader or webpack plugin or other step to your build process, you may need to delete the existing hard source cache. HardSourceWebpackPlugin can detect when the original content for a module has changed thanks to webpack's normal facilities used in watch-mode rebuilds. HardSourceWebpackPlugin can not guarantee it will detect when loaders and plugins that modify your code have changed. You may need to delete your current HardSource cache when you modify your build process by adding, removing, updating loaders and plugins or changing any part of your build configuration.

HardSourceWebpackPlugin makes the assumption that any cacheable module is deterministic between builds, or that it will not change. Loaders already help determine this by setting a cacheable flag when they operate on a module. After the loaders execute webpack's mangling of module loading statements is the only common thing left to make deterministic. webpack does this through ID records. Writing these records to the file system must be turned on. In use in conjuction with `webpack-dev-server`, this plugin will ensure the records are written to the file system, as `webpack-dev-server` writes them to memory.

A webpack config with HardSourceWebpackPlugin may look like this:

```js
var HardSourceWebpackPlugin = require('hard-source-webpack-plugin');

module.exports = {
  context: // ...
  entry: // ...
  output: // ...
  plugins: [
    new HardSourceWebpackPlugin({
      // Either an absolute path or relative to output.path.
      cacheDirectory: 'node_modules/.cache/hard-source/[confighash]',
      // Either an absolute path or relative to output.path. Sets webpack's
      // recordsPath if not already set.
      recordsPath: 'node_modules/.cache/hard-source/[confighash]/records.json',
      // Either a string value or function that returns a string value.
      configHash: function(webpackConfig) {
        // Build a string value used by HardSource to determine which cache to
        // use if [confighash] is in cacheDirectory or if the cache should be
        // replaced if [confighash] does not appear in cacheDirectory.
        //
        // node-object-hash on npm can be used to build this.
        return require('node-object-hash')({sort: false}).hash(webpackConfig);
      },
      // This field determines when to throw away the whole cache if for
      // example npm modules were updated.
      environmentHash: {
        root: process.cwd(),
        directories: ['node_modules'],
        files: ['package.json'],
      },
      // `environmentHash` can also be a function. that can return a function
      // resolving to a hashed value of the dependency environment.
      environmentHash: function() {
        // Return a string or a promise resolving to a string of a hash of the 
        return new Promise(function(resolve, reject) {
          require('fs').readFile(__dirname + '/yarn.lock', function(err, src) {
            if (err) {return reject(err);}
            resolve(
              require('crypto').createHash('md5').update(src).digest('hex')
            );
          });
        });
      },
    }),
  ],
};
```

## Options

### `cacheDirectory`

An absolute or relative path to store intermediate webpack details to support faster subsequent builds for dependencies that did not change in between builds.

This directory is best unique per webpack configuration in a project. HardSourceWebpackPlugin cannot detect differences in webpack configurations inbetween runs. Instead, using the same directory will pollute a build with build items from another configuration. You can naturally have sub directories for each config like `hard-source-cache/dev` and `hard-source-cache/prod`.

Building a unique cacheDirectory can also be done with help with the `configHash` option.

### `recordsPath`

Set webpack's `recordsPath` option if not already set with a value constructed like `cacheDirectory`. `recordsInputPath` and `recordsOutputPath` may also be set this way.

### `configHash`

A field that takes a string or function. The function is called and passed the webpack config that the plugin first sees. It's called at this time so any changes to your config between reading it from disk and creating the compiler can be considered. Often this will help HardSource distinguish between webpack configs and if the previous cache can be used in cases like combining webpack config partials or turning on Hot Module Replacement through an option to the webpack's dev server.

#### Using configHash in the cacheDirectory

One of `configHash`'s use cases is when building a webpack config from multiple parts and having HardSource's config in one of those common parts. In that case you need a different cache folder for each combination of webpack config parts. Including `[confighash]` in your cacheDirectory will use `configHash` HardSource option in where the cache is read and stored.

Since using `[confighash]` in cacheDirectory means multiple caches it is also best to have multiple webpack id records. Records means modules get the same ids over multiple builds. It also means different webpack configs with different loaders will mean different ids. If the same records used in a development build were then used in a production build the module ids will be further apart than records for just production builds or records without this plugin. So to help using different records per config, `[confighash]` can also be used in the `recordsPath` option passed to HardSourceWebpackPlugin.

#### Why hash the config?

You should use `environmentPaths` to help build an stamp of the build environment's npm modules and configuration, and so include any webpack config files in it. `configHash` fulfills a second check in a way. `configHash` is used to consider if the config at runtime is different than what it used to be during a previous run. This checks values that are different each webpack run without the timestamp of the configuration files having changed.

Differences reflected through this could be changes to a configuration like:

- An environment variable like NODE_ENV used to change parts of a configuration
- Combining webpack configs with webpack-merge
- Running in the webpack-dev-server cli tool with `--hot` versus without `--hot`

There isn't a way for HardSource to produce this value so its up to users to make it best reflect any webpack config that your specific project reasonably may have. Many project may use a library like `node-object-hash` to do this. Two reasons HardSource doesn't just do that is because of recursive configs or configs with non-deterministic values. If neither of those issues are part of your config `node-object-hash` will work here. In cases where you have recursive objects or non-deterministic values in your config, you will need to construct this value on your own or by creating a clone of your config that removes those issues first.

### `environmentHash`

This option builds a hash of the system environment as it effects built bundles. This concerns any dependencies installed through npm, bower, git submodules, or anything downloaded manually and stored in a vendor. Any build-time dependencies like loaders, plugins, and libraries for either that are updated inbetween builds are very difficult to track. At this time the best mechanism to ensure a build reflects the installed dependencies is to throw away a previous cache when the built environment hash changes.

#### `environmentHash` as a function

The most versatile value you can pass to environmentHash is a function.

This is a great way to define specifically how you want the hash to be built, say if you just wanted to checksum a yarn lock file or an npm shrinkwrap.

```js
environmentHash: function() {
  return require('crypto').createHash('md5')
  .update(require('fs').readFileSync(__dirname + '/yarn.lock'))
  .digest('hex');
},
```

A promise may also be returned for building this asynchrounously.

```js
environmentHash: function() {
  return new Promise(function(resolve, reject) {
    require('fs').readFile(__dirname + '/npm-shrinkwrap.json', function(err, src) {
      if (err) {return reject(err);}
      resolve(require('crypto').createHash('md5').update(src).digest('hex'));
    });
  });
},
```

#### `environmentHash` as an object

The object options to `environmentHash` are passed to [`env-hash`](https://www.npmjs.com/package/env-hash). Using `env-hash`, HardSourceWebpackPlugin tries to detect when changes in the configuration environment have changed such that it should ignore any cache.

Here are the options as documented in `env-hash`.

> Env-hash accepts three options, `root`, `files` and `directories`.
>
> - `root` is the origin directory that is prepended to all relative paths. Defaults to `process.cwd()`
> - `files` is an array of relative or absolute file paths. Defaults to `['package.json']`
> - `directories` is an array of relative or absolute directory paths. Defaults to `['node_modules']`

#### `environmentHash` disabled with false

You can disable the environment hash check by setting `environmentHash: false`. Take care with using this value as you'll need to provide a work around to dump the cache in cases like updating loaders or libraries loaders use.

## Please contribute!

This plugin is pretty young and we don't know what it has trouble with yet. Trying the plugin in a project and its creating errors or doesn't notice changes to original source, let us know your loaders and plugins or other build process details in an issue. Have a fix for something you've encountered, send us a fix.

# [Change Log](CHANGELOG.md)
