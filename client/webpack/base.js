const webpack = require("webpack");
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "development",
  devtool: "eval-source-map",
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader"
        }
      },
      {
        test: [/\.vert$/, /\.frag$/],
        use: "raw-loader"
      },
      {
        test: /\.(gif|png|jpe?g|svg|xml)$/i,
        use: "file-loader"
      }
    ]
  },
  plugins: [
    new CleanWebpackPlugin({
      root: path.resolve(__dirname, "../")
    }),
    new webpack.DefinePlugin({
      CANVAS_RENDERER: JSON.stringify(true),
      WEBGL_RENDERER: JSON.stringify(true),
      // Multiplayer server address, e.g. SERVER_URL=wss://pokemmo-server.fly.dev npm run build
      __SERVER_URL__: JSON.stringify(process.env.SERVER_URL || "")
    }),
    // Manifest, service worker and icons for "install on home screen"
    new CopyWebpackPlugin({
      patterns: [{ from: path.resolve(__dirname, "../public"), to: "." }]
    }),
    new HtmlWebpackPlugin({
      template: "./index.html"
    })
  ]
};
