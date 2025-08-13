/**
 * Playwright 全局测试设置
 * 配置 TEST1 租户环境，确保测试隔离
 */

import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  // 确保使用测试环境变量 - 通过TEST1租户隔离数据
  process.env.NODE_ENV = 'test';
  process.env.VITE_TEST_TENANT = 'TEST1';
  process.env.VITE_SURREAL_NAMESPACE = 'test';
  process.env.VITE_SURREAL_DATABASE = 'TEST1';
  // 使用生产环境SurrealDB连接，通过租户隔离数据
  process.env.VITE_SURREALDB_WS_URL = 'wss://law.cuckoox.cn/rpc';
  process.env.VITE_SURREALDB_NS = 'ck_go';
  process.env.VITE_DB_ACCESS_MODE = 'service-worker';
  process.env.VITE_API_URL = 'https://api.cuckoox.cn';
  process.env.VITE_TURNSTILE_SITE_KEY = '0x4AAAAAABjI4u3Q7SX5vffg';
  
  console.log('🔧 Global setup: 配置 TEST1 租户测试环境');
  console.log('📊 使用租户:', process.env.VITE_TEST_TENANT);
  console.log('🗄️ 数据库:', process.env.VITE_SURREAL_DATABASE);
  console.log('🔌 数据库连接:', process.env.VITE_SURREALDB_WS_URL);
  console.log('🚀 数据库访问模式:', process.env.VITE_DB_ACCESS_MODE);
  
  // 这里可以添加其他全局设置，如：
  // - 初始化测试数据库
  // - 设置测试用户
  // - 配置外部服务
}

export default globalSetup;