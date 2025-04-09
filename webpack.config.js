const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  entry: {
    popup: './src/popup.tsx',
    content: './src/content/index.ts',
    background: './src/background/index.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
    pathinfo: false
  },
  target: 'web',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
          }
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  require('tailwindcss'),
                  require('autoprefixer'),
                ],
              },
            },
          },
        ],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    fallback: {
      "process": false
    }
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'public/popup.html', to: 'popup.html' },
        { from: 'public/popup.css', to: 'popup.css' },
        { from: 'public/content.css', to: 'content.css' },
        { from: 'public/icons', to: 'icons' },
        { from: 'public/manifest.json', to: 'manifest.json' },
        { from: 'public/api-keys.json', to: 'api-keys.json' }
      ],
    }),
    new webpack.DefinePlugin({
      'process.env': '{}',
      'process': '{}'
    }),
    new webpack.optimize.MinChunkSizePlugin({
      minChunkSize: 10000000 // גדול מאוד כדי למנוע פיצול
    }),
  ],
  optimization: {
    splitChunks: false,
    runtimeChunk: false,
    concatenateModules: true,
    minimize: true,
    providedExports: true,
    usedExports: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: {
            comments: false
          },
          compress: {
            drop_console: false
          }
        },
        extractComments: false
      })
    ]
  },
  performance: {
    hints: false,
    maxAssetSize: 4000000,
    maxEntrypointSize: 4000000
  },
  devtool: 'cheap-source-map'
}; 