import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/workers/sw-surreal.ts',
  output: {
    file: 'public/sw-surreal.js',
    format: 'iife',
    name: 'SurrealServiceWorker'
  },
  plugins: [
    nodeResolve({
      preferBuiltins: false,
      browser: true
    }),
    typescript({
      lib: ['webworker', 'es2020'],
      target: 'es2020'
    }),
    terser()
  ]
};