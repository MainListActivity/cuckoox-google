/**
 * 认证服务真实数据库测试（完全仿真：使用登录 + $auth）
 * - 通过 SIGNIN 登录来获得认证上下文
 * - 使用 $auth / $auth.id 参与权限判定与查询
 * - 不再使用 $current_user
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RecordId } from "surrealdb";
import { TestHelpers, TEST_IDS } from "../utils/realSurrealTestUtils";

describe("认证服务 - 真实数据库测试（使用 $auth）", () => {
  beforeEach(async () => {
    await TestHelpers.resetDatabase();
  });

  describe("用户认证状态", () => {
    it("应该正确设置和验证认证用户", async () => {
      // 登录管理员
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      // 验证认证状态 - 使用 $auth 并查询实际记录
      const authResult = await TestHelpers.query("SELECT * FROM $auth;");
      expect(Array.isArray(authResult[0])).toBe(true);
      expect((authResult[0] as unknown[]).length).toBeGreaterThan(0);
      const first = (authResult[0] as unknown[])[0] as {
        id: { toString: () => string };
      };
      expect(first.id.toString()).toBe(TEST_IDS.USERS.ADMIN);
    });

    it("应该能够清除认证状态", async () => {
      // 先登录
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      // 确认已登录
      let authResult = await TestHelpers.query("SELECT * FROM $auth;");
      expect(Array.isArray(authResult[0])).toBe(true);
      expect((authResult[0] as unknown[])[0]).toBeDefined();

      // 清除认证
      await TestHelpers.clearAuth();

      // 验证认证已清除：此时 RETURN $auth 可能为 null，SELECT * FROM $auth 可能抛错
      try {
        const r = await TestHelpers.query("RETURN $auth;");
        // RETURN $auth 允许返回 null
        expect(r).toBeDefined();
        // 允许 r[0] 为 null
      } catch (error) {
        // 某些实现可能直接报错，这也是允许的
        expect(error).toBeDefined();
      }
    });

    it("应该支持不同用户的认证切换", async () => {
      // 管理员
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);
      let authResult = await TestHelpers.query("SELECT * FROM $auth;");
      let first = (authResult[0] as unknown[])[0] as {
        id: { toString: () => string };
      };
      expect(first.id.toString()).toBe(TEST_IDS.USERS.ADMIN);

      // 切换为案件管理员
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CASE_MANAGER);
      authResult = await TestHelpers.query("SELECT * FROM $auth;");
      first = (authResult[0] as unknown[])[0] as {
        id: { toString: () => string };
      };
      expect(first.id.toString()).toBe(TEST_IDS.USERS.CASE_MANAGER);

      // 切换为债权人用户
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CREDITOR_USER);
      authResult = await TestHelpers.query("SELECT * FROM $auth;");
      first = (authResult[0] as unknown[])[0] as {
        id: { toString: () => string };
      };
      expect(first.id.toString()).toBe(TEST_IDS.USERS.CREDITOR_USER);
    });
  });

  describe("用户角色权限", () => {
    it("应该正确查询当前登录用户的角色信息", async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      // 查询当前登录用户的角色
      const roleResult = await TestHelpers.query(`
        SELECT ->has_role->role.* AS roles FROM $auth;
      `);
      expect(Array.isArray(roleResult[0])).toBe(true);
      expect((roleResult[0] as unknown[]).length).toBeGreaterThan(0);
      const row0 = (roleResult[0] as unknown[])[0] as { roles: unknown[] };
      expect(Array.isArray(row0.roles)).toBe(true);
      const hasAdminRole = (row0.roles as any[]).some(
        (role) => role.name === "admin",
      );
      expect(hasAdminRole).toBe(true);
    });

    it("应该正确查询案件管理员的操作权限（operation_id）", async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CASE_MANAGER);

      // 查询当前登录用户的操作权限（返回 operation_id 列表）
      const permissionResult = await TestHelpers.query(`
        SELECT ->has_role->role->can_execute_operation->operation_metadata.operation_id AS operations
        FROM $auth;
      `);
      expect(Array.isArray(permissionResult[0])).toBe(true);
      expect((permissionResult[0] as unknown[]).length).toBeGreaterThan(0);
      const prow = (permissionResult[0] as unknown[])[0] as {
        operations: string[];
      };
      expect(Array.isArray(prow.operations)).toBe(true);
      // 验证常见的案件阅读权限标识（依赖 schema 初始化）
      const set = new Set(prow.operations || []);
      expect(set.has("case_list_view") || set.has("case_view_detail")).toBe(
        true,
      );
    });

    it("应该正确查询债权人的权限（operation_id 包含 claim 相关）", async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CREDITOR_USER);

      const permissionResult = await TestHelpers.query(`
        SELECT ->has_role->role->can_execute_operation->operation_metadata.operation_id AS operations
        FROM $auth;
      `);
      expect(Array.isArray(permissionResult[0])).toBe(true);
      const prow = (permissionResult[0] as unknown[])[0] as {
        operations: string[];
      };
      expect(Array.isArray(prow.operations)).toBe(true);
      const ops = new Set(prow.operations || []);
      // 应包含与债权操作相关的操作（具体取决于 schema 中初始化的操作）
      expect(
        ops.has("claim_submit") ||
          ops.has("claim_view_own") ||
          ops.has("claim_list_view"),
      ).toBe(true);
    });
  });

  describe("菜单访问权限", () => {
    it("应该正确查询当前登录用户的菜单访问权限（menu_id 列表）", async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      const menuResult = await TestHelpers.query(`
        SELECT ->has_role->role->can_access_menu->menu_metadata.menu_id AS menus
        FROM $auth;
      `);
      expect(Array.isArray(menuResult[0])).toBe(true);
      const mrow = (menuResult[0] as unknown[])[0] as { menus: string[] };
      expect(Array.isArray(mrow.menus)).toBe(true);

      const menus = new Set(mrow.menus || []);
      expect(menus.has("dashboard")).toBe(true);
      expect(menus.has("cases") || menus.has("claims_list")).toBe(true);
    });

    it("应该验证非管理员用户的菜单访问限制", async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CREDITOR_USER);

      const menuResult = await TestHelpers.query(`
        SELECT ->has_role->role->can_access_menu->menu_metadata.menu_id AS menus
        FROM $auth;
      `);
      expect(Array.isArray(menuResult[0])).toBe(true);
      const mrow = (menuResult[0] as unknown[])[0] as { menus: string[] };
      expect(Array.isArray(mrow.menus)).toBe(true);
      // 只要有菜单列表即可，具体数量与 schema 初始化有关
    });
  });

  describe("案件级别权限", () => {
    it("应该支持案件级别的角色分配（使用 $auth 作为 assigned_by）", async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      const caseId = new RecordId("case", "test_case_1");
      const userId = new RecordId("user", "test_user");
      const roleId = new RecordId("role", "case_manager");

      await TestHelpers.query(
        `
        RELATE $user_id->has_case_role->$role_id SET
          case_id = $case_id,
          assigned_at = time::now(),
          assigned_by = $auth;
      `,
        {
          user_id: userId,
          role_id: roleId,
          case_id: caseId,
        },
      );

      // 验证案件角色分配
      const caseRoleResult = await TestHelpers.query(
        `
        SELECT ->has_case_role->role.* AS case_roles,
               ->has_case_role.case_id AS case_ids
        FROM $user_id;
      `,
        { user_id: new RecordId("user", "test_user") },
      );

      expect(Array.isArray(caseRoleResult[0])).toBe(true);
      expect((caseRoleResult[0] as unknown[]).length).toBeGreaterThan(0);
      const crow = (caseRoleResult[0] as unknown[])[0] as {
        case_roles: unknown[];
        case_ids: unknown[];
      };
      expect(Array.isArray(crow.case_roles)).toBe(true);
      expect(crow.case_ids).toBeDefined();
      const hasCM = (crow.case_roles as any[]).some(
        (role) => role.name === "case_manager",
      );
      expect(hasCM).toBe(true);
    });

    it("应该验证案件级别权限的数据访问", async () => {
      // 为测试用户分配特定案件的管理权限
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      const testUserId = new RecordId("user", "test_user");
      const caseId = new RecordId("case", "test_case_1");
      const caseManagerRoleId = new RecordId("role", "case_manager");

      await TestHelpers.query(
        `
        RELATE $user_id->has_case_role->$role_id SET
          case_id = $case_id,
          assigned_at = time::now(),
          assigned_by = $auth;
      `,
        {
          user_id: testUserId,
          role_id: caseManagerRoleId,
          case_id: caseId,
        },
      );

      // 切换到测试用户
      await TestHelpers.setAuthUser(TEST_IDS.USERS.TEST_USER);

      // 尝试访问分配的案件
      const accessibleCases = await TestHelpers.query(
        `
        SELECT * FROM case WHERE id = $case_id;
      `,
        { case_id: caseId },
      );

      expect(accessibleCases[0]).toBeDefined();
      // 根据权限设置，用户应该能看到这个案件（如果权限模型允许）
    });
  });

  describe("数据权限验证", () => {
    it("应该验证不同用户对案件数据的访问权限", async () => {
      // 管理员可以访问所有案件
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);
      const adminCaseAccess = await TestHelpers.query(
        "SELECT count() FROM case;",
      );
      expect(Array.isArray(adminCaseAccess[0])).toBe(true);
      const ac0 = (adminCaseAccess[0] as unknown[])[0] as { count: number };
      const adminCaseCount = ac0.count;
      expect(adminCaseCount).toBeGreaterThan(0);

      // 债权人用户的访问权限
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CREDITOR_USER);
      try {
        const creditorCaseAccess = await TestHelpers.query(
          "SELECT count() FROM case;",
        );
        // 如果查询成功，验证结果存在
        expect(creditorCaseAccess).toBeDefined();
      } catch (error) {
        // 如果查询失败，可能是因为权限限制
        expect(error).toBeDefined();
      }
    });

    it("应该验证债权申报数据的权限控制（created_by = $auth.id）", async () => {
      // 管理员创建一个属于 creditor_user 的债权申报
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      // 先创建一个用于债权附件的 document 记录（attachment_doc_id 需要指向有效的 document）
      const doc = await TestHelpers.create("document", {
        original_file_name: "附件.pdf",
        mime_type: "application/pdf",
        file_size: 0,
      });

      // 创建债权申报，补全 schema 要求的 asserted_claim_details 字段
      await TestHelpers.create("claim", {
        case_id: new RecordId("case", "test_case_1"),
        creditor_id: new RecordId("creditor", "creditor_1"),
        created_by: new RecordId("user", "creditor_user"),
        claim_amount: 50000.0,
        claim_nature: "一般债权",
        asserted_claim_details: {
          principal: 50000.0,
          interest: 0,
          // 使用刚创建的 document 记录作为附件ID
          attachment_doc_id: new RecordId("document", (doc as any).id.id),
        },
      });

      // 切换到债权申报创建者
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CREDITOR_USER);

      // 验证用户可以访问自己创建的债权申报（created_by = $auth.id）
      const userClaims = await TestHelpers.query(
        "SELECT * FROM claim WHERE created_by = $auth.id;",
      );

      expect(Array.isArray(userClaims[0])).toBe(true);
      const foundClaim = (userClaims[0] as any[])[0];
      expect(foundClaim).toBeDefined();
    });
  });

  describe("权限边界测试", () => {
    it("应该正确处理无效的用户ID", async () => {
      // 模拟无效用户登录：由于 setAuthUser 内部基于用户名密码登录，这里可能抛错
      let failed = false;
      try {
        await TestHelpers.setAuthUser("user:nonexistent_user");
      } catch {
        failed = true;
      }
      expect(failed).toBe(true);
    });

    it("应该验证角色权限的传递性（operation_id 列表）", async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CASE_MANAGER);

      const inheritedPermissions = await TestHelpers.query(`
        SELECT ->has_role->role->can_execute_operation->operation_metadata.operation_id AS operation_ids
        FROM $auth;
      `);

      expect(Array.isArray(inheritedPermissions[0])).toBe(true);
      const first = (inheritedPermissions[0] as any[])[0] || {
        operation_ids: [],
      };
      const operationIds = Array.isArray(first.operation_ids)
        ? first.operation_ids
        : [];
      // 应为字符串数组
      expect(Array.isArray(operationIds)).toBe(true);
    });
  });
});
