/**
 * 调试认证语法的专用测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestHelpers, TEST_IDS } from './utils/realSurrealTestUtils';

describe('认证语法调试', () => {
  beforeEach(async () => {
    await TestHelpers.resetDatabase();
  });

  it('应该测试修复后的RETURN $auth语法', async () => {
    // 设置认证用户
    await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

    // 测试RETURN $auth查询
    const authResult = await TestHelpers.query('RETURN $auth;');
    console.log('修复后的RETURN $auth 结果:', JSON.stringify(authResult, null, 2));

    expect(authResult).toBeDefined();
    expect(Array.isArray(authResult)).toBe(true);
    // 应该不再是null
    expect(authResult[0]).not.toBeNull();
  });

  it('应该测试正确的关系查询语法', async () => {
    await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

    // 根据真实SurrealDB的返回格式，调整查询
    const roleResult = await TestHelpers.query(`
      SELECT ->has_role->role.* AS roles FROM $auth;
    `);
    console.log('角色查询结果:', JSON.stringify(roleResult, null, 2));

    expect(roleResult).toBeDefined();
    expect(Array.isArray(roleResult)).toBe(true);
  });

  it('应该测试直接从用户查询角色', async () => {
    // 直接查询指定用户的角色，不依赖$auth
    const roleResult = await TestHelpers.query(`
      SELECT ->has_role->role.* AS roles FROM user:admin;
    `);
    console.log('直接用户角色查询结果:', JSON.stringify(roleResult, null, 2));

    expect(roleResult).toBeDefined();
    expect(roleResult[0]).toBeDefined();
    if (roleResult[0].length > 0) {
      expect(roleResult[0][0].roles).toBeDefined();
    }
  });

  it('应该测试操作权限查询语法', async () => {
    // 查询admin用户的操作权限
    const permResult = await TestHelpers.query(`
      SELECT ->has_role->role->can_execute_operation->operation_metadata.* AS permissions 
      FROM user:admin;
    `);
    console.log('操作权限查询结果:', JSON.stringify(permResult, null, 2));

    expect(permResult).toBeDefined();
  });
});