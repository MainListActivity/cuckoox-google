/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import fs from 'fs';
import path from 'path';
import { resolve } from 'path';
import { build } from 'vite';

// 在 ES 模块中获取 __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 构建 Service Worker 的函数
export async function buildServiceWorker() {
  console.log('Building Service Worker...');
  
  // 为了避免 public 目录冲突，先构建到临时目录
  const tempDir = resolve(__dirname, 'dist-sw');
  
  const result = await build({
    configFile: false,
    publicDir: false, // 禁用 public 目录复制
    build: {
      lib: {
        entry: resolve(__dirname, 'src/workers/sw-surreal.ts'),
        name: 'SurrealServiceWorker',
        formats: ['es'],
        fileName: () => 'sw-surreal.js'
      },
      rollupOptions: {
        external: ['@surrealdb/wasm', '/wasm/surrealdb.js'],
        output: {
          format: 'es',
          dir: tempDir,
          entryFileNames: 'sw-surreal.js',
          inlineDynamicImports: true
        }
      },
      target: 'esnext',
      outDir: tempDir,
      emptyOutDir: true,
      minify: true
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'http://localhost:8082')
    },
    esbuild: {
      target: 'esnext',
      supported: {
        'top-level-await': true
      }
    }
  });
  
  // 复制构建结果到 public 目录
  const swSource = resolve(tempDir, 'sw-surreal.js');
  const swDest = resolve(__dirname, 'public', 'sw-surreal.js');
  
  if (fs.existsSync(swSource)) {
    fs.copyFileSync(swSource, swDest);
    // 清理临时目录
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('✅ Service Worker built successfully and placed in public/');
  } else {
    throw new Error('Service Worker build output not found');
  }
  
  return result;
}

export default defineConfig(({ mode }) => {
  // 自定义环境变量加载逻辑
  const env = {} as Record<string, string>;

  // 加载顺序：.env.local -> .env.dev (dev模式) -> .env
  const envFiles = [
    '.env',                    // 基础配置
    ...(mode === 'development' ? ['.env.dev'] : []), // dev模式时加载.env.dev
    '.env.local'               // 本地配置（最高优先级）
  ];

  // 按顺序加载环境变量文件
  envFiles.forEach(file => {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      // 读取文件内容并解析
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length > 0) {
            env[key.trim()] = valueParts.join('=').trim();
          }
        }
      });
      console.log(`✓ 已加载环境变量文件: ${file}`);
    }
  });

  // 输出最终的环境变量配置（仅显示VITE_开头的）
  console.log('📋 当前环境变量配置:');
  Object.keys(env)
    .filter(key => key.startsWith('VITE_'))
    .forEach(key => {
      console.log(`  ${key}=${env[key]}`);
    });

  return {
    plugins: [
      react()
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      }
    },
    // 将环境变量传递给Vite
    define: {
      ...Object.keys(env).reduce((acc, key) => {
        if (key.startsWith('VITE_')) {
          acc[`import.meta.env.${key}`] = JSON.stringify(env[key]);
        }
        return acc;
      }, {} as Record<string, string>)
    },
    build: {
      target: 'esnext'
    },
    optimizeDeps: {
      include: ['@mui/material', '@mui/icons-material'],
      exclude: ['@mui/icons-material/esm', '@surrealdb/wasm'],
      esbuildOptions: {
        target: "esnext",
      },
    },
    esbuild: {
      supported: {
        "top-level-await": true
      },
    },
    server: {
      fs: {
        strict: false
      },
      allowedHosts: ['dev.cuckoox.cn']
    },
    test: { // Vitest configuration
      globals: true,
      environment: 'jsdom', // Common for React component testing
      include: ['tests/unit/**/*.test.{ts,tsx}'],
      setupFiles: './tests/setup.ts', // Setup file for test environment
      testTimeout: 10000, // 10 seconds timeout for each test
      pool: 'forks', // Use forks pool to avoid file handle issues
      poolOptions: {
        forks: {
          singleFork: true // Use single fork to reduce resource usage
        }
      },
      exclude: [ // Default Vitest excludes + e2e
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        'e2e/**' // Exclude E2E tests from unit test runner
      ],
    }
  };
});
