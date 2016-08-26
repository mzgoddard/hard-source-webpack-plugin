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
  // Can be constructed with __dirname and path.join.
  recordsPath: '/absolute/path/to/records.json',
  plugins: {
    new HardSourceWebpackPlugin({
      // Either an absolute path or relative to output.path.
      cacheDirectory: 'path/to/cache',
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
  },
};
```

## Options

### `cacheDirectory`

A absolute or relative path to store intermediate webpack details to support faster subsequent builds for dependencies that did not change inbetween builds.

This directory is best unique per webpack configuration in a project. HardSourceWebpackPlugin cannot detect differences in webpack configurations inbetween runs. Instead using the same directory will pollute a build with build items from another configuration. You can naturally have sub directories for each config like `hard-source-cache/dev` and `hard-source-cache/prod`.

### `environmentPaths`

Requires Node > 4. Other versions will silently disable this option.

The options to `environmentPaths` are passed to [`env-hash`](https://www.npmjs.com/package/env-hash). Using `env-hash`, HardSourceWebpackPlugin tries to detect when changes in the configuration environment have changed such that it should ignore any cache. You can disable this check, though its best not to, by setting `environmentPaths` to `false`.

Here are the options as documented in `env-hash`.

> Env-hash accepts three options, `root`, `files` and `directories`.
>
> - `root` is the origin directory that is prepended to all relative paths. Defaults to `process.cwd()`
> - `files` is an array of relative or absolute file paths. Defaults to `['package.json']`
> - `directories` is an array of relative or absolute directory paths. Defaults to `['node_modules']`

## Please contribute!

This plugin is pretty young and we don't know what it has trouble with yet. Trying the plugin in a project and its creating errors or doesn't notice changes to original source, let us know your loaders and plugins or other build process details in an issue. Have a fix for something you've encountered, send us a fix.

# Change Log

- `0.0.23` Fix to error in resolve invalidation
- `0.0.19` Store separate non-devtool related base map for Uglify support
- `0.0.18` Invalidate modules depending on a now invalid resolve value
- `0.0.17` Support webpack-isomorphic-tools
- `0.0.16` Incomplete resolve invalidation
- `0.0.15` Invalidate whole cache when environment (node_modules, etc) change
- `0.0.13` Freeze and thaw module's `_source` used by Stats
- `0.0.11` Store modules in a leveldb store
- `0.0.10` Store assets separate for performance
- `0.0.9` Support ExtractText and Uglify
- `0.0.8` relative `cacheDirectory` support
- `0.0.7` Support Harmony modules by disabling tree shaking
- `0.0.5` First ReadME, travis badge, cacheDirectory change
- `0.0.4` Add source map tests, improve source map thawing
- `0.0.3` Add tests
