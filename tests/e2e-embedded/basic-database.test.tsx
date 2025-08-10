/**
 * 基础数据库测试 - 验证内嵌数据库功能
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { TestHelpers } from '../utils/realSurrealTestUtils';
import { getTestDatabase, getTestDatabaseManager } from '../setup-embedded-db';
import { RecordId } from 'surrealdb';

describe('基础数据库功能测试', () => {
  beforeEach(async () => {
    // 设置认证状态
    const dbManager = getTestDatabaseManager();
    await dbManager.setAuthUser('user:admin');
  });

  test('应该能够连接到内嵌数据库', async () => {
    const db = getTestDatabase();
    expect(db).toBeDefined();

    // 执行简单查询 - 使用SurrealQL的RETURN语法
    const result = await db.query('RETURN 1;');
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    
    // 验证查询结果的基本结构
    if (Array.isArray(result) && result.length > 0) {
      const firstResult = Array.isArray(result[0]) ? result[0] : [result[0]];
      expect(firstResult).toBeDefined();
      expect(firstResult.length).toBeGreaterThan(0);
    }
  });

  test('应该能够查询现有用户', async () => {
    const users = await TestHelpers.query('SELECT * FROM user');
    expect(users).toBeDefined();
    expect(users[0]).toBeDefined();
    expect(users[0].length).toBeGreaterThan(0);
    
    // 验证管理员用户存在
    const adminUsers = await TestHelpers.query('SELECT * FROM user WHERE username = "admin"');
    expect(adminUsers[0]).toBeDefined();
    expect(adminUsers[0].length).toBeGreaterThan(0);
  });

  test('应该能够创建和查询测试数据', async () => {
    // 创建测试用户
    const testUser = await TestHelpers.create('user', {
      username: 'db_test_user',
      name: '数据库测试用户',
      email: 'dbtest@example.com'
    });

    expect(testUser).toBeDefined();
    expect(testUser.username).toBe('db_test_user');

    // 查询创建的用户
    const foundUsers = await TestHelpers.query('SELECT * FROM user WHERE username = "db_test_user"');
    expect(foundUsers[0]).toBeDefined();
    expect(foundUsers[0].length).toBeGreaterThan(0);
    expect(foundUsers[0][0].username).toBe('db_test_user');
  });

  test('应该能够创建案件数据', async () => {
    // 创建测试案件 - 使用Schema中定义的必需字段
    const testCase = await TestHelpers.create('case', {
      name: '数据库测试案件',
      case_manager_name: '测试管理员',
      case_number: 'DB-TEST-001',
      case_procedure: '破产清算',
      acceptance_date: new Date('2024-01-15'),
      procedure_phase: '立案',
      created_by_user: new RecordId('user', 'admin')
    });

    expect(testCase).toBeDefined();
    expect(testCase.name).toBe('数据库测试案件');
    expect(testCase.case_number).toBe('DB-TEST-001');

    // 验证案件已创建
    const foundCases = await TestHelpers.query('SELECT * FROM case WHERE case_number = "DB-TEST-001"');
    expect(foundCases).toBeDefined();
    expect(Array.isArray(foundCases)).toBe(true);
    expect(foundCases.length).toBeGreaterThan(0);
    expect(foundCases[0]).toBeDefined();
    expect(Array.isArray(foundCases[0])).toBe(true);
    expect(foundCases[0].length).toBeGreaterThan(0);
  });

  test('应该能够管理认证状态', async () => {
    const dbManager = getTestDatabaseManager();
    
    // 设置认证用户
    await dbManager.setAuthUser('user:admin');
    
    // 验证数据库状态
    const isValid = await dbManager.validateDatabaseState();
    expect(isValid).toBe(true);
    
    // 获取统计信息
    const stats = await dbManager.getDatabaseStats();
    expect(stats).toBeDefined();
    expect(stats.user).toBeGreaterThan(0);
    expect(stats.role).toBeGreaterThan(0);
  });

  test('应该能够执行复杂查询', async () => {
    // 查询用户及其角色
    const userRoles = await TestHelpers.query(`
      SELECT 
        username,
        name,
        ->has_role->role.* AS roles
      FROM user 
      WHERE username = "admin"
    `);

    expect(userRoles[0]).toBeDefined();
    expect(userRoles[0].length).toBeGreaterThan(0);
    
    const adminUser = userRoles[0][0];
    expect(adminUser.username).toBe('admin');
    expect(adminUser.roles).toBeDefined();
  });

  test('应该能够清理测试数据', async () => {
    // 创建临时测试数据
    await TestHelpers.create('user', {
      username: 'temp_test_user',
      name: '临时测试用户',
      email: 'temp@test.com'
    });

    // 验证数据存在
    let tempUsers = await TestHelpers.query('SELECT * FROM user WHERE username = "temp_test_user"');
    expect(tempUsers[0].length).toBeGreaterThan(0);

    // 删除测试数据
    await TestHelpers.query('DELETE user WHERE username = "temp_test_user"');

    // 验证数据已删除
    tempUsers = await TestHelpers.query('SELECT * FROM user WHERE username = "temp_test_user"');
    expect(tempUsers[0].length).toBe(0);
  });
});
