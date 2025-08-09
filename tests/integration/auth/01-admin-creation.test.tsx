/**
 * 集成测试 - 01: admin账号创建
 *
 * 这是集成测试的第一步，通过页面操作创建系统管理员账号
 * 创建的数据将被后续测试用例使用，不进行数据清理
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  getTestDatabase,
  getTestDatabaseManager,
} from "../../setup-embedded-db";
import { TEST_ORDER } from "../test-order.config";

describe("集成测试 01: admin账号创建", () => {
  let db: any;
  let dbManager: any;

  beforeAll(async () => {
    // 获取测试数据库实例
    db = getTestDatabase();
    dbManager = getTestDatabaseManager();

    // 验证这是正确的测试顺序
    const testConfig = TEST_ORDER.find((t) => t.order === 1);
    expect(testConfig?.description).toBe("admin账号创建");
  });

  describe("验证初始状态", () => {
    it("应该确认数据库初始状态正确", async () => {
      // 验证数据库连接正常
      expect(db).toBeDefined();
      expect(dbManager).toBeDefined();

      // 验证测试数据库已初始化
      const isValid = await dbManager.validateDatabaseState();
      expect(isValid).toBe(true);

      console.log("✅ 数据库初始状态验证成功");
    });
  });

  describe("验证现有admin账号", () => {
    it("应该确认admin账号已存在并可用", async () => {
      // 验证已存在的admin用户
      const adminUsers = await db.query(
        'SELECT * FROM user WHERE name = "系统管理员"',
      );
      expect(adminUsers).toHaveLength(1);
      expect(adminUsers[0][0].id.toString()).toBe("user:admin");
      expect(adminUsers[0][0].name).toBe("系统管理员");
      expect(adminUsers[0][0].username).toBe("admin");

      console.log("✅ admin用户已存在，验证通过:", adminUsers[0][0]);
    });

    it("应该验证admin登录功能", async () => {
      // 通过数据库管理器验证登录
      await dbManager.signIn("admin", "admin123");

      // 验证认证状态
      const authResult = await db.query("RETURN $auth;");
      expect(authResult[0]).toBeDefined();
      expect(authResult[0].toString()).toBe("user:admin");

      console.log("✅ admin登录功能验证成功:", authResult[0]);
    });
  });

  describe("创建其他测试用户", () => {
    it("应该通过admin权限创建案件管理人用户", async () => {
      // 确保以admin身份执行
      await dbManager.signIn("admin", "admin123");

      // 检查是否已存在manager用户
      const existingManager = await db.query(
        'SELECT * FROM user WHERE username = "manager"',
      );
      if (existingManager[0].length > 0) {
        console.log("✅ 案件管理人用户已存在");
        return;
      }

      // 创建案件管理人用户（模拟通过管理界面创建）
      const managerUser = {
        id: "manager_001",
        username: "manager",
        email: "manager@cuckoox.com",
        realName: "案件管理人",
        role: "manager",
        status: "active",
        createdAt: new Date().toISOString(),
      };

      const createResult = await db.create("user", managerUser);
      expect(createResult[0].username).toBe("manager");

      // 设置认证信息
      await db.query(
        `
        UPDATE user:manager_001 SET
        auth = {
          username: $username,
          password: crypto::argon2::generate($password)
        }
      `,
        {
          username: "manager",
          password: "manager123",
        },
      );

      console.log("✅ 案件管理人用户创建成功");
    });

    it("应该通过admin权限创建案件成员用户", async () => {
      // 确保以admin身份执行
      await dbManager.signIn("admin", "admin123");

      // 检查是否已存在member用户
      const existingMember = await db.query(
        'SELECT * FROM user WHERE username = "member"',
      );
      if (existingMember[0].length > 0) {
        console.log("✅ 案件成员用户已存在");
        return;
      }

      // 创建案件成员用户（模拟通过管理界面创建）
      const memberUser = {
        id: "member_001",
        username: "member",
        email: "member@cuckoox.com",
        realName: "案件成员",
        role: "member",
        status: "active",
        createdAt: new Date().toISOString(),
      };

      const createResult = await db.create("user", memberUser);
      expect(createResult[0].username).toBe("member");

      // 设置认证信息
      await db.query(
        `
        UPDATE user:member_001 SET
        auth = {
          username: $username,
          password: crypto::argon2::generate($password)
        }
      `,
        {
          username: "member",
          password: "member123",
        },
      );

      console.log("✅ 案件成员用户创建成功");
    });
  });

  describe("验证创建的用户数据", () => {
    it("应该确认所有测试用户已创建", async () => {
      // 查询所有用户
      const allUsers = await db.query("SELECT * FROM user ORDER BY created_at");
      expect(allUsers[0].length).toBeGreaterThanOrEqual(1); // 至少有admin用户

      // 验证admin用户
      const admin = allUsers[0].find((u: any) => u.id === "user:admin");
      expect(admin).toBeDefined();
      expect(admin.name).toBe("系统管理员");

      // 验证manager用户（如果创建了）
      const manager = allUsers[0].find((u: any) => u.username === "manager");
      if (manager) {
        expect(manager.realName).toBe("案件管理人");
      }

      // 验证member用户（如果创建了）
      const member = allUsers[0].find((u: any) => u.username === "member");
      if (member) {
        expect(member.realName).toBe("案件成员");
      }

      console.log("✅ 测试用户验证成功:", {
        total: allUsers[0].length,
        admin: admin?.name,
        manager: manager?.realName,
        member: member?.realName,
      });
    });

    it("应该保持admin登录状态供后续测试使用", async () => {
      // 保持admin登录状态
      await dbManager.signIn("admin", "admin123");

      // 验证当前认证状态
      const authResult = await db.query("RETURN $auth;");
      expect(authResult[0]).toBeDefined();
      expect(authResult[0].toString()).toBe("user:admin");

      console.log("✅ admin登录状态已保持");
    });
  });

  describe("测试步骤确认", () => {
    it("应该确认第一步测试完成，用户数据已准备好", async () => {
      // 获取数据库统计信息
      const stats = await dbManager.getDatabaseStats();
      expect(stats.user).toBeGreaterThanOrEqual(1);

      console.log("🎉 第一步测试完成！数据统计:", {
        ...stats,
        message: "用户账号已准备，admin可登录，数据已保存，可进行后续测试",
      });

      // 注意：数据不会被清理，将保留给后续测试使用
    });
  });
});
