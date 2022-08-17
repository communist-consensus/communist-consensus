import path from 'node:path';
import { fileURLToPath } from 'node:url';
import HtmlWebpackPlugin from 'html-webpack-plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  {
    module: {
      rules: [
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          loader: 'babel-loader',
          options: {
            ignore: ['node_modules/**/*'],
            presets: [
              '@babel/preset-typescript',
              '@babel/preset-react',
            ],
            plugins: [
              [
                '@babel/plugin-proposal-decorators',
                {
                  legacy: true,
                },
              ],
              '@babel/proposal-class-properties',
              '@babel/proposal-object-rest-spread',
            ],
            sourceMaps: 'inline',
          },
          include: [
            path.resolve(__dirname, 'src/frontend'),
            path.resolve(__dirname, 'src/shared'),
          ],
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js', '.tsx', '.jsx'],
    },
    entry: {
      index: path.join(__dirname, 'src/frontend/index.tsx'),
    },
    output: {
      path: path.join(__dirname, 'dist/frontend'),
      filename: '[name].js',
    },
    mode: 'development',

    devtool: 'inline-source-map',
    plugins: [
      new HtmlWebpackPlugin({
        filename: 'index.html',
        chunks: ['index'],
        template: './src/frontend/index.html',
      }),
    ],
  },
];
