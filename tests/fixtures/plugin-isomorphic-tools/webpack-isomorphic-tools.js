var WebpackIsomorphicToolsPlugin = require('webpack-isomorphic-tools/plugin');

// see this link for more info on what all of this means
// https://github.com/halt-hammerzeit/webpack-isomorphic-tools
module.exports = {

  verbosity: 'no webpack stats',

  webpack_assets_file_path: 'tmp/isomorphic-assets.json',

  assets: {
    images: {
      extensions: [
        'png',
      ],
      parser: WebpackIsomorphicToolsPlugin.url_loader_parser,
    },

    style_modules: {
      extensions: ['css'],
      filter: function (module, regex, options, log) {
        return WebpackIsomorphicToolsPlugin.style_loader_filter(module, regex, options, log);
      },

      path: function (module, options, log) {
        return WebpackIsomorphicToolsPlugin.style_loader_path_extractor(module, options, log);
      },

      parser: function (module, options, log) {
        return WebpackIsomorphicToolsPlugin.css_modules_loader_parser(module, options, log);
      },
    },
  },
};
