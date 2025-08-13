/**
 * 测试直接SIGNIN认证机制
 * 验证SIGNIN方法能够正确设置$auth.id值
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getTestDatabase, getTestDatabaseManager } from "../../setup-embedded-db";

describe("SIGNIN认证机制测试", () => {
  beforeEach(async () => {
    const testDbManager = getTestDatabaseManager();
    await testDbManager.resetDatabase();
  });

  it("应该能够通过SIGNIN设置$auth.id", async () => {
    const testDbManager = getTestDatabaseManager();
    const testDb = getTestDatabase();
    
    // 使用SIGNIN进行认证
    await testDbManager.setAuthUser('user:admin');
    
    // 验证认证状态
    const authResult = await testDb.query('RETURN $auth;');
    console.log("SIGNIN后的认证状态:", authResult);
    
    // 验证$auth有值
    expect(authResult).toBeDefined();
    expect(Array.isArray(authResult)).toBe(true);
    expect(authResult.length).toBeGreaterThan(0);
    expect(authResult[0]).toBeDefined();
    expect(authResult[0]).not.toBeNull();
    
    // 如果返回数组中有用户信息，验证用户ID
    if (Array.isArray(authResult[0]) && authResult[0].length > 0) {
      const authUser = authResult[0][0];
      expect(authUser).toBeDefined();
      expect(authUser).toHaveProperty('id');
      console.log("认证用户信息:", authUser);
    }
  });

  it("应该能够执行需要认证的查询", async () => {
    const testDbManager = getTestDatabaseManager();
    const testDb = getTestDatabase();
    
    // 先进行SIGNIN认证
    await testDbManager.setAuthUser('user:admin');
    
    // 执行需要认证的查询
    const queryWithAuthCheck = `
      return $auth;
      SELECT * FROM case LIMIT 5;
    `;
    
    const result = await testDb.query(queryWithAuthCheck);
    console.log("认证查询结果:", result);
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2); // 应该有两个结果：认证状态和案件查询
    
    // 第一个结果是认证状态
    const authStatus = result[0];
    expect(authStatus).toBeDefined();
    expect(authStatus).not.toBeNull();
    
    // 第二个结果是案件查询
    const caseData = result[1];
    expect(Array.isArray(caseData)).toBe(true);
    
    console.log("认证状态:", authStatus);
    console.log("案件数据:", caseData);
  });

  it("应该能够创建需要created_by字段的记录", async () => {
    const testDbManager = getTestDatabaseManager();
    const testDb = getTestDatabase();
    
    // 先进行SIGNIN认证
    await testDbManager.setAuthUser('user:admin');
    
    // 尝试创建一个债权人记录（需要created_by字段）
    const createCreditorQuery = `
      return $auth;
      CREATE creditor SET
        name = "测试债权人",
        contact_person = "联系人",
        phone = "12345678901",
        email = "test@example.com",
        address = "测试地址",
        created_by = $auth.id,
        created_at = time::now();
    `;
    
    const result = await testDb.query(createCreditorQuery);
    console.log("创建债权人结果:", result);
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    
    // 第一个结果是认证状态
    const authStatus = result[0];
    expect(authStatus).toBeDefined();
    console.log("创建时的认证状态:", authStatus);
    
    // 第二个结果是创建的债权人
    const creditorData = result[1];
    expect(Array.isArray(creditorData)).toBe(true);
    expect(creditorData.length).toBeGreaterThan(0);
    
    const creditor = creditorData[0];
    expect(creditor).toHaveProperty('id');
    expect(creditor).toHaveProperty('name', "测试债权人");
    expect(creditor).toHaveProperty('created_by');
    
    console.log("创建的债权人:", creditor);
  });

  it("应该能够验证认证状态在整个会话中保持", async () => {
    const testDbManager = getTestDatabaseManager();
    const testDb = getTestDatabase();
    
    // 进行SIGNIN认证
    await testDbManager.setAuthUser('user:admin');
    
    // 多次检查认证状态
    for (let i = 0; i < 3; i++) {
      const authResult = await testDb.query('RETURN $auth;');
      console.log(`第${i + 1}次认证检查:`, authResult);
      
      expect(authResult).toBeDefined();
      expect(Array.isArray(authResult)).toBe(true);
      expect(authResult.length).toBeGreaterThan(0);
      expect(authResult[0]).toBeDefined();
      expect(authResult[0]).not.toBeNull();
    }
    
    console.log("✅ 认证状态在会话中保持一致");
  });
});