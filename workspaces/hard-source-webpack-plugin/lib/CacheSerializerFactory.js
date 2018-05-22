/**
 * A factory wrapper around a webpack compiler plugin to create a serializer
 * object that caches a various data hard-source turns into json data without
 * circular references.
 *
 * The wrapper uses a plugin hook on the webpack Compiler called
 * `'hard-source-cache-factory'`. It is a waterfall plugin, the returned value
 * of one plugin handle is passed to the next as the first argument. This
 * plugin is expected to return a factory function that takes one argument. The
 * argument passed to the factory function is the info about what kind of cache
 * serializer hard-source wants.
 *
 * The info object contains three fields, `name`, `type`, and `cacheDirPath`.
 *
 * One example of info might be
 *
 * ```js
 * {
 *   name: 'asset',
 *   type: 'file',
 *   cacheDirPath: '/absolute/path/to/my-project/path/configured/in/hard-source'
 * }
 * ```
 *
 * - `name` is the general name of the cache in hard-source.
 * - `type` is the type of data contained. The `file` type means it'll be file
 *    data like large buffers and strings. The `data` type means its generally
 *    smaller info and serializable with JSON.stringify.
 * - `cacheDirPath` is the root of the hard-source disk cache. A serializer
 *   should add some further element to the path for where it will store its
 *   info.
 *
 * So an example plugin handle should take the `factory` argument and return
 * its own wrapping factory function. That function will take the `info` data
 * and if it wants to returns a serializer. Otherwise its best to call the
 * factory passed into the plugin handle.
 *
 * ```js
 * compiler.plugin('hard-source-cache-factory', function(factory) {
 *   return function(info) {
 *     if (info.type === 'data') {
 *       return new MySerializer({
 *         cacheDirPath: join(info.cacheDirPath, info.name)
 *       });
 *     }
 *     return factory(info);
 *   };
 * });
 * ```
 *
 * @module hard-source-webpack-plugin/cache-serializer-factory
 * @author Michael "Z" Goddard <mzgoddard@gmail.com>
 */

/**
 * @constructor Serializer
 * @memberof module:hard-source-webpack-plugin/cache-serializer-factory
 */

/**
 * @method read
 * @memberof module:hard-source-webpack-plugin/cache-serializer-factory~Serializer#
 * @returns {Promise} promise that resolves the disk cache's contents
 * @resolves {Object} a map of keys to current values stored on disk that has
 *   previously been cached
 */

/**
 * @method write
 * @memberof module:hard-source-webpack-plugin/cache-serializer-factory~Serializer#
 * @param {Array.Object} ops difference of values to be stored in the disk cache
 * @param {string} ops.key
 * @param ops.value
 * @returns {Promise} promise that resolves when writing completes
 */

const FileSerializerPlugin = require('./SerializerFilePlugin');
const Append2SerializerPlugin = require('./SerializerAppend2Plugin');

const pluginCompat = require('./util/plugin-compat');

/**
 * @constructor CacheSerializerFactory
 * @memberof module:hard-source-webpack-plugin/cache-serializer-factory
 */
class CacheSerializerFactory {
  constructor(compiler) {
    this.compiler = compiler;

    pluginCompat.register(compiler, 'hardSourceCacheFactory', 'syncWaterfall', [
      'factory',
    ]);

    pluginCompat.tap(
      compiler,
      'hardSourceCacheFactory',
      'default factory',
      factory => info => {
        // It's best to have plugins to hard-source listed in the config after it
        // but to make hard-source easier to use we can call the factory of a
        // plugin passed into this default factory.
        if (factory) {
          serializer = factory(info);
          if (serializer) {
            return serializer;
          }
        }

        // Otherwise lets return the default serializers.
        switch (info.type) {
          case 'data':
            return CacheSerializerFactory.dataSerializer.createSerializer(info);
            break;
          case 'file':
            return CacheSerializerFactory.fileSerializer.createSerializer(info);
            break;
          default:
            throw new Error(
              `Unknown hard-source cache serializer type: ${info.type}`,
            );
            break;
        }
      },
    );
  }

  /**
   * @method create
   * @memberof module:hard-source-webpack-plugin/cache-serializer-factory~CacheSerializerFactory#
   * @param {Object} info
   * @param {String} info.name
   * @param {String} info.type
   * @param {String} info.cacheDirPath
   * @returns {Serializer}
   */
  create(info) {
    const factory = pluginCompat.call(this.compiler, 'hardSourceCacheFactory', [
      null,
    ]);

    const serializer = factory(info);

    return serializer;
  }
}

/**
 * The default data serializer factory.
 */
CacheSerializerFactory.dataSerializer = Append2SerializerPlugin;

/**
 * The default file serializer factory.
 */
CacheSerializerFactory.fileSerializer = FileSerializerPlugin;

module.exports = CacheSerializerFactory;
