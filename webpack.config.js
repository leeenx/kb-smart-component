const path = require('path');
const fs = require('fs');

module.exports = {
  mode: 'production',
  context: path.resolve(__dirname, './src'),
  entry: {
    index: path.resolve(__dirname, './src/index.ts')
  },
  output: {
    path: path.resolve(__dirname, './dist'),
    filename: '[name].js',
    publicPath: '/',
  },
  optimization: {
    minimize: false
  },
  externals: {
    'miniprogram-element': `require("miniprogram-element")`,
    'miniprogram-render': `require("miniprogram-render")`,
    'kbs-dsl-loader': `require("kbs-dsl-loader")`,
    'kbs-dsl-resolver': `require("kbs-dsl-resolver")`
  },
  module: {
    rules: [
      {
        test: /node_modules\/react-dom/,
        use: [path.resolve(__dirname, './react-dom-loader.js')]
      },
      {
        test: /\.[t|j]s(x?)$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      }
    ],
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx', '.jsx']
  },
  plugins: [
    {
      apply: function() {
        // 创建文件夹
        fs.mkdirSync(path.resolve(__dirname, './dist'));
        // 移动文件
        ['index.json', 'index.wxml', 'index.wxss'].forEach((filename) => {
          const sourcePath = path.resolve(__dirname, `./src/${filename}`);
          const targetPath = path.resolve(__dirname, `./dist/${filename}`);
          fs.copyFileSync(sourcePath, targetPath);
        });
      }
    }
  ]
};