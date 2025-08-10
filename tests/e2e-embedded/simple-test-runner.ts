#!/usr/bin/env node

/**
 * 简化的测试运行器
 * 避免复杂的 Vitest 配置问题，直接运行核心功能测试
 */

import { TestDatabaseManager } from '../database/TestDatabaseManager';
import { TestDiagnostics } from '../utils/testDiagnostics';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  error?: string;
}

async function runSimpleTests() {
  console.log('🚀 开始简化测试运行器...');
  
  let testsPassed = 0;
  let testsFailed = 0;
  const results: TestResult[] = [];

  async function runTest(name: string, testFn: () => Promise<void>) {
    try {
      console.log(`🧪 运行测试: ${name}`);
      await testFn();
      console.log(`✅ 测试通过: ${name}`);
      testsPassed++;
      results.push({ name, status: 'PASS' });
    } catch (error: any) {
      console.error(`❌ 测试失败: ${name}`, error.message);
      testsFailed++;
      results.push({ name, status: 'FAIL', error: error.message });
    }
  }

  let dbManager: TestDatabaseManager | null = null;

  try {
    // 初始化数据库
    dbManager = TestDatabaseManager.getInstance();
    await dbManager.initialize();
    
    // 测试1: 数据库连接
    await runTest('数据库连接测试', async () => {
      const db = dbManager!.getDatabase();
      const result = await db.query('SELECT 1 as test;');
      if (!result || !Array.isArray(result) || result.length === 0) {
        throw new Error('数据库查询失败');
      }
      console.log('  数据库查询结果:', result);
    });

    // 测试2: 用户查询
    await runTest('用户数据查询', async () => {
      const db = dbManager!.getDatabase();
      const users = await db.query('SELECT * FROM user WHERE username = "admin"');
      console.log('  查询到的用户:', users);
      if (!users || !Array.isArray(users) || users.length === 0 || !users[0] || !Array.isArray(users[0]) || users[0].length === 0) {
        throw new Error('admin用户不存在');
      }
    });

    // 测试3: Schema 验证
    await runTest('数据库Schema验证', async () => {
      const stats = await dbManager!.getDatabaseStats();
      console.log('  数据库统计:', stats);
      
      if (!stats.role || stats.role < 1) {
        throw new Error('角色数据缺失');
      }
      if (!stats.operation_metadata || stats.operation_metadata < 1) {
        throw new Error('操作元数据缺失');
      }
    });

    // 测试4: 案件创建
    await runTest('案件创建测试', async () => {
      const db = dbManager!.getDatabase();
      
      // 设置认证状态
      await dbManager!.setAuthUser('user:admin');
      
      const testCase = await db.create('case', {
        name: '简化测试案件',
        case_manager_name: '测试管理员',
        case_number: 'SIMPLE-TEST-001',
        case_procedure: '破产清算',
        acceptance_date: new Date('2024-01-15'),
        procedure_phase: '立案'
      });
      
      console.log('  创建的案件:', testCase);
      
      if (!testCase || !testCase.name) {
        throw new Error('案件创建失败');
      }
    });

    // 测试5: 认证状态管理
    await runTest('认证状态管理', async () => {
      await dbManager!.setAuthUser('user:admin');
      const isValid = await dbManager!.validateDatabaseState();
      if (!isValid) {
        throw new Error('认证状态设置失败');
      }
    });

    // 生成诊断报告
    console.log('\n📊 生成诊断报告...');
    await TestDiagnostics.generateDiagnosticReport();

  } catch (error: any) {
    console.error('❌ 测试初始化失败:', error);
    testsFailed++;
  } finally {
    // 清理资源
    try {
      if (dbManager) {
        await dbManager.close();
      }
      await TestDatabaseManager.destroyInstance();
    } catch (error: any) {
      console.warn('⚠️ 清理资源时出现警告:', error.message);
    }
  }

  // 输出测试结果
  console.log('\n' + '='.repeat(50));
  console.log('📋 测试结果汇总');
  console.log('='.repeat(50));
  console.log(`✅ 通过: ${testsPassed}`);
  console.log(`❌ 失败: ${testsFailed}`);
  console.log(`📊 总计: ${testsPassed + testsFailed}`);
  
  if (results.length > 0) {
    console.log('\n详细结果:');
    results.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : '❌';
      console.log(`  ${status} ${result.name}`);
      if (result.error) {
        console.log(`     错误: ${result.error}`);
      }
    });
  }

  console.log('='.repeat(50));
  
  // 退出码
  process.exit(testsFailed > 0 ? 1 : 0);
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runSimpleTests().catch(error => {
    console.error('💥 测试运行器崩溃:', error);
    process.exit(1);
  });
}

export { runSimpleTests };