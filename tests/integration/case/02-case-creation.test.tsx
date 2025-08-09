/**
 * 集成测试 - 02: 案件创建
 *
 * 这是集成测试的第二步，验证案件数据创建和管理
 */

import { describe, it, expect, beforeAll } from "vitest";
import { TestHelpers } from '../../utils/realSurrealTestUtils';

describe("集成测试 02: 案件创建", () => {
  beforeAll(async () => {
    console.log("📁 开始案件创建测试...");
    // 设置认证
    await TestHelpers.setAuthUser("user:admin");
  });

  describe("验证前置条件", () => {
    it("应该确认admin用户存在", async () => {
      const adminUsers = await TestHelpers.query(
        'SELECT * FROM user WHERE username = "admin"'
      );
      expect(adminUsers).toHaveLength(1);
      const adminUser = (adminUsers[0] as any[])[0] as any;
      expect(adminUser.username).toBe("admin");
      console.log("✅ 前置用户数据验证成功");
    });
  });

  describe("数据库操作测试", () => {
    it("应该能够创建第一个测试案件", async () => {
      try {
        // 首先获取真正的admin用户record ID
        const adminUsers = await TestHelpers.query(
          'SELECT id FROM user WHERE username = "admin"'
        );
        const adminUserId = (adminUsers[0] as any[])[0]?.id;
        expect(adminUserId).toBeDefined();

        // 使用符合schema的案件数据进行测试
        const caseData = {
          case_number: "TEST001",
          name: "测试债务人001",
          case_manager_name: "测试管理人",
          acceptance_date: new Date("2024-01-01T00:00:00Z"),
          created_by_user: adminUserId  // 使用真正的record ID
        };

        console.log("📝 正在创建案件，数据:", caseData);
        const createdCase = await TestHelpers.create("case", caseData);
        expect(createdCase).toBeDefined();
        expect(createdCase.case_number).toBe("TEST001");
        expect(createdCase.name).toBe("测试债务人001");
        
        console.log("✅ 第一个测试案件创建成功:", createdCase.id?.toString());
      } catch (error) {
        console.error("❌ 案件创建失败:", error);
        throw error;
      }
    });

    it("应该能够查询创建的案件", async () => {
      // 验证案件查询功能
      const cases = await TestHelpers.query("SELECT * FROM case");
      expect(cases).toBeDefined();
      expect(Array.isArray(cases)).toBe(true);
      const caseList = (cases[0] as any[]) || [];
      expect(caseList.length).toBeGreaterThan(0);
      console.log("✅ 案件查询功能验证成功，当前案件数量:", caseList.length);
    });

    it("应该能够创建第二个测试案件", async () => {
      try {
        // 获取admin用户record ID
        const adminUsers = await TestHelpers.query(
          'SELECT id FROM user WHERE username = "admin"'
        );
        const adminUserId = (adminUsers[0] as any[])[0]?.id;

        const caseData = {
          case_number: "TEST002",
          name: "测试债务人002",
          case_manager_name: "测试管理人",
          acceptance_date: new Date("2024-01-02T00:00:00Z"),
          created_by_user: adminUserId  // 使用真正的record ID
        };

        console.log("📝 正在创建第二个案件，数据:", caseData);
        const createdCase = await TestHelpers.create("case", caseData);
        expect(createdCase).toBeDefined();
        expect(createdCase.case_number).toBe("TEST002");
        expect(createdCase.name).toBe("测试债务人002");
        
        console.log("✅ 第二个测试案件创建成功:", createdCase.id?.toString());
      } catch (error) {
        console.error("❌ 第二个案件创建失败:", error);
        throw error;
      }
    });
  });

  describe("验证数据完整性", () => {
    it("应该确认所有案件数据已正确保存", async () => {
      const allCases = await TestHelpers.query("SELECT * FROM case ORDER BY created_at");
      expect(allCases).toBeDefined();
      const caseList = (allCases[0] as any[]) || [];
      expect(caseList.length).toBeGreaterThanOrEqual(2);
      
      // 验证案件数据
      const firstCase = caseList.find((c: any) => c.case_number === "TEST001");
      const secondCase = caseList.find((c: any) => c.case_number === "TEST002");
      
      expect(firstCase).toBeDefined();
      expect(secondCase).toBeDefined();
      
      console.log("✅ 案件数据完整性验证成功，案件数量:", caseList.length);
    });

    it("应该验证案件编号的唯一性", async () => {
      // 验证案件编号是否唯一
      const cases = await TestHelpers.query("SELECT case_number FROM case");
      const caseNumbers = (cases[0] as any[]).map((c: any) => c.case_number);
      const uniqueNumbers = new Set(caseNumbers);
      
      expect(uniqueNumbers.size).toBe(caseNumbers.length);
      console.log("✅ 案件编号唯一性验证成功");
    });
  });

  describe("创建基础数据", () => {
    it("应该能够创建债权人数据", async () => {
      // 确保有认证上下文
      await TestHelpers.setAuthUser("user:admin");
      
      // 获取一个案件ID用于关联
      const cases = await TestHelpers.query("SELECT id FROM case LIMIT 1");
      const caseList = (cases[0] as any[]) || [];
      expect(caseList.length).toBeGreaterThan(0);
      const caseId = caseList[0].id;

      const creditorData = {
        case_id: caseId,
        name: "测试债权人001",
        type: "individual", // 必须是 'organization' 或 'individual'
        legal_id: "110101199001011234",
        contact_phone: "13800138001",
        contact_email: "test1@example.com",
        contact_person_name: "测试债权人001"
      };

      const createdCreditor = await TestHelpers.create("creditor", creditorData);
      expect(createdCreditor).toBeDefined();
      expect(createdCreditor.name).toBe("测试债权人001");
      
      console.log("✅ 债权人数据创建成功:", createdCreditor.id?.toString());
    });
  });

  describe("验证权限控制", () => {
    it("应该验证admin可以查看所有案件", async () => {
      // 设置认证
      await TestHelpers.setAuthUser("user:admin");
      
      // 验证案件访问权限
      const cases = await TestHelpers.query("SELECT * FROM case");
      expect(cases).toBeDefined();
      const caseList = (cases[0] as any[]) || [];
      expect(caseList.length).toBeGreaterThan(0);
      
      console.log("✅ admin案件查看权限验证成功");
    });

    it("应该验证案件数据持久化", async () => {
      // 验证数据是否持久化保存
      const stats = await TestHelpers.getDatabaseStats();
      expect(stats.case).toBeGreaterThanOrEqual(2);
      expect(stats.creditor).toBeGreaterThanOrEqual(1);
      
      console.log("✅ 案件数据持久化验证成功，统计:", {
        案件数量: stats.case,
        债权人数量: stats.creditor
      });
    });
  });

  describe("测试步骤确认", () => {
    it("应该确认第二步测试完成，案件数据已准备好", async () => {
      // 获取数据库统计信息
      const stats = await TestHelpers.getDatabaseStats();
      expect(stats.case).toBeGreaterThanOrEqual(2);
      expect(stats.creditor).toBeGreaterThanOrEqual(1);

      console.log("🎉 第二步测试完成！数据统计:", {
        用户数量: stats.user,
        案件数量: stats.case,
        债权人数量: stats.creditor,
        角色数量: stats.role,
      });
      
      console.log("✅ 准备进入第三步：管理人登录测试");
    });
  });
});
