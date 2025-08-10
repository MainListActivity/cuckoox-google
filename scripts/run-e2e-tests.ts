#!/usr/bin/env tsx

/**
 * 逐个运行E2E测试以避免内存问题
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const testFiles = [
  'tests/e2e-embedded/basic-database.test.tsx',
  'tests/e2e-embedded/auth.test.tsx', 
  'tests/e2e-embedded/cases.test.tsx',
  'tests/e2e-embedded/admin.test.tsx',
  'tests/e2e-embedded/full-workflow.test.tsx'
];

interface TestResult {
  file: string;
  success: boolean;
  output?: string;
  error?: string;
  duration?: number;
}

async function runSingleTest(testFile: string): Promise<TestResult> {
  console.log(`\n🧪 运行测试: ${testFile}`);
  const startTime = Date.now();
  
  try {
    // 创建临时配置文件，只包含当前测试文件
    const tempConfigPath = path.join(process.cwd(), 'vitest.temp.config.ts');
    const originalConfigPath = path.join(process.cwd(), 'vitest.e2e-embedded.config.ts');
    
    // 读取原始配置
    const originalConfig = fs.readFileSync(originalConfigPath, 'utf-8');
    
    // 修改配置只包含当前测试文件
    const modifiedConfig = originalConfig.replace(
      /include:\s*\[[\s\S]*?\]/,
      `include: ["${testFile}"]`
    );
    
    // 写入临时配置
    fs.writeFileSync(tempConfigPath, modifiedConfig);
    
    // 运行测试
    const output = execSync(`bun vitest run --run --config ${tempConfigPath} --reporter=verbose`, {
      encoding: 'utf-8',
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' },
      timeout: 120000
    });
    
    // 清理临时配置
    fs.unlinkSync(tempConfigPath);
    
    const duration = Date.now() - startTime;
    console.log(`✅ 测试通过: ${testFile} (${duration}ms)`);
    
    return {
      file: testFile,
      success: true,
      output,
      duration
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ 测试失败: ${testFile} (${duration}ms)`);
    console.error('错误信息:', error.message);
    
    return {
      file: testFile,
      success: false,
      error: error.message,
      duration
    };
  }
}

async function runAllTests() {
  console.log('🚀 开始运行E2E测试套件...');
  console.log(`总共 ${testFiles.length} 个测试文件`);
  
  const results: TestResult[] = [];
  
  for (const testFile of testFiles) {
    const result = await runSingleTest(testFile);
    results.push(result);
    
    // 在测试之间添加延迟以释放内存
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // 输出总结报告
  console.log('\n' + '='.repeat(60));
  console.log('📋 E2E测试结果汇总');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);
  
  console.log(`✅ 通过: ${passed}/${results.length}`);
  console.log(`❌ 失败: ${failed}/${results.length}`);
  console.log(`⏱️  总耗时: ${totalDuration}ms`);
  
  console.log('\n详细结果:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`  ${status} ${result.file}${duration}`);
    if (result.error) {
      console.log(`     错误: ${result.error.substring(0, 200)}...`);
    }
  });
  
  console.log('='.repeat(60));
  
  // 返回退出码
  process.exit(failed > 0 ? 1 : 0);
}

// Check if this script is being run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runAllTests().catch(error => {
    console.error('💥 测试运行器崩溃:', error);
    process.exit(1);
  });
}