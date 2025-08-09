/**
 * 调试参数设置的专用测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestHelpers } from './utils/realSurrealTestUtils';

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

    // 方法2: 使用LET语句（注意：$auth 是受保护变量，不能被赋值，这里保留失败验证）
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

    // 方法4: 使用query参数传递（注意：$auth 是受保护变量，不能作为查询参数名，这里保留失败验证）
    try {
      const result4 = await TestHelpers.query('RETURN $auth;', { auth: 'user:admin' });
      console.log('方法4 - 查询参数结果:', JSON.stringify(result4, null, 2));
    } catch (error) {
      console.log('方法4失败:', error);
    }
  });

  it('应该测试查询参数方式设置认证', async () => {
    // 不能设置 $auth（受保护变量），通过查询参数传入表名与主键，并在查询中用 type::thing 构造记录ID
    const roleResult = await TestHelpers.query(
      `
      LET $user = type::thing($tb, $id);
      SELECT ->has_role->role.* AS roles FROM $user;
    `,
      { tb: 'user', id: 'admin' }
    );

    console.log('使用查询参数的角色查询结果:', JSON.stringify(roleResult, null, 2));

    // 类型与结构断言
    if (!Array.isArray(roleResult)) throw new Error('roleResult 应为数组');
    expect(roleResult.length).toBeGreaterThanOrEqual(2); // LET + SELECT 两个语句

    const selectResult = roleResult[1];
    if (!Array.isArray(selectResult)) throw new Error('第二个结果集应为数组');
    expect(selectResult.length).toBeGreaterThan(0);

    const firstRow = selectResult[0];
    expect(firstRow && typeof firstRow === 'object').toBe(true);
    const rec = firstRow as Record<string, unknown>;
    expect('roles' in rec).toBe(true);
    expect(Array.isArray(rec.roles as unknown[])).toBe(true);
  });

  it('应该测试组合查询语句', async () => {
    // 不能赋值 $auth（受保护变量），改为在同一查询中定义 $user 并使用 type::thing 构造记录ID
    const result = await TestHelpers.query(`
      LET $user = type::thing('user', 'admin');
      SELECT ->has_role->role.* AS roles FROM $user;
    `);

    console.log('组合查询结果:', JSON.stringify(result, null, 2));

    if (!Array.isArray(result)) throw new Error('结果应为数组');
    expect(result.length).toBeGreaterThanOrEqual(2);

    const selectResult = result[1];
    if (!Array.isArray(selectResult)) throw new Error('第二个结果集应为数组');
    expect(selectResult.length).toBeGreaterThan(0);

    const firstRow = selectResult[0];
    expect(firstRow && typeof firstRow === 'object').toBe(true);
    const rec = firstRow as Record<string, unknown>;
    expect('roles' in rec).toBe(true);
    expect(Array.isArray(rec.roles as unknown[])).toBe(true);
  });
});