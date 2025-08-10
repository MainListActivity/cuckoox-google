/**
 * Playwright 全局测试设置
 * 配置 TEST1 租户环境，确保测试隔离
 */

import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  // 设置测试环境变量
  process.env.NODE_ENV = 'test';
  process.env.VITE_TEST_TENANT = 'TEST1';
  process.env.VITE_SURREAL_NAMESPACE = 'test';
  process.env.VITE_SURREAL_DATABASE = 'TEST1';
  
  console.log('🔧 Global setup: 配置 TEST1 租户测试环境');
  console.log('📊 使用租户:', process.env.VITE_TEST_TENANT);
  console.log('🗄️ 数据库:', process.env.VITE_SURREAL_DATABASE);
  
  // 这里可以添加其他全局设置，如：
  // - 初始化测试数据库
  // - 设置测试用户
  // - 配置外部服务
}

export default globalSetup;