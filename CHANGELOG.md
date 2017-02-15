# 0.3.0

- Internal env-hash implementation relying on file hashes
- Support context dependencies and ContextModule
- Preload the memory cache for faster builds

The `env-hash` implementation is more generalized than the npm env-hash implementation that was previously used. That one focused on hashing modified time values of folders and files to be as fast as possible. This new one is a little slower hashing files and files of folders but supports use cases like reusing a cache from a prior build on a CI environment. While the CI environment would have all new modified times, if the files' content didn't change the hash of those files will be the same letting the old cache be used.

Context dependencies and ContextModules are now supported. This information is stored in the cache and deserialized like file dependencies and NormalModules. This will allow projects with ContextModules and NormalModules with context dependencies to gain the caching benefit they were previously missing.

Webpack's memory cache allows webpack to make assumptions about previously built modules and skip build steps it would otherwise perform on those modules. That cache is now filled with up to date modules from the HardSource cache letting builds with webpack or the first build with a webpack server to gain the performance those assumptions support.

## 0.3.X Patches

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
