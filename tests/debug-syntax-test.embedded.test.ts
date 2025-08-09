/**
 * 调试语法差异的简单测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestHelpers, TEST_IDS } from './utils/realSurrealTestUtils';

describe('SurrealDB语法调试', () => {
  beforeEach(async () => {
    await TestHelpers.resetDatabase();
  });

  it('应该测试基本的RETURN $auth语法', async () => {
    // 设置认证用户
    await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

    // 测试RETURN $auth查询
    const authResult = await TestHelpers.query('RETURN $auth;');
    console.log('RETURN $auth 结果:', JSON.stringify(authResult, null, 2));

    expect(authResult).toBeDefined();
    expect(Array.isArray(authResult)).toBe(true);
  });

  it('应该测试用户表查询', async () => {
    // 简单查询用户表
    const userResult = await TestHelpers.query('SELECT * FROM user;');
    console.log('SELECT * FROM user 结果:', JSON.stringify(userResult, null, 2));

    expect(userResult).toBeDefined();
    expect(Array.isArray(userResult)).toBe(true);
    expect(userResult[0]).toBeDefined();
  });

  it('应该测试关系查询语法', async () => {
    await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

    // 测试关系查询
    const roleResult = await TestHelpers.query(`
      SELECT ->has_role->role FROM user:admin;
    `);
    console.log('关系查询结果:', JSON.stringify(roleResult, null, 2));

    expect(roleResult).toBeDefined();
  });

  it('应该测试$auth.id语法', async () => {
    await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

    // 测试$auth.id语法
    try {
      const authIdResult = await TestHelpers.query('SELECT ->has_role->role.* AS roles FROM $auth.id;');
      console.log('$auth.id 查询结果:', JSON.stringify(authIdResult, null, 2));
    } catch (error) {
      console.log('$auth.id 查询失败:', error);
      
      // 尝试直接使用$auth
      const authDirectResult = await TestHelpers.query('SELECT ->has_role->role.* AS roles FROM $auth;');
      console.log('$auth 直接查询结果:', JSON.stringify(authDirectResult, null, 2));
    }
  });

  it('应该测试数据类型和数据验证', async () => {
    // 检查插入的测试数据
    const stats = await TestHelpers.getDatabaseStats();
    console.log('数据库统计:', stats);
    
    // 检查has_role关系表
    const hasRoleResult = await TestHelpers.query('SELECT * FROM has_role;');
    console.log('has_role 表数据:', JSON.stringify(hasRoleResult, null, 2));
  });
});