/**
 * 测试数据库管理器
 * 使用真正的SurrealDB内嵌数据库引擎进行测试
 */

import { Surreal } from 'surrealdb';
import { surrealdbNodeEngines } from '@surrealdb/node';
import { TestDataGenerator } from './testData';
import * as path from 'path';
import * as fs from 'fs/promises';

export class TestDatabaseManager {
  private db: Surreal | null = null;
  private static instance: TestDatabaseManager | null = null;
  private isInitialized = false;
  private readonly namespace = 'test_ns';
  private readonly database = `test_db_${Date.now()}`; // 每次运行使用不同的数据库名

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): TestDatabaseManager {
    if (!TestDatabaseManager.instance) {
      TestDatabaseManager.instance = new TestDatabaseManager();
    }
    return TestDatabaseManager.instance;
  }

  /**
   * 创建和初始化测试数据库
   */
  public async initialize(): Promise<Surreal> {
    if (this.db && this.isInitialized) {
      return this.db;
    }

    try {
      console.log('正在初始化真实内嵌SurrealDB数据库...');
      
      // 创建真正的SurrealDB实例，启用Node引擎
      this.db = new Surreal({
        engines: surrealdbNodeEngines(),
      });
      
      // 连接到内存数据库
      await this.db.connect('mem://');
      console.log('已连接到SurrealDB内存数据库');
      
      // 使用测试命名空间和数据库
      await this.db.use({
        namespace: this.namespace,
        database: this.database
      });
      console.log(`已切换到数据库: ${this.namespace}/${this.database}`);

      // 加载并执行数据库Schema
      await this.loadSchema();
      
      // 插入测试数据
      await this.insertTestData();
      
      this.isInitialized = true;
      console.log('真实内嵌SurrealDB数据库初始化完成');
      
      return this.db;
    } catch (error) {
      console.error('测试数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 加载并执行数据库Schema
   */
  private async loadSchema(): Promise<void> {
    if (!this.db) throw new Error('数据库未初始化');
    
    try {
      console.log('正在加载数据库Schema...');
      
      // 读取Schema文件
      const schemaPath = path.join(__dirname, 'testSchema.surql');
      const schemaContent = await fs.readFile(schemaPath, 'utf-8');
      
      // 执行Schema语句
      const statements = this.splitSqlStatements(schemaContent);
      
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await this.db.query(statement);
          } catch (error) {
            console.warn(`执行Schema语句时出现警告: ${statement.substring(0, 50)}...`, error);
            // 继续执行其他语句，某些DEFINE语句可能会产生警告但仍然成功
          }
        }
      }
      
      console.log(`Schema加载完成，执行了${statements.length}个语句`);
    } catch (error) {
      console.error('加载Schema失败:', error);
      throw error;
    }
  }

  /**
   * 插入测试数据
   */
  private async insertTestData(): Promise<void> {
    if (!this.db) throw new Error('数据库未初始化');

    try {
      console.log('正在插入测试数据...');
      
      const dataGenerator = TestDataGenerator.getInstance();
      
      // 使用SQL语句插入数据，以确保与真实SurrealDB的完全兼容
      const statements = dataGenerator.generateInsertStatements();
      
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await this.db.query(statement);
          } catch (error) {
            console.warn(`插入数据语句执行警告: ${statement.substring(0, 100)}...`, error);
            // 继续执行其他语句
          }
        }
      }
      
      console.log(`测试数据插入完成，执行了${statements.length}个语句`);
    } catch (error) {
      console.error('插入测试数据失败:', error);
      throw error;
    }
  }


  /**
   * 分割SQL语句
   */
  private splitSqlStatements(content: string): string[] {
    // 移除注释和空行
    const lines = content.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('--'));
    
    const statements: string[] = [];
    let currentStatement = '';
    
    for (const line of lines) {
      currentStatement += line + '\n';
      
      // 如果行以分号结束，认为是一个完整的语句
      if (line.endsWith(';')) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }
    
    // 添加最后一个未以分号结尾的语句（如果有）
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    return statements;
  }

  /**
   * 获取数据库实例
   */
  public getDatabase(): Surreal {
    if (!this.db) {
      throw new Error('测试数据库未初始化，请先调用 initialize()');
    }
    return this.db;
  }

  /**
   * 设置认证用户（用于权限测试）
   */
  public async setAuthUser(userId: string): Promise<void> {
    if (!this.db) throw new Error('数据库未初始化');

    try {
      // auth是保护变量，使用current_user代替
      try {
        await this.db.query(`REMOVE PARAM $current_user;`);
      } catch (removeError: any) {
        // 参数不存在是正常的
        if (!removeError?.message?.includes('does not exist')) {
          console.warn('清除现有认证状态时出现警告:', removeError);
        }
      }
      
      // 设置新的认证状态 - 使用current_user变量
      await this.db.query(`DEFINE PARAM $current_user VALUE ${userId};`);
      console.log(`已设置认证用户: ${userId}`);
    } catch (error) {
      console.error('设置认证用户失败:', error);
      throw error;
    }
  }

  /**
   * 清除认证状态
   */
  public async clearAuth(): Promise<void> {
    if (!this.db) return;

    try {
      // 先检查参数是否存在，再尝试删除
      try {
        await this.db.query(`REMOVE PARAM $current_user;`);
        console.log('已清除认证状态');
      } catch (removeError: any) {
        // 如果参数不存在，这是正常的
        if (removeError?.message?.includes('does not exist')) {
          console.log('认证状态已是清除状态');
        } else {
          throw removeError;
        }
      }
    } catch (error) {
      console.warn('清除认证状态失败:', error);
    }
  }

  /**
   * 重置数据库状态（清空所有数据但保留Schema）
   */
  public async resetDatabase(): Promise<void> {
    if (!this.db) return;

    try {
      console.log('正在重置数据库状态...');
      
      // 删除所有数据表的数据（保留Schema）
      const tables = ['user', 'role', 'operation_metadata', 'menu_metadata', 'case', 'creditor', 'claim', 
                     'has_role', 'can_execute_operation', 'can_access_menu', 'has_case_role', 'has_member'];
      
      for (const table of tables) {
        try {
          await this.db.query(`DELETE ${table};`);
        } catch (error) {
          // 表可能不存在，继续删除其他表
          console.warn(`删除表 ${table} 数据时出现警告:`, error);
        }
      }
      
      // 重新插入测试数据
      await this.insertTestData();
      
      console.log('数据库状态重置完成');
    } catch (error) {
      console.error('重置数据库状态失败:', error);
      throw error;
    }
  }

  /**
   * 执行自定义查询（用于测试验证）
   */
  public async query(sql: string, vars?: Record<string, any>): Promise<any> {
    if (!this.db) throw new Error('数据库未初始化');
    
    try {
      return await this.db.query(sql, vars);
    } catch (error) {
      console.error('查询执行失败:', sql, error);
      throw error;
    }
  }

  /**
   * 验证数据库状态（检查基础数据是否正确）
   */
  public async validateDatabaseState(): Promise<boolean> {
    if (!this.db) return false;

    try {
      // 检查关键表是否有数据
      const userResult = await this.db.query('SELECT count() AS count FROM user GROUP ALL;');
      const caseResult = await this.db.query('SELECT count() AS count FROM case GROUP ALL;');
      const roleResult = await this.db.query('SELECT count() AS count FROM role GROUP ALL;');
      
      const userCount = userResult?.[0]?.[0]?.count || 0;
      const caseCount = caseResult?.[0]?.[0]?.count || 0;
      const roleCount = roleResult?.[0]?.[0]?.count || 0;
      
      console.log(`数据库状态验证: 用户=${userCount}, 案件=${caseCount}, 角色=${roleCount}`);
      
      return userCount > 0 && caseCount > 0 && roleCount > 0;
    } catch (error) {
      console.error('数据库状态验证失败:', error);
      return false;
    }
  }

  /**
   * 获取数据库统计信息（用于调试）
   */
  public async getDatabaseStats(): Promise<Record<string, number>> {
    if (!this.db) return {};

    try {
      const tables = ['user', 'role', 'operation_metadata', 'menu_metadata', 'case', 'creditor', 'claim',
                     'has_role', 'can_execute_operation', 'can_access_menu', 'has_case_role'];
      const stats: Record<string, number> = {};
      
      for (const table of tables) {
        try {
          const result = await this.db.query(`SELECT count() AS count FROM ${table} GROUP ALL;`);
          stats[table] = result?.[0]?.[0]?.count || 0;
        } catch (error) {
          stats[table] = 0;
        }
      }
      
      return stats;
    } catch (error) {
      console.error('获取数据库统计信息失败:', error);
      return {};
    }
  }

  /**
   * 关闭数据库连接
   */
  public async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
        console.log('真实内嵌SurrealDB连接已关闭');
      } catch (error) {
        console.warn('关闭数据库连接失败:', error);
      } finally {
        this.db = null;
        this.isInitialized = false;
      }
    }
  }

  /**
   * 销毁单例实例（主要用于测试清理）
   */
  public static async destroyInstance(): Promise<void> {
    if (TestDatabaseManager.instance) {
      await TestDatabaseManager.instance.close();
      TestDatabaseManager.instance = null;
    }
  }
}

// 导出便捷函数
export const getTestDatabase = async (): Promise<Surreal> => {
  const manager = TestDatabaseManager.getInstance();
  return await manager.initialize();
};

export const resetTestDatabase = async (): Promise<void> => {
  const manager = TestDatabaseManager.getInstance();
  await manager.resetDatabase();
};

export const closeTestDatabase = async (): Promise<void> => {
  await TestDatabaseManager.destroyInstance();
};