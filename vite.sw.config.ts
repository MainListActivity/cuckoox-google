import { defineConfig } from 'vite'
import path from 'path'
import topLevelAwait from 'vite-plugin-top-level-await'

// Service Worker 专用构建配置
export default defineConfig({
  publicDir: false, // 禁用 public 目录复制
  build: {
    target: 'esnext',
    outDir: 'public/sw/',
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/workers/sw-surreal.ts'),
      output: {
        entryFileNames: 'sw-surreal.js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        format: 'es'
      }
    }
  },
  esbuild: {
    target: 'esnext',
    supported: {
      "top-level-await": true
    },
  },
  plugins: [
    topLevelAwait({
      promiseExportName: "__tla",
      promiseImportName: i => `__tla_${i}`
    }),
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    'import.meta.url': '"https://unpkg.com/\@surrealdb/wasm\@1.4.1/dist/surreal/"',
  }
})