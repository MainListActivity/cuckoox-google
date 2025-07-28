/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import fs from 'fs';
import path from 'path';

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
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        strategies: 'generateSW',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                }
              }
            }
          ]
        },
        includeAssets: ['assets/logo/*.svg', 'favicon.ico'],
        manifest: {
          name: 'CuckooX 破产案件管理系统',
          short_name: 'CuckooX',
          description: '企业破产案件管理系统 - 提供完整的破产案件生命周期管理',
          theme_color: '#009688',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait-primary',
          scope: '/',
          start_url: '/',
          id: '/',
          categories: ['business', 'productivity', 'utilities'],
          lang: 'zh-CN',
          dir: 'ltr',
          icons: [
            {
              src: '/assets/logo/favicon.svg',
              sizes: '32x32',
              type: 'image/svg+xml',
              purpose: 'any'
            },
            {
              src: '/assets/logo/cuckoo-icon.svg',
              sizes: '48x48 72x72 96x96 144x144 192x192 512x512',
              type: 'image/svg+xml',
              purpose: 'any'
            },
            {
              src: '/assets/logo/cuckoo-icon.svg',
              sizes: '48x48 72x72 96x96 144x144 192x192 512x512',
              type: 'image/svg+xml',
              purpose: 'maskable'
            }
          ]
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      })
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
      allowedHosts: ['dev.cuckoox.cn', 'dc.cuckoox.cn', 'code.cuckoox.cn']
    },
    preview:{
      port: 5173
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
