# 0.5.0

- Internal plugins for freezing and thawing modules, dependencies, and assets
- Use AppendSerializer by default
- Improved ES2015 support
- Environment hash defaults to package-lock.json and yarn.lock if they exist

## 0.5.X Patches

- `0.5.16` Fix baseMap redundancy logic (#246), fix options passing for cheap-eval devtool (#241)
- `0.5.15` Safety check that `sourceMap.map` is in cache before use (@abogaart)
- `0.5.14` Improve AppendSerializer performance reading and writing
- `0.5.13` Improve AppendSerializer performance on lots of writes
- `0.5.12` Fix sourcesContext is undefined (@piecyk)
- `0.5.11` Fix relative context module's identifier and id assignment
- `0.5.10` Fix contextTimstamp typo and hash regression, fix bad compilerContext when logging freezing errors (#230)
- `0.5.9` Fix context dependency validation (#182) and worker-loader cache prefix search (#201)
- `0.5.8`
  - Fix memory usage related to HarmonyExportImportedSpecifierDependency
  - Reduce memory usage in frozen modules and source maps
  - Reduce memory usage writing to and reading from disk
  - Fix using preloaded modules in the memory cache
- `0.5.7` Fix a large memory usage related to HarmonyExportImportedSpecifierDependency (#205)
- `0.5.6` Add module freeze error logging
- `0.5.5` Fix contextStampm, return context object in synchronous branch
- `0.5.4` Improve cache read and write performance related to promises, fix AppendSerializer compacting
- `0.5.3` Improve AppendSerializer performance
- `0.5.2` Fix nested AsyncDependenciesBlock origins for Stats support

## Release Features

The first step to providing meaningful third party hard-source plugins for deeper integration with advanced webpack plugins, this version adds internally used plugins for freezing and thawing modules, etc. These plugins are accessible externally but are prefixed with `--` to help indicate that you should avoid using them in the meantime. You are welcome to make plugins that use these hooks but the interface may change. Internal and external plugin interface changes will only occur during minor version releases before version 1.

As an important example of the utility of the plugin interface modules that are put into a ConcatenatedModule are now cached, helping decreasing build times using that plugin.

# 0.4.0

- Low level resolution cache
- Missing resolution attempt check
- Expose a 'hard-source-cache-factory' plugin hook on the compiler
- Cache module resolutions in a cache serializer
- Expose a 'hard-source-log' plugin hook on the compiler
- Default options

## 0.4.X Patches

- `0.4.15` Deserialize objects from their caches before use (@ettavolt)
- `0.4.14` Publish index.js and lib, omitting tests
- `0.4.13` Add AppendSerializer
- `0.4.12` Fix harmony module export * from ... (@filipesilva)
- `0.4.11` Fix ContextDependency non-regexp use and fix child compiler cache prefix search
- `0.4.10` Bump webpack version to help with nested dependency issues (@rowan)
- `0.4.9` Fetch loader options for rule based options in webpack > 2
- `0.4.8` Fix error in loader rule optimization use during watch mode
- `0.4.7` Support webpack 3's loader rules optimization
- `0.4.6` Support direct use of SourceMapDevToolPlugin
- `0.4.5` Add webpack 3 support. Add initial ModuleConcatenationPlugin support
- `0.4.4` Fix configHash default value
- `0.4.3` Fix #105. Cache assets in memory as well as disk
- `0.4.2` Tune default options
- `0.4.1` Add Appveyor CI

## Release Features

### Low level resolution cache

Prior versions of hard-source cache resolution values the NormalModuleFactory creates and a similar data for the ContextModuleFactory. These higher level resolutions provide a lot of hard-sources performance gain by reusing those values when resolving modules as long as an assumption holds. The file or context the resolution points at must still exist. The low level resolution cache takes this further caching the work resolving files, loaders, and contexts. These cached resolutions can be reused between multiple module resolutions as they may share files or loaders. Two modules with the same file but different loaders go through separate NormalModuleFactory resolutions meaning they hit the lower level resolvers. This new cache provides some performance gains in regards to the reused values.

### Missing resolution attempt check

Highly related to the low level resolution cache is the missing resolution attempt check that can be made. When the low level resolvers try to find the resource for a request it can optionally build an array of missing paths that it tried. Caching that information hard-source now provides a stronger assurance that what should have been built is. Seeing any of those missing attempts now existing means the old resolution is invalid and any related NormalModuleFactory resolution is also invalid. During the new build, hard-source will let the normal resolutions occur and store the new information.

### `'hard-source-cache-factory'` plugin

Leading up to changing the default cache serializer (#53), hard-source has its first plugin hook to make it more flexible. The `'hard-source-cache-factory'` plugin hook on the webpack compiler lets a users determine how the cache is write to and read from disk. Documentation on this is in the `lib/cache-serializer-factory.js` module.

With this hook a working additional serializer and plugin is available to replace the leveldb default serializer with a json serializer. This serializer is primarily available for debugging the contents of the cache as they're directly human readable.

To use this plugin you can add it to your config

```js
plugins: [
  // other plugins
  new HardSourceWebpackPlugin.HardSourceJsonSerializerPlugin(),
```

As a step to #53 a patch version with a replacement to the leveldb will come out during `v0.4.x` that will become the default in `v0.5.0`.

### Cache module resolutions in a cache serializer

Up until this version the NormalModuleFactory resolutions were using some old code to write and read its cache. That has been replaced with a cache serializer like the other caches. This has little effect on reading but provides a small performance gain when writing changes to the cache from the build. The cache serializers are able to write out changes instead of needing to write out the whole cache. This may a small measurable impact on large project where they were writing out the whole module resolution cache.

### `'hard-source-log'` plugin

A second plugin hook in this release, `'hard-source-log'` presents a way to control the logging output from hard-source. Two obvious uses is a plugin to silence its output or another to write the output to disk. Documentation on this plugin hook can be found in `lib/logger-factory.js`.

With a plugin approach to logging, more logging of lower levels (debug, log) will be added that a plugin will optionally enable for writting out. This additional logging will cover when and why modules are invalidated, timing and other information to help debug hard-source.

### Default options

Past versions required at least the `cacheDirectory` and `recordsPath` options, along with recommending the `configHash` option. This release sets defaults for these making hard-source easier to use.

- `cacheDirectory` defaults to `'node_modules/.cache/hard-source/[confighash]'`
- `recordsPath` defaults to `'node_modules/.cache/hard-source/[confighash]/records.json'`
- `configHash` defaults to `require('node-object-hash')({sort: false}).hash`

# 0.3.0

- Internal env-hash implementation relying on file hashes
- Support context dependencies and ContextModule
- Preload the memory cache for faster builds

The `env-hash` implementation is more generalized than the npm env-hash implementation that was previously used. That one focused on hashing modified time values of folders and files to be as fast as possible. This new one is a little slower hashing files and files of folders but supports use cases like reusing a cache from a prior build on a CI environment. While the CI environment would have all new modified times, if the files' content didn't change the hash of those files will be the same letting the old cache be used.

Context dependencies and ContextModules are now supported. This information is stored in the cache and deserialized like file dependencies and NormalModules. This will allow projects with ContextModules and NormalModules with context dependencies to gain the caching benefit they were previously missing.

Webpack's memory cache allows webpack to make assumptions about previously built modules and skip build steps it would otherwise perform on those modules. That cache is now filled with up to date modules from the HardSource cache letting builds with webpack or the first build with a webpack server to gain the performance those assumptions support.

## 0.3.X Patches

- `0.3.13` Support change to error rendering in webpack 2
- `0.3.12` Support different resolutions in different child compilations
- `0.3.11` Support optional dependencies
- `0.3.10` Fix webpack typo'd dependency (HarmonyCompatiblilityDependency)
- `0.3.9` Support webpack.IgnorePlugin
- `0.3.8` Support webpack 2.2.0 stable release
- `0.3.7` Support webpack 2.2.0-rc.4 (by @swernerx)
- `0.3.6` Allow webpack 2 rc versions in package peer dependencies
- `0.3.5` Support out of order harmony import specifiers
- `0.3.4` Support webpack 2.2.0-rc.0
- `0.3.3` Support webpack 2.1.0-beta.28
- `0.3.1` Fix false positive invalidation against modules like Delegated and External

# 0.2.0

Builds and stores checksums of files built by webpack to better determine when to rebuild modules. This helps HardSource rebuild less in CI environments.

Code contributed by:

- @nikhilmat

## 0.2.X Patches

- `0.2.7` Fix resolve cache invalidation, use resource instead of userRequest
- `0.2.6` Don't log version mismatch message on first build without a cache
- `0.2.5` Stamp cache with library version and fix serializing `loc` strings
- `0.2.4` Fix out of date harmony module tree shaking keys
- `0.2.3` Fix context depending modules rebuild check
- `0.2.2` Flatten dependency loc data for HarmonyImportSpecifier
- `0.2.1` Support functions as option to environmentHash

# 0.1.0

HardSource grew through its `0.0.X` versions up to this point. It currently supports:

- Webpack 1 AMD and CommonJS modules
- Webpack 2 Harmony modules with tree shaking
- Module warnings and errors
- Child Compiler use with plugins like ExtractTextWebpackPlugin and HtmlWebpackPlugin
- Webpack builtin plugins like DllPlugin and UglifyJSPlugin
- Module cache busting when dependencies move
- Multiple caches through the configHash option
- Full cache invalidation through dependency hash comparison

## 0.1.X Patches

- `0.1.4` Consider AMDDefineDependencies as a HardNullDependency like ConstDependency
- `0.1.3` Fix normal module resolver plugin that didn't pass on resolve errors
- `0.1.2` Ignore ExtractText root modules so that child compilers always run and output assets

# 0.0.X

- `0.0.44` Prefix module cache identifier by child compiler subcache name
- `0.0.43` Flatten dependency `loc` field (HMR fix for 0.0.41)
- `0.0.42` Support out of order harmony module export specifier dependencies
- `0.0.41` Freeze and thaw module warnings and errors (by @Strate)
- `0.0.40` Support latest webpack 2 beta (2.1.0-beta.25)
- `0.0.38` Add `configHash` option
- `0.0.37` Add a little logic to avoid re-serializing already serialized modules
- `0.0.36` Freeze and thaw some common fields that weren't before
- `0.0.35` Use additional pass in compilation instead of pre-emptive pass. Fixes use with HMR
- `0.0.34` Correctly thaw harmony specifier dependencies
- `0.0.33` Add HardModule.libIdent to support DllPlugin
- `0.0.32` Fix webpack 2 dependency warnings
- `0.0.30` Fix asset thawing and unnecessary dependency invalidation
- `0.0.28` Help ensure cacheDirectory is used as users expect
- `0.0.27` Use pre-emptive compile when supporting isUsed (webpack 2)
- `0.0.26` Invalidate modules based on webpack 2 tree shaking
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
