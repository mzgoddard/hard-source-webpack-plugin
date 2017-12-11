# HardSourceWebpackPlugin

[![Build Status](https://travis-ci.org/mzgoddard/hard-source-webpack-plugin.svg?branch=master)](https://travis-ci.org/mzgoddard/hard-source-webpack-plugin) [![Build status](https://ci.appveyor.com/api/projects/status/761saaelxem01xo5/branch/master?svg=true)](https://ci.appveyor.com/project/mzgoddard/hard-source-webpack-plugin/branch/master)

`HardSourceWebpackPlugin` is a plugin for webpack to provide an intermediate caching step for modules. In order to see results, you'll need to run webpack twice with this plugin: the first build will take the normal amount of time. The second build will be signficantly faster.

Install with `npm install --save hard-source-webpack-plugin` or `yarn`. And include the plugin in your webpack's plugins configuration.

```js
// webpack.config.js
var HardSourceWebpackPlugin = require('hard-source-webpack-plugin');

module.exports = {
  context: // ...
  entry: // ...
  output: // ...
  plugins: [
    new HardSourceWebpackPlugin()
  ]
}
```

You can optionally set where HardSource writes and reads its cache to and from, and the hash values that determine when it creates new caches.

```js
new HardSourceWebpackPlugin({
  // Either an absolute path or relative to webpack's options.context.
  cacheDirectory: 'node_modules/.cache/hard-source/[confighash]',
  // Either an absolute path or relative to webpack's options.context.
  // Sets webpack's recordsPath if not already set.
  recordsPath: 'node_modules/.cache/hard-source/[confighash]/records.json',
  // Either a string of object hash function given a webpack config.
  configHash: function(webpackConfig) {
    // node-object-hash on npm can be used to build this.
    return require('node-object-hash')({sort: false}).hash(webpackConfig);
  },
  // Either false, a string, an object, or a project hashing function.
  environmentHash: {
    root: process.cwd(),
    directories: [],
    files: ['package-lock.json', 'yarn.lock'],
  },
}),
```

## Options

### `cacheDirectory`

The `cacheDirectory` is where the cache is written to. The default stores the cache in a directory under node_modules so if node_modules is cleared so is the cache.

The `cacheDirectory` has a field in it `[confighash]` that is replaced by the `configHash` option when webpack is started. The `[confighash]` field is here to help with changes to the configuration by the developer or by a script. For example if the same webpack configuration is used for the `webpack` cli tool and then the `webpack-dev-server` cli tool, they will generate different configuration hashes. `webpack-dev-server` adds plugins for its reloading features, and the default hash function produces a different value with those plugins added.

### `recordsPath`

`webpack` produces records for the ids it uses for its internal objects that `hard-source` writes to disk. The `recordsPath` option in `hard-source` is the same option for webpack. Use it to make use of the `[confighash]` value as it also appears in `cacheDirectory` so that the records are stored next to the rest of the cache.

### `configHash`

<a name="using-confighash-in-the-cachedirectory"></a>
<a name="why-hash-the-config"></a>

`configHash` turns a webpack configuration when a webpack instance is started and is used by `cacheDirectory` and `recordsPath` to build different caches for different webpack configurations.

Configurations may change how modules are rendered and so change how they appear in the disk cache `hard-source` writes. It is important to use a different cache per webpack configuration or webpack cli tool. `webpack` and `webpack-dev-server` for example needed separate caches, `configHash` and `[confighash]` in the `cacheDirectory` will create separate caches due to the plugins and configuration changes `webpack-dev-server` makes.

The default value for `configHash` is

```js
configHash: function(webpackConfig) {
  return require('node-object-hash')({sort: false}).hash(webpackConfig);
}
```

This uses the npm `node-object-hash` module with sort set to false to hash the object. `node-object-hash` hashes as much as it can but may have issue with some plugins or plugins and loaders that load an additional configuration file like a babel rc file or postcss config. In those cases you can depend on `node-object-hash` and extend what it hashes to best cover those changes.

`configHash` can also be set to a string or it can be a function that generates a value based on other parts of the environment.

```js
configHash: function() {
  return process.env.NODE_ENV + '-' process.env.BABEL_ENV;
}
```

### `environmentHash`

When loaders, plugins, other build time scripts, or other dynamic dependencies change, `hard-source` needs to replace the cache to make sure the otuput is correct. The `environmentHash` is used to determine this. If the hash is different than a previous build, a fresh cache will be used.

The default object

```js
environmentHash: {
  root: process.cwd(),
  directories: [],
  files: ['package-lock.json', 'yarn.lock']
}
```

hashes the lock files for `npm` and `yarn`. They will both be used if they both exist, or just one if only one exists. If neither file is found, the default will hash `package.json` and the `package.json` under `node_modules`.

<a name="environmenthash-as-a-function"></a>
<a name="environmenthash-as-an-object"></a>

<a name="environmenthash-disabled-with-false"></a>

You can disable the environmentHash by setting it to `false`. By doing this you will manually need to delete the cache when there is any dependency environment change.

## Troubleshooting

### Configuration changes are not being detected

`hard-source` needs a different cache for each different webpack configuration. The default `configHash` may not detect all of your options to plugins or other configuration files like `.babelrc` or `postcss.config.js`. In those cases a custom `configHash` is needed hashing the webpack config and those other values that it cannot normally reach.

### Hot reloading is not working

`webpack-dev-server` needs a different cache than `webpack` or other webpack cli tools. Make sure your `cacheDirectory` and `configHash` options are hashing the changes `webpack-dev-server` makes to your webpack config. The default `hard-source` values should do this.

### Multiple webpack processes at the same time are getting bad results

If you are using multiple webpack instances in separate processes make sure each has its own cache by changing `cacheDirectory` or `configHash`.

### Rebuilds are slower than the first build during dev-server

This is can be due to module context dependencies. `require.context` or loaders that watch folders use this webpack feature so webpack rebuilds when files or folders are added or removed from these watched directories. Be careful about using `require.context` or context aware loaders on folders that contain a lot of items. Both `require.context` and context loaders depend on those folders recursively. `hard-source` hashes every file under a `require.context` or context loader folder to detect when the context has changed and dependent modules are rebuilt.

### `webpack-dev-server` build loops continuously

Make sure you don't have a `require.context` or context loader on the root of your project. Such a context module means webpack is watching the hard source cache and when the cache is written after a build, webpack will start a new build for that module. This normally does not happen with `webpack-dev-server` because it writes the built files into memory instead of the disk. `hard-source` cannot do that since that would defeat its purpose as a disk caching plugin.

## Please contribute!

If you encounter any issues or have an idea for hard-source-webpack-plugin could be better, please let us know.

# [Change Log](CHANGELOG.md)
