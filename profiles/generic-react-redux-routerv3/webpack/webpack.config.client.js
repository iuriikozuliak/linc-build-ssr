const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const ManifestPlugin = require('webpack-manifest-plugin');

process.env.NODE_ENV = 'production';

const LINC_DIR = path.resolve(__dirname, '..');
const PROJECT_DIR = process.cwd();

function ensureSlash(path, needsSlash) {
  var hasSlash = path.endsWith('/');
  if (hasSlash && !needsSlash) {
    return path.substr(path, path.length - 1);
  } else if (!hasSlash && needsSlash) {
    return path + '/';
  } else {
    return path;
  }
}

const packageJson = require(path.resolve(PROJECT_DIR, 'package.json'));
const lincConfig = packageJson.linc || {};
const srcDir = lincConfig.sourceDir || 'src';

const deps = Object.keys(packageJson.dependencies).concat(Object.keys(packageJson.devDependencies));
const hasLess = deps.includes('less');

// We use "homepage" field to infer "public path" at which the app is served.
// Webpack needs to know it to put the right <script> hrefs into HTML even in
// single-page apps that may serve index.html for nested URLs like /todos/42.
// We can't use a relative path in HTML because we don't want to load something
// like /todos/42/static/js/bundle.7289d.js. We have to know the root.
var homepagePath = packageJson.homepage;
var homepagePathname = homepagePath ? url.parse(homepagePath).pathname : '/';
// Webpack uses `publicPath` to determine where the app is being served from.
// It requires a trailing slash, or the file assets will get an incorrect path.
var publicPath = ensureSlash(homepagePathname, true);
// `publicUrl` is just like `publicPath`, but we will provide it to our app
// as %PUBLIC_URL% in `index.html` and `process.env.PUBLIC_URL` in JavaScript.
// Omit trailing slash as %PUBLIC_PATH%/xyz looks better than %PUBLIC_PATH%xyz.
var publicUrl = ensureSlash(homepagePathname, false);

const url_loader_config = {
  exclude: [
    /\.html$/,
    /\.(js|jsx)$/,
    /\.css$/,
    /\.json$/,
    /\.svg$/,
    /\.woff$/,
    /\.woff2$/,
    /\.eot$/,
    /\.ttf$/,
  ],
  loader: 'url-loader',
  query: {
    limit: 10000,
    name: '_assets/media/[name].[hash:8].[ext]'
  }
}

const extractPlugin = ExtractTextPlugin.extract({
  fallback: { loader: 'style-loader', options: { sourceMap: true } },
  use:[{ 
    loader: 'css-loader', 
    options: { sourceMap: true }
  }]
})

const css_loader = {
  test: /\.(css)$/,
  loader: extractPlugin
}

const babel_config = {
  loader: {
    test: /\.js$/,
    loader: 'babel-loader',
    exclude: /node_modules(?!\/linc-profile-generic-react-redux-routerv3\/client\.js$)/,
    query: {}
  },
  query: {
    presets: {},
    plugins: {}
  }
}

try {
  const contents = fs.readFileSync(path.resolve(PROJECT_DIR, '.babelrc'));
  const config = JSON.parse(contents);
  if(config.presets) {
    config.presets.forEach((elem) => {if(elem.indexOf('react') < 0) babel_config.query.presets[elem] = ''});   
  }
  if(config.plugins) {
    config.plugins.forEach((elem) => {if(elem.indexOf('react') < 0) babel_config.query.plugins[elem] = ''});
  }
} catch (e) {
  //ignore
}

babel_config.loader.query.presets = Object.keys(babel_config.query.presets).map((elem) => path.resolve(PROJECT_DIR, 'node_modules', `babel-preset-${elem}`));
babel_config.loader.query.plugins = Object.keys(babel_config.query.plugins).map((elem) => path.resolve(PROJECT_DIR, 'node_modules', `babel-plugin-${elem}`));

babel_config.loader.query.presets.push(path.resolve(LINC_DIR, 'node_modules', `babel-preset-react-app`))

module.exports = {
  entry: {
    'main': [path.resolve(LINC_DIR, 'client.js')]
  },

  resolve: {
    alias: {
      'linc-config-js': path.resolve(PROJECT_DIR, srcDir, 'linc.config.js')
    },

    modules: ["node_modules", path.resolve(PROJECT_DIR, "node_modules")],
    extensions: [".js", ".json", ".ts", ".tsx"]
  },
  output: {
    // The build folder.
    path: path.resolve(PROJECT_DIR, 'dist', 'static'),
    // Generated JS file names (with nested folders).
    // There will be one main bundle, and one file per asynchronous chunk.
    // We don't currently advertise code splitting but Webpack supports it.
    filename: '_assets/js/[name].[chunkhash:8].js',
    chunkFilename: '_assets/js/[name].[chunkhash:8].chunk.js',
    // We inferred the "public path" (such as / or /my-project) from homepage.
    publicPath: publicPath
  },

  module: {
    rules: [
      url_loader_config,
      {
        test: /\.svg$/,
        loader: 'svg-url-loader',
        query: {
          limit: 10000,
          name: '_assets/media/[name].[hash:8].[ext]'
        }
      },
      { enforce: "pre", test: /\.js$/, loader: "source-map-loader" },
      babel_config.loader,
      css_loader,
      {
        test: /\.(woff|woff2|eot|ttf)$/,
        loader: 'file-loader',
        options: {
          name: '_assets/fonts/[name].[ext]'
        }
      }
    ]
  },

  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production')
    }),
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.LoaderOptionsPlugin({
      minimize: true,
      debug: false
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendor',
      minChunks: (module) => (
        // return true if module is from node_modules
        typeof module.userRequest === 'string' &&
        module.userRequest.indexOf('/node_modules/') >= 0
      )
    }),
    // extract css as text from js
    new ExtractTextPlugin({
      filename: '_assets/css/[name].[chunkhash:8].css'
    }),
    new ManifestPlugin({
      fileName: '../lib/asset-manifest.json'
    }),
    new webpack.optimize.UglifyJsPlugin({
      sourceMap: true,
      mangle: {
        screw_ie8: true,
        keep_fnames: true
      },
      compress: {
        screw_ie8: true
      },
      comments: false
    })
  ],

  stats: {
    children: false,
  },

  // https://webpack.js.org/configuration/devtool/
  // 'eval' | 'cheap-eval-source-map' | 'cheap-module-eval-source-map' | 'eval-source-map'
  devtool: 'source-map'
};

if(deps.includes('typescript')) {
  url_loader_config.exclude.push(/\.(ts|tsx)$/);
  module.exports.module.rules.push({ test: /\.tsx?$/, loader: "awesome-typescript-loader" })
}

if(deps.includes('stylus')) {
  url_loader_config.exclude.push(/\.(styl)$/);
  css_loader.test = /\.(css|styl)$/
  extractPlugin.push({loader: 'stylus-loader',});
  console.log(extractPlugin);
}