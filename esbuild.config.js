// esbuild.config.js
module.exports = {
  target: 'node16',
  format: 'cjs',
  sourcemap: true,
  platform: 'node',
  // Additional esbuild options for Jest
  loaders: {
    '.ts': 'ts',
    '.js': 'js'
  }
};
