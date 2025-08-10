#!/usr/bin/env node

/**
 * E2E测试专用开发服务器启动脚本
 * 确保使用正确的测试环境变量，覆盖本地开发配置
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// 临时重命名本地环境文件，避免覆盖测试配置
const localEnvFiles = ['.env.local', '.env.dev'];
const backupSuffix = '.e2e-backup';

function backupLocalEnvFiles() {
  localEnvFiles.forEach(file => {
    if (fs.existsSync(file)) {
      fs.renameSync(file, file + backupSuffix);
      console.log(`📁 临时备份: ${file} -> ${file}${backupSuffix}`);
    }
  });
}

function restoreLocalEnvFiles() {
  localEnvFiles.forEach(file => {
    if (fs.existsSync(file + backupSuffix)) {
      fs.renameSync(file + backupSuffix, file);
      console.log(`📁 恢复文件: ${file}${backupSuffix} -> ${file}`);
    }
  });
}

// 设置E2E测试环境变量
const e2eEnv = {
  ...process.env,
  NODE_ENV: 'test',
  VITE_TEST_TENANT: 'TEST1',
  VITE_SURREALDB_WS_URL: 'wss://law.cuckoox.cn/rpc',
  VITE_DB_ACCESS_MODE: 'service-worker',
  VITE_API_URL: 'https://api.cuckoox.cn',
  VITE_TURNSTILE_SITE_KEY: '0x4AAAAAABjI4u3Q7SX5vffg',
  VITE_SURREALDB_NS: 'ck_go',
  VITE_SURREAL_NAMESPACE: 'test',
  VITE_SURREAL_DATABASE: 'TEST1',
};

console.log('🧪 启动E2E测试开发服务器...');
console.log('📊 使用租户:', e2eEnv.VITE_TEST_TENANT);
console.log('🔌 数据库连接:', e2eEnv.VITE_SURREALDB_WS_URL);
console.log('🌐 API地址:', e2eEnv.VITE_API_URL);

// 备份本地环境文件
backupLocalEnvFiles();

// 启动vite开发服务器
const viteProcess = spawn('bunx', ['vite'], {
  env: e2eEnv,
  stdio: 'inherit',
  cwd: process.cwd()
});

viteProcess.on('error', (error) => {
  console.error('启动开发服务器失败:', error);
  restoreLocalEnvFiles();
  process.exit(1);
});

viteProcess.on('exit', (code) => {
  console.log('🔄 恢复本地环境文件...');
  restoreLocalEnvFiles();
  process.exit(code);
});

// 处理进程终止信号
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭E2E测试服务器...');
  viteProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  viteProcess.kill('SIGTERM');
});

// 确保在意外退出时也恢复文件
process.on('exit', () => {
  restoreLocalEnvFiles();
});

process.on('uncaughtException', (error) => {
  console.error('未捕获异常:', error);
  restoreLocalEnvFiles();
  process.exit(1);
});