import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import path from 'path';

// 加载环境变量文件，按优先级顺序：.env.test.local > .env.test > .env
// 先加载基础配置
config(); // 加载 .env
config({ path: path.resolve('.env.test'), override: true }); // 加载 .env.test 覆盖 .env
config({ path: path.resolve('.env.test.local'), override: true }); // 加载 .env.test.local 覆盖前面的

export default defineConfig({
  testDir: './e2e', // Directory for E2E test files
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : [['html', { open: 'never', outputFolder: './playwright-report' }], ['list']],
  // 保留测试结果和报告
  preserveOutput: 'always',
  // 配置输出目录，确保报告保存
  outputDir: './playwright-report/test-results',
  // 设置全局默认超时时间为30秒
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:4173',
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
  // 配置测试服务器 - 使用preview服务器（现在禁用，使用手动启动的服务器）
  // webServer: {
  //   command: 'bun run build && bun run preview',
  //   url: 'http://localhost:4173',
  //   reuseExistingServer: true, // 总是复用现有服务器
  //   timeout: 180 * 1000, // 增加到3分钟，因为需要构建
  // },
});
