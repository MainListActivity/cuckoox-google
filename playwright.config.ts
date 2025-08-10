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
    baseURL: 'http://localhost:5174', // Updated port for E2E testing
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
  // 配置测试服务器 - 假设服务器已启动
  // webServer: {
  //   command: 'node scripts/dev-e2e.js',
  //   url: 'http://localhost:5173',
  //   reuseExistingServer: true,
  //   timeout: 120 * 1000,
  // },
});
