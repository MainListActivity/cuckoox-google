import { defineConfig, Plugin } from 'vite'
import path from 'path'
import { fileURLToPath, URL } from 'node:url';
import topLevelAwait from 'vite-plugin-top-level-await'

// 已废弃，待后续移除
// 将import手动添加到文件开头 - 在所有插件处理完成后执行
function prependImportToSwSurreal(): Plugin<unknown> {
  return {
    name: `prepend-import-to-sw-surreal`,
    enforce: 'post', // 确保在所有其他插件之后执行
    generateBundle: {
      order: 'post', // 在最后阶段执行
      handler(options, bundle) {
        // 找到 sw-surreal.js 文件
        const swSurrealFile = Object.keys(bundle).find(key => 
          key.includes('sw-surreal.js') || key === 'sw-surreal.js'
        );
        
        if (swSurrealFile && bundle[swSurrealFile]) {
          const file = bundle[swSurrealFile];
          if (file.type === 'chunk') {
            // 强制在文件开头添加 import 语句，不管是否已存在
            file.code = `import './wasm-shim.js';\n${file.code}`;
            console.log(`Added import statement to ${swSurrealFile} (post-processing)`);
          }
        }
      }
    }
  }
}

// Service Worker 专用构建配置
export default defineConfig({
  publicDir: false, // 禁用 public 目录复制
  build: {
    target: 'esnext',
    outDir: 'public/sw/',
    emptyOutDir: false,
    minify: false, // 禁用代码压缩和混淆
    rollupOptions: {
      input: {
        'wasm-shim': path.resolve(__dirname, 'src/workers/wasm-shim.ts'),
        'sw-surreal': path.resolve(__dirname, 'src/workers/sw-surreal.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        format: 'es',
        inlineDynamicImports: false
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
      promiseImportName: (i: number) => `__tla_${i}`
    }),
    prependImportToSwSurreal(), // 这个插件会在最后执行 (enforce: 'post')
  ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      }
    },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    'import.meta.url': '"https://unpkg.com/@surrealdb/wasm@1.4.1/dist/surreal/"',
  }
})