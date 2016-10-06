# HardSourceWebpackPlugin [![Build Status](https://travis-ci.org/mzgoddard/hard-source-webpack-plugin.svg?branch=master)](https://travis-ci.org/mzgoddard/hard-source-webpack-plugin)

`HardSourceWebpackPlugin` is a plugin for webpack to cache an intermediate step modules reach during a webpack. Run webpack twice with this plugin, the first build will take the normal amount of time. The second time, the build time will be greatly reduced.

Please note this plugin cannot track all possible changes that may invalidate a member of the cache. If you make a change outside your project's source code like updating a depending loader or webpack plugin or other step to your build process, you may need to delete the existing hard source cache. HardSourceWebpackPlugin can detect when the original content for a module has changed thanks to webpack's normal facilities used in watch-mode rebuilds. HardSourceWebpackPlugin can not guarantee it will detect when loaders and plugins that modify your code have changed. You may need to delete your current HardSource cache when you modify your build process by adding, removing, updating loaders and plugins or changing any part of your build configuration.

HardSourceWebpackPlugin makes the assumption that any cacheable module is deterministic between builds, or that it will not change. Loaders already help determine this by setting a cacheable flag when they operate on a module. After the loaders execute webpack's mangling of module loading statements is the only common thing left to make deterministic. webpack does this through ID records. Writing these records to the file system must be turned on. In use in conjuction with webpack-dev-server, this plugin will ensure the records are written to the file system, as the dev-server writes them to memory.

A webpack config with HardSourceWebpackPlugin may look like

```js
var HardSourceWebpackPlugin = require('hard-source-webpack-plugin');

module.exports = {
  context: // ...
  entry: // ...
  output: // ...
  plugins: [
    new HardSourceWebpackPlugin({
      // Either an absolute path or relative to output.path.
      cacheDirectory: 'path/to/cache/[confighash]',
      // Either an absolute path or relative to output.path. Sets webpack's
      // recordsPath if not already set.
      recordsPath: 'path/to/cache/[confighash]/records.json',
      // Optional field. Either a string value or function that returns a
      // string value.
      configHash: function(webpackConfig) {
        // Build a string value used by HardSource to determine which cache to
        // use if [confighash] is in cacheDirectory or if the cache should be
        // replaced if [confighash] does not appear in cacheDirectory.
        return process.env.NODE_ENV;
      },
      // Optional field. This field determines when to throw away the whole
      // cache if for example npm modules were updated.
      environmentPaths: {
        root: process.cwd(),
        directories: ['node_modules'],
        // Add your webpack configuration paths here so changes to loader
        // configuration and other details will cause a fresh build to occur.
        files: ['package.json', 'webpack.config.js'],
      },
    }),
  ],
};
```

## Options

### `cacheDirectory`

A absolute or relative path to store intermediate webpack details to support faster subsequent builds for dependencies that did not change inbetween builds.

This directory is best unique per webpack configuration in a project. HardSourceWebpackPlugin cannot detect differences in webpack configurations inbetween runs. Instead using the same directory will pollute a build with build items from another configuration. You can naturally have sub directories for each config like `hard-source-cache/dev` and `hard-source-cache/prod`.

Building a unique cacheDirectory can also be done with help with the `configHash` option.

### `recordsPath`

Set webpack's `recordsPath` option if not already set with a value constructed like `cacheDirectory`. `recordsInputPath` and `recordsOutputPath` may also be set this way.

### `configHash`

An optional field that takes a string or function. The function is called and passed the webpack config that the plugin first sees. Its called at this time so any changes to your config between reading it from disk and creating the compiler can be considered. Often this will help HardSource distinguish between webpack configs and if the previous cache can be used in cases like combining webpack config partials or turning on Hot Module Replacement through an option to the webpack's dev server.

#### Using configHash in the cacheDirectory

One of configHash's use cases is when building a webpack config from multiple parts and having HardSource's config in one of those common parts. In that case you need a different cache folder for each combination of webpack config parts. Including `[confighash]` in your cacheDirectory will use `configHash` HardSource option in where the cache is read and stored.

Since using `[confighash]` in cacheDirectory means multiple caches it is also best to have multiple webpack id records. Records means modules get the same ids over multiple builds. It also means different webpack configs with different loaders will mean different ids. If the same records used in a development build were then used in a production build the module ids will be further apart than records for just production builds or records without this plugin. So to help using different records per config, `[confighash]` can also be used in the `recordsPath` option passed to HardSourceWebpackPlugin.

#### Why hash the config?

You should use `environmentPaths` to help build an stamp of the build environment's npm modules and configuration, and so include any webpack config files in it. `configHash` fulfills a second check in a way. `configHash` is used to consider if the config at runtime is different than what it used to be during a previous run. This checks values that are different each webpack run without the timestamp of the configuration files having changed.

Differences reflected through this could be changes to a configuration like:

- An environment variable like NODE_ENV used to change parts of a configuration
- Combining webpack configs with webpack-merge
- Running in the webpack-dev-server cli tool with `--hot` versus without `--hot`

There isn't a way for HardSource to produce this value so its up to users to make it best reflect any webpack config that your specific project reasonably may have. Many project may use a library like `node-object-hash` to do this. Two reasons HardSource doesn't just do that is because of recursive configs or configs with non-deterministic values. If neither of those issues are part of your config `node-object-hash` will work here. In cases where you have recursive objects or non-deterministic values in your config, you will need to construct this value on your own or by creating a clone of your config that removes those issues first.

### `environmentPaths`

The options to `environmentPaths` are passed to [`env-hash`](https://www.npmjs.com/package/env-hash). Using `env-hash`, HardSourceWebpackPlugin tries to detect when changes in the configuration environment have changed such that it should ignore any cache. You can disable this check, though its best not to, by setting `environmentPaths` to `false`.

Here are the options as documented in `env-hash`.

> Env-hash accepts three options, `root`, `files` and `directories`.
>
> - `root` is the origin directory that is prepended to all relative paths. Defaults to `process.cwd()`
> - `files` is an array of relative or absolute file paths. Defaults to `['package.json']`
> - `directories` is an array of relative or absolute directory paths. Defaults to `['node_modules']`

If you have many config files, placing them in a directory and include it as one of the paths to the `directories` option. Or you can use a package like `glob` as part of the array to the `files` option.

## Please contribute!

This plugin is pretty young and we don't know what it has trouble with yet. Trying the plugin in a project and its creating errors or doesn't notice changes to original source, let us know your loaders and plugins or other build process details in an issue. Have a fix for something you've encountered, send us a fix.

# [Change Log](CHANGELOG.md)
