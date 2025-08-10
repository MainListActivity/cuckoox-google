import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', // Directory for E2E test files
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173', // Assuming Vite's default dev server port
    trace: 'on-first-retry',
    // 设置测试隔离环境变量，使用 TEST1 租户
    extraHTTPHeaders: {
      'X-Test-Tenant': 'TEST1',
    },
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
    command: 'bun run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: {
      // 设置测试环境变量
      NODE_ENV: 'test',
      VITE_TEST_TENANT: 'TEST1',
      VITE_SURREAL_NAMESPACE: 'test',
      VITE_SURREAL_DATABASE: 'TEST1',
    },
  },
});
