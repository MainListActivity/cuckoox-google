#!/usr/bin/env node

/**
 * 测试SurrealDB连接配置
 */

import { Surreal } from 'surrealdb';
import { surrealdbWasmEngines } from '@surrealdb/wasm';
import { config } from 'dotenv';
import path from 'path';

// 加载测试环境变量
config({ path: path.resolve('.env.test') });

console.log('🔗 测试SurrealDB连接配置...');
console.log('环境变量:');
console.log(`  VITE_SURREALDB_WS_URL: ${process.env.VITE_SURREALDB_WS_URL}`);
console.log(`  VITE_SURREALDB_NS: ${process.env.VITE_SURREALDB_NS}`);
console.log(`  VITE_SURREAL_DATABASE: ${process.env.VITE_SURREAL_DATABASE}`);

try {
  // 初始化WASM引擎
  console.log('\n📦 初始化WASM引擎...');
  const wasmEngines = await surrealdbWasmEngines();
  console.log('可用的引擎:', wasmEngines);
  
  // 创建连接
  console.log('\n🚀 创建SurrealDB连接...');
  const db = new Surreal({
    engines: wasmEngines
  });
  
  const endpoint = process.env.VITE_SURREALDB_WS_URL || 'ws://localhost:8000/rpc';
  const namespace = process.env.VITE_SURREALDB_NS || 'ck_go';
  const database = process.env.VITE_SURREAL_DATABASE || 'TEST1';
  
  console.log(`连接到: ${endpoint}`);
  console.log(`命名空间: ${namespace}`);
  console.log(`数据库: ${database}`);
  
  // 测试连接
  await db.connect(endpoint);
  console.log('✅ 连接成功!');
  
  // 选择数据库
  await db.use({ namespace, database });
  console.log('✅ 数据库选择成功!');
  
  // 测试查询
  try {
    const result = await db.query('return 1;');
    console.log('✅ 测试查询成功:', result);
  } catch (queryError) {
    console.log('⚠️  测试查询失败 (可能需要认证):', queryError.message);
  }
  
  // 关闭连接
  await db.close();
  console.log('✅ 连接已关闭');
  
  console.log('\n🎉 数据库连接测试完成 - 配置正常!');
  
} catch (error) {
  console.error('\n❌ 数据库连接测试失败:');
  console.error('错误类型:', error.constructor.name);
  console.error('错误消息:', error.message);
  console.error('错误堆栈:', error.stack);
}