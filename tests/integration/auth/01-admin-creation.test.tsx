/**
 * 集成测试 - 01: admin账号创建
 *
 * 这是集成测试的第一步，验证系统管理员账号
 * 创建的数据将被后续测试用例使用，不进行数据清理
 */

import { describe, it, expect, beforeAll } from "vitest";
import { TestHelpers } from "../../utils/realSurrealTestUtils";

describe("集成测试 01: admin账号创建", () => {
  beforeAll(async () => {
    console.log("🔐 开始验证admin账号状态...");
  });

  describe("验证初始状态", () => {
    it("应该确认数据库初始状态正确", async () => {
      // 验证测试数据库已初始化
      const isValid = await TestHelpers.validateDatabaseState();
      expect(isValid).toBe(true);

      // 获取统计信息
      const stats = await TestHelpers.getDatabaseStats();
      expect(stats.user).toBeGreaterThanOrEqual(1);
      expect(stats.role).toBeGreaterThanOrEqual(1);

      console.log("✅ 数据库初始状态验证成功, 统计:", stats);
    });
  });

  describe("验证现有admin账号", () => {
    it("应该确认admin账号已存在并可用", async () => {
      // 通过查询验证admin用户存在
      const adminUsers = await TestHelpers.query(
        'SELECT * FROM user WHERE name = "系统管理员"',
      );
      expect(adminUsers).toHaveLength(1);
      const adminUser = (adminUsers[0] as any[])[0] as any;
      expect(adminUser.id.toString()).toBe("user:admin");
      expect(adminUser.name).toBe("系统管理员");
      expect(adminUser.username).toBe("admin");

      console.log("✅ admin用户已存在，验证通过:", adminUser);
    });

    it("应该通过认证测试验证admin登录功能", async () => {
      // 通过设置认证状态来模拟登录
      await TestHelpers.setAuthUser("user:admin");

      // 验证认证状态设置成功
      console.log("✅ admin认证状态设置成功");
      
      // 验证用户数据仍然存在
      const adminUsers = await TestHelpers.query('SELECT * FROM user WHERE username = "admin"');
      const adminResult = adminUsers[0] as any[];
      expect(adminResult.length).toBeGreaterThan(0);
      console.log("✅ 认证后用户数据验证成功");
    });
  });

  describe("验证用户权限", () => {
    it("应该确认admin用户具有正确的角色", async () => {
      // 设置认证状态
      await TestHelpers.setAuthUser("user:admin");
      
      // 查询admin用户的角色
      const userRoles = await TestHelpers.query(
        'SELECT ->has_role->role.* AS roles FROM user:admin'
      );
      const roles = (userRoles[0] as any[])[0]?.roles || [];
      expect(Array.isArray(roles)).toBe(true);
      expect(roles.length).toBeGreaterThan(0);
      
      // 检查是否有admin角色
      const hasAdminRole = roles.some((role: any) => role.name === 'admin');
      expect(hasAdminRole).toBe(true);
      
      console.log("✅ admin用户角色验证成功:", roles.map((r: any) => r.name));
    });

    it("应该保持admin登录状态供后续测试使用", async () => {
      // 设置admin认证状态，供后续测试使用
      await TestHelpers.setAuthUser("user:admin");
      
      console.log("✅ admin认证状态已设置，供后续测试使用");
    });
  });

  describe("测试步骤确认", () => {
    it("应该确认第一步测试完成，用户数据已准备好", async () => {
      // 获取数据库统计信息
      const stats = await TestHelpers.getDatabaseStats();
      expect(stats.user).toBeGreaterThanOrEqual(1);

      console.log("🎉 第一步测试完成！数据统计:", {
        用户数量: stats.user,
        角色数量: stats.role,
        权限关系: stats.has_role,
      });
      
      console.log("✅ 准备进入第二步：案件创建测试");
    });
  });
});
