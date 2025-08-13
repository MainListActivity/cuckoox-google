/**
 * 简单查询测试 - 调试页面组件问题
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getTestDatabase, getTestDatabaseManager } from "../../setup-embedded-db";
import { queryWithAuth } from "@/src/utils/surrealAuth";

describe("简单查询调试测试", () => {
  beforeEach(async () => {
    const testDbManager = getTestDatabaseManager();
    await testDbManager.resetDatabase();
    await testDbManager.setAuthUser('user:admin');
  });

  it("应该能够执行queryWithAuth查询", async () => {
    const testDb = getTestDatabase();
    
    // 测试基本的认证查询
    try {
      const result = await queryWithAuth(testDb, "SELECT * FROM case LIMIT 5;");
      console.log("queryWithAuth结果:", result);
      
      expect(Array.isArray(result)).toBe(true);
    } catch (error) {
      console.error("queryWithAuth失败:", error);
      throw error;
    }
  });

  it("应该能够查询案件统计数据", async () => {
    const testDb = getTestDatabase();
    
    try {
      // 模拟页面可能执行的查询
      const statsQuery = `
        LET $total_cases = (SELECT count() AS count FROM case GROUP ALL);
        LET $active_cases = (SELECT count() AS count FROM case WHERE case_status = 'active' GROUP ALL);
        LET $completed_cases = (SELECT count() AS count FROM case WHERE case_status = 'completed' GROUP ALL);
        RETURN {
          total: $total_cases[0].count || 0,
          active: $active_cases[0].count || 0,
          completed: $completed_cases[0].count || 0
        };
      `;
      
      const result = await queryWithAuth(testDb, statsQuery);
      console.log("统计查询结果:", result);
      
      expect(result).toBeDefined();
    } catch (error) {
      console.error("统计查询失败:", error);
      throw error;
    }
  });

  it("应该能够查询案件详细信息", async () => {
    const testDb = getTestDatabase();
    
    try {
      // 测试页面可能用到的复杂查询
      const casesQuery = `
        SELECT *,
          (SELECT name FROM user WHERE id = $parent.created_by_user)[0].name AS created_by_name,
          count((SELECT * FROM claim WHERE case_id = $parent.id)) AS claims_count
        FROM case
        ORDER BY created_at DESC
        LIMIT 10;
      `;
      
      const result = await queryWithAuth(testDb, casesQuery);
      console.log("案件详细信息查询结果:", result);
      
      expect(Array.isArray(result)).toBe(true);
      
      // 检查结果是否包含期望的字段
      if (result.length > 0) {
        const firstCase = result[0] as any;
        console.log("第一个案件数据:", firstCase);
        
        expect(firstCase).toHaveProperty('id');
        expect(firstCase).toHaveProperty('name');
      }
    } catch (error) {
      console.error("案件详细查询失败:", error);
      throw error;
    }
  });
});