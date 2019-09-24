const DtsBundleWebpack = require('dts-bundle-webpack')
var opts = {
  name: 'qube',
  main: './dist/index.d.ts',
  removeSource: true,
}
module.exports = {
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  plugins: [
    new DtsBundleWebpack(opts)
  ],
  output: {
    filename: './qube.js',
    libraryTarget: "commonjs"
  }
};