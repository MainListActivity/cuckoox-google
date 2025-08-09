/**
 * 调试参数设置的专用测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestHelpers, TEST_IDS } from './utils/realSurrealTestUtils';

describe('SurrealDB参数设置调试', () => {
  beforeEach(async () => {
    await TestHelpers.resetDatabase();
  });

  it('应该测试不同的参数设置方法', async () => {
    // 方法1: 使用DEFINE PARAM (当前方法)
    try {
      await TestHelpers.query(`DEFINE PARAM $auth VALUE user:admin;`);
      const result1 = await TestHelpers.query('RETURN $auth;');
      console.log('方法1 - DEFINE PARAM结果:', JSON.stringify(result1, null, 2));
    } catch (error) {
      console.log('方法1失败:', error);
    }

    // 方法2: 使用LET语句
    try {
      const result2 = await TestHelpers.query('LET $auth = user:admin; RETURN $auth;');
      console.log('方法2 - LET语句结果:', JSON.stringify(result2, null, 2));
    } catch (error) {
      console.log('方法2失败:', error);
    }

    // 方法3: 直接在查询中使用变量
    try {
      const result3 = await TestHelpers.query('SELECT * FROM user:admin;');
      console.log('方法3 - 直接查询结果:', JSON.stringify(result3, null, 2));
    } catch (error) {
      console.log('方法3失败:', error);
    }

    // 方法4: 使用query参数传递
    try {
      const result4 = await TestHelpers.query('RETURN $auth;', { auth: 'user:admin' });
      console.log('方法4 - 查询参数结果:', JSON.stringify(result4, null, 2));
    } catch (error) {
      console.log('方法4失败:', error);
    }
  });

  it('应该测试查询参数方式设置认证', async () => {
    // 使用查询参数的方式
    const roleResult = await TestHelpers.query(`
      SELECT ->has_role->role.* AS roles FROM $auth;
    `, { auth: 'user:admin' });
    
    console.log('使用查询参数的角色查询结果:', JSON.stringify(roleResult, null, 2));
    
    expect(roleResult).toBeDefined();
    expect(Array.isArray(roleResult)).toBe(true);
  });

  it('应该测试组合查询语句', async () => {
    // 在单个查询中设置并使用变量
    const result = await TestHelpers.query(`
      LET $auth = user:admin;
      SELECT ->has_role->role.* AS roles FROM $auth;
    `);
    
    console.log('组合查询结果:', JSON.stringify(result, null, 2));
    
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});