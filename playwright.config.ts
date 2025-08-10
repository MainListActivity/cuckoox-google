import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import path from 'path';

// 优先加载 .env.test 文件用于测试环境
config({ path: path.resolve('.env.test') });
// 然后加载默认的 .env 作为fallback
config();

export default defineConfig({
  testDir: './e2e', // Directory for E2E test files
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : [['html', { open: 'never', outputFolder: './playwright-report' }], ['list']],
  // 配置输出目录
  outputDir: './playwright-report/test-results',
  use: {
    baseURL: 'http://localhost:5173', // Assuming Vite's default dev server port
    trace: 'on-first-retry',
    // 配置截图存储位置
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // 移除可能导致CORS问题的header
    // extraHTTPHeaders: {
    //   'X-Test-Tenant': 'TEST1',
    // },
  },
  // 全局设置环境变量用于测试隔离
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  // 配置测试服务器
  webServer: {
    command: `VITE_SURREALDB_WS_URL=${process.env.VITE_SURREALDB_WS_URL || ''} VITE_DB_ACCESS_MODE=${process.env.VITE_DB_ACCESS_MODE || 'service-worker'} VITE_API_URL=${process.env.VITE_API_URL || ''} bun run dev`,
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: {
      // 使用.env文件中的配置
      NODE_ENV: 'test',
      VITE_SURREALDB_WS_URL: process.env.VITE_SURREALDB_WS_URL || '',
      VITE_DB_ACCESS_MODE: process.env.VITE_DB_ACCESS_MODE || 'service-worker',
      VITE_API_URL: process.env.VITE_API_URL || '',
      VITE_TURNSTILE_SITE_KEY: process.env.VITE_TURNSTILE_SITE_KEY || '',
    },
  },
});
