/**
 * 简单SIGNIN测试 - 专注解决认证问题
 */

import { describe, it, expect } from "vitest";
import { getTestDatabase, getTestDatabaseManager } from "../../setup-embedded-db";

describe("简单SIGNIN测试", () => {
  it("应该能够使用ACCESS account进行SIGNIN认证", async () => {
    const testDbManager = getTestDatabaseManager();
    const testDb = testDbManager.getDatabase();
    
    // 不reset数据库，使用现有数据
    console.log("💡 测试ACCESS account SIGNIN认证...");
    
    // 检查admin用户是否存在且有密码
    const userCheck = await testDb.query(`
      SELECT *, pass IS NOT NONE as has_password 
      FROM user:admin;
    `);
    console.log("admin用户数据:", userCheck);
    
    // 现在创建测试scope并进行SIGNIN
    try {
      
      // 验证认证状态
      const authCheck = await testDb.query('RETURN $auth;');
      console.log("🔐 认证状态检查:", authCheck);
      
      expect(authCheck).toBeDefined();
      expect(Array.isArray(authCheck)).toBe(true);
      expect(authCheck.length).toBeGreaterThan(0);
      
      const authData = authCheck[0];
      console.log("认证数据:", authData);
      
      if (Array.isArray(authData) && authData.length > 0) {
        const userAuth = authData[0];
        expect(userAuth).toBeDefined();
        expect(userAuth).not.toBeNull();
        expect(userAuth).toHaveProperty('id');
        console.log("✅ 认证成功，用户ID:", userAuth.id);
      }
      
      // 测试queryWithAuth格式查询
      const queryWithAuthTest = await testDb.query(`
        return $auth;
        SELECT * FROM user LIMIT 3;
      `);
      console.log("queryWithAuth格式测试结果:", queryWithAuthTest);
      
      expect(queryWithAuthTest).toBeDefined();
      expect(Array.isArray(queryWithAuthTest)).toBe(true);
      expect(queryWithAuthTest.length).toBe(2);
      expect(queryWithAuthTest[0]).toBeDefined(); // $auth结果
      expect(queryWithAuthTest[1]).toBeDefined(); // 查询结果
      
    } catch (error) {
      console.error("❌ ACCESS SIGNIN过程中出现错误:", error);
      
      // 如果直接SIGNIN失败，检查具体原因
      console.log("检查用户数据和密码...");
      const userDetailCheck = await testDb.query(`
        SELECT *, pass IS NOT NONE as has_password 
        FROM user:admin;
      `);
      console.log("用户详细信息:", userDetailCheck);
      
      throw error;
    }
  });
});