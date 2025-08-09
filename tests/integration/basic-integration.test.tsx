/**
 * 基础集成测试 - 验证测试框架和数据库连接
 */

import { describe, it, expect, beforeAll } from "vitest";
import { TestHelpers } from "../utils/realSurrealTestUtils";

describe("基础集成测试", () => {
  beforeAll(async () => {
    console.log("🧪 开始基础集成测试...");
  });

  describe("数据库连接测试", () => {
    it("应该能够连接数据库", async () => {
      const stats = await TestHelpers.getDatabaseStats();
      expect(stats).toBeDefined();
      expect(typeof stats.user).toBe("number");
      console.log("📊 数据库统计信息:", stats);
    });

    it("应该能够验证数据库状态", async () => {
      const isValid = await TestHelpers.validateDatabaseState();
      expect(isValid).toBe(true);
      console.log("✅ 数据库状态验证通过");
    });

    it("应该能够执行简单查询", async () => {
      const result = await TestHelpers.query("SELECT count() AS count FROM user GROUP ALL;");
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      console.log("📝 用户查询结果:", result);
    });
  });

  describe("认证功能测试", () => {
    it("应该能够设置认证用户", async () => {
      await expect(TestHelpers.setAuthUser("user:admin")).resolves.not.toThrow();
      console.log("🔐 设置认证用户成功");
    });

    it("应该能够清除认证状态", async () => {
      await expect(TestHelpers.clearAuth()).resolves.not.toThrow();
      console.log("🧹 清除认证状态成功");
    });
  });

  describe("数据操作测试", () => {
    it("应该能够查询角色数据", async () => {
      const roles = await TestHelpers.select("role");
      expect(Array.isArray(roles)).toBe(true);
      expect(roles.length).toBeGreaterThan(0);
      console.log("👥 角色数据:", roles.map(r => r.name));
    });

    it("应该能够查询用户数据", async () => {
      const users = await TestHelpers.select("user");
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
      console.log("👤 用户数据:", users.map(u => u.name));
    });
  });
});
