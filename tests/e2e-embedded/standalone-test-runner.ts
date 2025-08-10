#!/usr/bin/env node

/**
 * 独立的测试运行器
 * 不依赖 Vitest 配置，直接测试核心数据库功能
 */

import { RecordId, Surreal } from 'surrealdb';
import { surrealdbNodeEngines } from '@surrealdb/node';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  error?: string;
  duration?: number;
}

class StandaloneTestRunner {
  private db: Surreal | null = null;
  private results: TestResult[] = [];

  async initialize(): Promise<void> {
    console.log('🚀 初始化测试数据库...');
    
    // 创建数据库实例
    this.db = new Surreal({
      engines: surrealdbNodeEngines(),
    });

    // 连接到内存数据库
    await this.db.connect('mem://');
    console.log('已连接到SurrealDB内存数据库');

    // 使用测试命名空间和数据库
    await this.db.use({
      namespace: 'test_ns',
      database: 'standalone_test_db'
    });
    console.log('已切换到测试数据库');

    // 加载 Schema
    await this.loadSchema();

    // 创建测试数据
    await this.createTestData();
  }

  async loadSchema(): Promise<void> {
    console.log('正在加载数据库Schema...');
    
    try {
      // 读取 Schema 文件
      const schemaPath = path.resolve(__dirname, "../../src/lib/surreal_schemas.surql");
      const schemaContent = await fs.readFile(schemaPath, "utf-8");

      // 分割并执行 Schema 语句
      const statements = this.splitSqlStatements(schemaContent);
      
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await this.db!.query(statement);
          } catch (error: any) {
            // 忽略 "already exists" 错误
            if (!error.message?.includes('already exists') &&
                !error.message?.includes('already contains')) {
              console.warn(`Schema语句执行警告: ${statement.substring(0, 50)}...`, error.message);
            }
          }
        }
      }
      
      console.log(`Schema加载完成，处理了${statements.length}个语句`);
    } catch (error) {
      throw new Error(`加载Schema失败: ${error}`);
    }
  }

  private splitSqlStatements(content: string): string[] {
    const lines = content.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('--'));

    const statements: string[] = [];
    let currentStatement = '';

    for (const line of lines) {
      currentStatement += line + '\n';

      if (line.endsWith(';')) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }

    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    return statements;
  }

  async createTestData(): Promise<void> {
    console.log('正在验证测试数据...');
    
    // 检查admin用户是否存在
    const existingAdmin = await this.db!.query('SELECT * FROM user:admin');
    
    if (!existingAdmin || !Array.isArray(existingAdmin) || existingAdmin.length === 0 || !existingAdmin[0]) {
      console.log('创建admin用户...');
      // 创建admin用户
      await this.db!.query(`
        CREATE user:admin SET
          github_id = '--admin--',
          username = 'admin',
          name = '系统管理员',
          email = 'admin@test.com',
          password_hash = crypto::argon2::generate('admin123'),
          created_at = time::now(),
          updated_at = time::now();
      `);

      // 分配admin角色
      await this.db!.query(`
        RELATE user:admin->has_role->role:admin SET
          created_at = time::now(),
          updated_at = time::now();
      `);
      console.log('admin用户创建完成');
    } else {
      console.log('admin用户已存在');
    }

    console.log('测试数据验证完成');
  }

  async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🧪 运行测试: ${name}`);
      await testFn();
      const duration = Date.now() - startTime;
      console.log(`✅ 测试通过: ${name} (${duration}ms)`);
      this.results.push({ name, status: 'PASS', duration });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ 测试失败: ${name} (${duration}ms)`, error.message);
      this.results.push({ name, status: 'FAIL', error: error.message, duration });
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 开始运行所有测试...\n');

    // 测试1: 基础连接
    await this.runTest('数据库基础连接', async () => {
      const result = await this.db!.query('SELECT count() FROM user GROUP ALL');
      if (!result || !Array.isArray(result)) {
        throw new Error('数据库查询返回格式错误');
      }
      console.log('  数据库查询测试通过');
    });

    // 测试2: 用户数据
    await this.runTest('admin用户验证', async () => {
      const users = await this.db!.query('SELECT * FROM user WHERE username = "admin"');
      console.log('  admin用户查询结果:', users);
      
      if (!Array.isArray(users) || users.length === 0) {
        throw new Error('用户查询结果为空');
      }
      
      const userResult = Array.isArray(users[0]) ? users[0] : [users[0]];
      if (userResult.length === 0) {
        throw new Error('admin用户不存在');
      }
      
      const admin = userResult[0];
      if (admin.username !== 'admin') {
        throw new Error(`用户名不匹配: 期望 'admin', 实际 '${admin.username}'`);
      }
    });

    // 测试3: Schema 验证
    await this.runTest('Schema完整性验证', async () => {
      // 检查关键表
      const tables = ['user', 'role', 'operation_metadata', 'menu_metadata'];
      
      for (const table of tables) {
        const result = await this.db!.query(`SELECT count() AS count FROM ${table} GROUP ALL;`);
        const count = result?.[0]?.[0]?.count || 0;
        console.log(`  表 ${table}: ${count} 条记录`);
        
        if (count === 0 && table !== 'case') { // 案件表可以为空
          throw new Error(`表 ${table} 没有数据`);
        }
      }
    });

    // 测试4: 权限系统
    await this.runTest('权限系统验证', async () => {
      // 检查admin用户的角色
      const roleQuery = `
        SELECT 
          username,
          name,
          ->has_role->role.* AS roles
        FROM user 
        WHERE username = "admin"
      `;
      
      const result = await this.db!.query(roleQuery);
      const userData = result?.[0]?.[0];
      
      if (!userData) {
        throw new Error('无法查询admin用户角色');
      }
      
      console.log('  admin用户角色:', userData.roles);
      
      if (!userData.roles || !Array.isArray(userData.roles) || userData.roles.length === 0) {
        throw new Error('admin用户没有分配角色');
      }
      
      const hasAdminRole = userData.roles.some((role: any) => role.name === 'admin');
      if (!hasAdminRole) {
        throw new Error('admin用户没有admin角色');
      }
    });

    // 测试5: 案件创建
    await this.runTest('案件创建功能', async () => {
      // 直接使用SQL创建案件，避免认证问题
      const createResult = await this.db!.query(`
        CREATE case SET
          name = '独立测试案件',
          case_manager_name = '测试管理员',
          case_number = 'STANDALONE-2024-001',
          case_procedure = '破产清算',
          acceptance_date = d'2024-01-15',
          procedure_phase = '立案',
          created_by_user = user:admin,
          created_at = time::now(),
          updated_at = time::now()
      `);
      
      console.log('  创建的案件结果:', createResult);
      
      if (!createResult || !Array.isArray(createResult) || createResult.length === 0) {
        throw new Error('案件创建失败');
      }
      
      // 验证案件确实存在
      const foundCases = await this.db!.query('SELECT * FROM case WHERE case_number = "STANDALONE-2024-001"');
      const cases = Array.isArray(foundCases[0]) ? foundCases[0] : [foundCases[0]];
      
      if (cases.length === 0) {
        throw new Error('创建的案件在数据库中找不到');
      }
      
      console.log('  案件创建和验证成功');
    });
  }

  async cleanup(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
        console.log('数据库连接已关闭');
      } catch (error) {
        console.warn('关闭数据库连接失败:', error);
      }
    }
  }

  printSummary(): void {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const totalDuration = this.results.reduce((sum, r) => sum + (r.duration || 0), 0);

    console.log('\n' + '='.repeat(60));
    console.log('📋 测试结果汇总');
    console.log('='.repeat(60));
    console.log(`✅ 通过: ${passed}`);
    console.log(`❌ 失败: ${failed}`);
    console.log(`📊 总计: ${passed + failed}`);
    console.log(`⏱️  总耗时: ${totalDuration}ms`);
    
    if (this.results.length > 0) {
      console.log('\n详细结果:');
      this.results.forEach(result => {
        const status = result.status === 'PASS' ? '✅' : '❌';
        const duration = result.duration ? ` (${result.duration}ms)` : '';
        console.log(`  ${status} ${result.name}${duration}`);
        if (result.error) {
          console.log(`     错误: ${result.error}`);
        }
      });
    }
    
    console.log('='.repeat(60));
  }
}

async function main() {
  const runner = new StandaloneTestRunner();
  
  try {
    await runner.initialize();
    await runner.runAllTests();
  } catch (error) {
    console.error('💥 测试运行失败:', error);
  } finally {
    await runner.cleanup();
    runner.printSummary();
    
    const failed = runner.results.filter(r => r.status === 'FAIL').length;
    process.exit(failed > 0 ? 1 : 0);
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 程序异常退出:', error);
    process.exit(1);
  });
}