/**
 * 集成测试 - 02: 案件创建（指定管理人）
 *
 * 极简版测试，专注于验证数据库基础操作
 * 使用第一步创建的admin账号，直接通过数据库创建案件
 * 创建的案件数据将被后续测试用例使用，不进行数据清理
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import {
  getTestDatabase,
  getTestDatabaseManager,
} from "../../setup-embedded-db";
import { TEST_ORDER } from "../test-order.config";

describe("集成测试 02: 案件创建（指定管理人）", () => {
  let db: any;
  let dbManager: any;

  beforeAll(async () => {
    // 获取测试数据库实例
    db = getTestDatabase();
    dbManager = getTestDatabaseManager();

    // 验证这是正确的测试顺序
    const testConfig = TEST_ORDER.find((t) => t.order === 2);
    expect(testConfig?.description).toBe("案件创建（指定管理人）");

    // 确保以admin身份登录
    console.log("🔐 登录 admin 用户...");
    await dbManager.signIn("admin", "admin123");
    console.log("✅ admin 用户登录成功");
  }, 10000);

  describe("验证前置条件", () => {
    it("应该确认admin用户存在", async () => {
      // 验证认证状态
      const authResult = await db.query("RETURN $auth;");
      console.log("认证结果:", authResult[0]);
      expect(authResult[0]).toBeDefined();
      expect(authResult[0].id).toBe("admin");

      // 验证admin用户在数据库中存在
      const adminUsers = await db.query(
        "SELECT * FROM user WHERE id = user:admin",
      );
      expect(adminUsers).toHaveLength(1);
      expect(adminUsers[0][0].username).toBe("admin");

      console.log("✅ 前置用户数据验证成功");
    });
  });

  describe("数据库操作测试", () => {
    it("应该能够创建第一个测试案件", async () => {
      try {
        // 使用SurrealDB的INSERT语法而不是create方法
        const createResult = await db.query(`
          INSERT INTO case {
            name: '测试破产案件001',
            case_number: 'TEST-2024-001',
            case_procedure: '破产清算',
            acceptance_date: time::now(),
            procedure_phase: '受理阶段',
            created_by_user: user:admin,
            case_lead_user_id: user:admin,
            created_at: time::now(),
            updated_at: time::now()
          }
        `);

        console.log("✅ 案件创建结果:", createResult);
        expect(createResult).toBeDefined();
        expect(Array.isArray(createResult)).toBe(true);
        expect(createResult.length).toBeGreaterThan(0);
        expect(createResult[0][0].name).toBe("测试破产案件001");
        expect(createResult[0][0].case_number).toBe("TEST-2024-001");

        console.log("✅ 第一个案件创建成功:", createResult[0][0].id);
      } catch (error) {
        console.error("❌ 创建案件失败:", error);
        throw error;
      }
    });

    it("应该能够查询创建的案件", async () => {
      try {
        const cases = await db.query(
          "SELECT * FROM case WHERE case_number = 'TEST-2024-001'",
        );
        console.log("📋 查询到的案件:", cases);

        expect(cases).toBeDefined();
        expect(Array.isArray(cases)).toBe(true);
        expect(cases.length).toBeGreaterThan(0);
        expect(cases[0].name).toBe("测试破产案件001");

        console.log("✅ 案件查询成功");
      } catch (error) {
        console.error("❌ 查询案件失败:", error);
        throw error;
      }
    });

    it("应该能够创建第二个测试案件", async () => {
      try {
        const createResult = await db.query(`
          INSERT INTO case {
            name: '测试破产案件002',
            case_number: 'TEST-2024-002',
            case_procedure: '破产重整',
            acceptance_date: time::now(),
            procedure_phase: '管理阶段',
            created_by_user: user:admin,
            case_lead_user_id: user:admin,
            created_at: time::now(),
            updated_at: time::now()
          }
        `);

        console.log("✅ 第二个案件创建结果:", createResult);
        expect(createResult).toBeDefined();
        expect(Array.isArray(createResult)).toBe(true);
        expect(createResult.length).toBeGreaterThan(0);
        expect(createResult[0][0].name).toBe("测试破产案件002");
        expect(createResult[0][0].case_number).toBe("TEST-2024-002");

        console.log("✅ 第二个案件创建成功:", createResult[0][0].id);
      } catch (error) {
        console.error("❌ 创建第二个案件失败:", error);
        throw error;
      }
    });
  });

  describe("验证数据完整性", () => {
    it("应该确认所有案件数据已正确保存", async () => {
      try {
        // 查询所有测试案件
        const cases = await db.query(
          "SELECT * FROM case WHERE case_number ~ 'TEST-2024-' ORDER BY case_number",
        );
        console.log("📋 所有测试案件:", cases);

        expect(cases.length).toBeGreaterThanOrEqual(2);

        // 验证第一个案件
        const case001 = cases.find(
          (c: any) => c.case_number === "TEST-2024-001",
        );
        expect(case001).toBeDefined();
        expect(case001.name).toBe("测试破产案件001");
        expect(case001.case_procedure).toBe("破产清算");

        // 验证第二个案件
        const case002 = cases.find(
          (c: any) => c.case_number === "TEST-2024-002",
        );
        expect(case002).toBeDefined();
        expect(case002.name).toBe("测试破产案件002");
        expect(case002.case_procedure).toBe("破产重整");

        console.log("✅ 案件数据验证成功，共创建", cases.length, "个案件");
      } catch (error) {
        console.error("❌ 数据验证失败:", error);
        throw error;
      }
    });

    it("应该验证案件编号的唯一性", async () => {
      try {
        const caseNumbers = await db.query(
          "SELECT case_number FROM case WHERE case_number ~ 'TEST-2024-'",
        );
        const uniqueCaseNumbers = new Set(
          caseNumbers.map((c: any) => c.case_number),
        );

        expect(caseNumbers.length).toBe(uniqueCaseNumbers.size);
        expect(caseNumbers.length).toBeGreaterThanOrEqual(2);

        console.log(
          "✅ 案件编号唯一性验证成功，共",
          caseNumbers.length,
          "个唯一编号",
        );
      } catch (error) {
        console.error("❌ 唯一性验证失败:", error);
        throw error;
      }
    });
  });

  describe("创建基础数据", () => {
    it("应该能够创建债权人数据", async () => {
      try {
        // 获取第一个案件ID
        const caseResult = await db.query(
          "SELECT * FROM case WHERE case_number = 'TEST-2024-001' LIMIT 1",
        );
        expect(caseResult.length).toBe(1);
        const caseId = caseResult[0].id;

        // 使用INSERT语法创建债权人
        const creditorResult = await db.query(`
          INSERT INTO creditor {
            name: '测试债权人001',
            type: '普通债权人',
            contact_person: '张三',
            phone: '13800138001',
            email: 'creditor001@test.com',
            address: '北京市朝阳区测试路123号',
            case_id: ${caseId},
            created_at: time::now(),
            updated_at: time::now()
          }
        `);

        console.log("✅ 债权人创建结果:", creditorResult);
        expect(creditorResult[0][0].name).toBe("测试债权人001");

        console.log("✅ 债权人数据创建成功");
      } catch (error) {
        console.error("❌ 债权人创建失败:", error);
        throw error;
      }
    });
  });

  describe("验证权限控制", () => {
    it("应该验证admin可以查看所有案件", async () => {
      try {
        // 验证认证状态
        const authResult = await db.query("RETURN $auth;");
        expect(authResult[0]).toBeDefined();
        expect(authResult[0].id).toBe("admin");

        // 验证能查询到案件数据
        const cases = await db.query("SELECT * FROM case");
        expect(cases.length).toBeGreaterThanOrEqual(1);

        console.log("✅ admin查看案件权限验证成功");
      } catch (error) {
        console.error("❌ 权限验证失败:", error);
        throw error;
      }
    });

    it("应该验证案件数据持久化", async () => {
      try {
        // 通过数据库查询验证数据持久化
        const cases = await db.query("SELECT * FROM case");
        const users = await db.query("SELECT * FROM user");
        const creditors = await db.query("SELECT * FROM creditor");

        expect(cases.length).toBeGreaterThanOrEqual(1);
        expect(users.length).toBeGreaterThanOrEqual(1); // admin
        expect(creditors.length).toBeGreaterThanOrEqual(1);

        console.log("✅ 数据持久化验证成功");
      } catch (error) {
        console.error("❌ 持久化验证失败:", error);
        throw error;
      }
    });
  });

  describe("测试步骤确认", () => {
    it("应该确认第二步测试完成，案件数据已准备好", async () => {
      try {
        // 保持admin登录状态
        await dbManager.signIn("admin", "admin123");

        // 获取数据库统计信息
        const stats = await dbManager.getDatabaseStats();
        expect(stats.user).toBeGreaterThanOrEqual(1); // admin
        expect(stats.case).toBeGreaterThanOrEqual(1);

        // 获取创建的案件信息
        const cases = await db.query(
          "SELECT * FROM case WHERE case_number ~ 'TEST-2024-' ORDER BY case_number",
        );

        console.log("🎉 第二步测试完成！数据统计:", {
          ...stats,
          casesCreated: cases.length,
          message: "案件创建功能已测试，数据已保存，可进行后续测试",
        });

        console.log(
          "📋 案件摘要信息:",
          cases.map((c: any) => ({
            id: c.id,
            name: c.name,
            case_number: c.case_number,
            procedure: c.case_procedure,
          })),
        );

        // 验证数据完整性
        expect(cases.length).toBeGreaterThanOrEqual(1);
        expect(cases.every((c: any) => c.name && c.case_number)).toBe(true);

        console.log("✅ 第二步测试验证完成");
      } catch (error) {
        console.error("❌ 最终验证失败:", error);
        throw error;
      }
    });
  });
});
