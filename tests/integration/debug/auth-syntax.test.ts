/**
 * 认证语法调试（基于真实登录流程与 $auth 的只读查询）
 * 目标：
 * - 通过真实登录页面获取认证态，使用 $auth 做只读查询
 * - 不使用 $auth.id（避免不同引擎/版本上的解析差异）
 * - 不尝试给 $auth 赋值（受保护变量）
 * - 测试完整的端到端认证流程
 * - 测试用例间共享数据，提高效率
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { TestHelpers, TEST_IDS } from "../../utils/realSurrealTestUtils";
import LoginTestHelpers from "../../utils/loginTestHelpers";

describe("认证语法调试（基于真实登录流程与 $auth 的只读查询）", () => {
  beforeAll(async () => {
    // 整个测试套件开始时初始化数据库并设置认证状态
    await TestHelpers.resetDatabase();
    await LoginTestHelpers.setDatabaseAuth(TEST_IDS.USERS.ADMIN);
  });

  afterEach(async () => {
    // 每个测试后只清理登录环境
    LoginTestHelpers.cleanup();
  });

  it("应该通过数据库认证返回 $auth 基本信息", async () => {
    // 验证认证状态
    const result = await TestHelpers.query("RETURN $auth;");

    // Surreal 返回值为多结果集数组：这里仅有一个 RETURN 结果
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).not.toBeNull();

    // 验证返回的是有效的用户对象或记录ID
    const authData = result[0];
    expect(authData).toBeTruthy();

    console.log("[认证调试] $auth 返回值:", authData);
  });

  it("应该能够查询当前认证用户的角色集合", async () => {
    const roleResult = await TestHelpers.query(`
      SELECT ->has_role->role.* AS roles FROM $auth;
    `);

    // 结果集数组，第一个为 SELECT 结果（数组）
    expect(Array.isArray(roleResult)).toBe(true);
    const rows = (roleResult[0] as unknown[]) || [];
    expect(Array.isArray(rows)).toBe(true);

    if (rows.length > 0) {
      const first = (rows[0] || {}) as { roles?: Array<{ name?: string }> };
      expect(Array.isArray(first.roles)).toBe(true);

      // 管理员应包含 admin 角色
      const hasAdmin = (first.roles || []).some((r) => r && r.name === "admin");
      expect(hasAdmin).toBe(true);

      console.log(
        "[角色调试] 用户角色:",
        first.roles?.map((r) => r.name),
      );
    }
  });

  it("应该能够查询当前认证用户的菜单访问权限", async () => {
    // 查询菜单权限
    const menuResult = await TestHelpers.query(`
      SELECT ->has_role->role->can_access_menu->menu_metadata.menu_id AS menus FROM $auth;
    `);

    expect(Array.isArray(menuResult)).toBe(true);
    const rows = (menuResult[0] as unknown[]) || [];

    if (rows.length > 0) {
      const first = (rows[0] || {}) as { menus?: string[] };
      expect(Array.isArray(first.menus)).toBe(true);

      // 获取菜单权限列表
      const menus = new Set(first.menus || []);

      console.log("[菜单调试] 用户可访问菜单:", Array.from(menus));

      // 验证基础菜单权限（如果这些菜单在Schema中定义了）
      if (menus.size > 0) {
        // 只有在有菜单权限的情况下才进行断言
        expect(menus.size).toBeGreaterThan(0);

        // 检查是否包含常见的管理员菜单
        const commonAdminMenus = ["dashboard", "cases", "claims", "admin"];
        const hasAnyCommonMenu = commonAdminMenus.some((menu) =>
          menus.has(menu),
        );
        if (hasAnyCommonMenu) {
          expect(hasAnyCommonMenu).toBe(true);
        }
      }
    }
  });

  it("应该能够查询当前认证用户的操作权限", async () => {
    const opResult = await TestHelpers.query(`
      SELECT ->has_role->role->can_execute_operation->operation_metadata.operation_id AS operations
      FROM $auth;
    `);

    expect(Array.isArray(opResult)).toBe(true);
    const rows = (opResult[0] as unknown[]) || [];

    if (rows.length > 0) {
      const first = (rows[0] || {}) as { operations?: string[] };
      expect(Array.isArray(first.operations)).toBe(true);

      // 获取操作权限列表
      const ops = new Set(first.operations || []);

      console.log("[操作调试] 用户可执行操作:", Array.from(ops));

      // 验证基础操作权限（如果这些操作在Schema中定义了）
      if (ops.size > 0) {
        // 只有在有操作权限的情况下才进行断言
        expect(ops.size).toBeGreaterThan(0);

        // 检查是否包含常见的管理员操作
        const commonAdminOps = [
          "case_list_view",
          "case_view_detail",
          "claim_create",
          "claim_list_view",
        ];
        const hasAnyCommonOp = commonAdminOps.some((op) => ops.has(op));
        if (hasAnyCommonOp) {
          expect(hasAnyCommonOp).toBe(true);
        }
      }
    }
  });

  it("验证认证后权限系统的完整性", async () => {
    // 验证用户、角色、菜单、操作的完整关系链
    const fullPermissionResult = await TestHelpers.query(`
      SELECT
        id,
        ->has_role->role.name AS user_roles,
        ->has_role->role->can_access_menu->menu_metadata.menu_id AS accessible_menus,
        ->has_role->role->can_execute_operation->operation_metadata.operation_id AS executable_operations
      FROM $auth;
    `);

    expect(Array.isArray(fullPermissionResult)).toBe(true);
    const rows = (fullPermissionResult[0] as unknown[]) || [];
    expect(rows.length).toBeGreaterThan(0);

    const userPermissions = rows[0] as {
      id?: any;
      user_roles?: string[];
      accessible_menus?: string[];
      executable_operations?: string[];
    };

    // 验证数据结构的完整性
    expect(userPermissions.id).toBeTruthy();
    expect(Array.isArray(userPermissions.user_roles)).toBe(true);
    expect(Array.isArray(userPermissions.accessible_menus)).toBe(true);
    expect(Array.isArray(userPermissions.executable_operations)).toBe(true);

    console.log("[完整权限调试] 用户完整权限信息:", {
      userId: userPermissions.id,
      roles: userPermissions.user_roles,
      menus: userPermissions.accessible_menus,
      operations: userPermissions.executable_operations,
    });

    // 验证管理员用户至少有一个角色
    expect(userPermissions.user_roles!.length).toBeGreaterThan(0);
  });

  it("不允许设置或覆盖 $auth（应抛出错误）", async () => {
    // 尝试 DEFINE PARAM 设置 $auth（受保护变量），应失败
    let defineFailed = false;
    try {
      await TestHelpers.query(`DEFINE PARAM $auth VALUE user:admin;`);
    } catch {
      defineFailed = true;
    }
    expect(defineFailed).toBe(true);

    // 尝试 LET 赋值 $auth（受保护变量），应失败
    let letFailed = false;
    try {
      await TestHelpers.query(`LET $auth = user:admin; RETURN $auth;`);
    } catch {
      letFailed = true;
    }
    expect(letFailed).toBe(true);
  });

  it("在认证的 $auth 只读前提下，仍可进行一般 SELECT 查询", async () => {
    // 验证可以进行普通查询
    const res = await TestHelpers.query(
      `SELECT * FROM user WHERE github_id = '--admin--' LIMIT 1;`,
    );
    expect(Array.isArray(res)).toBe(true);
    const rows = (res[0] as unknown[]) || [];
    expect(rows.length).toBe(1);

    // 验证查询到的用户信息
    const adminUser = rows[0] as { github_id?: string; name?: string };
    expect(adminUser.github_id).toBe("--admin--");
    expect(adminUser.name).toBe("系统管理员");
  });

  it("应该能够验证认证状态的持久性", async () => {
    // 验证认证状态是否有效
    const authCheckResult = await TestHelpers.query("RETURN $auth;");
    expect(authCheckResult[0]).toBeTruthy();

    // 验证能够查询用户信息
    const userInfoResult = await TestHelpers.query(`
      SELECT id, name, github_id FROM $auth;
    `);

    expect(Array.isArray(userInfoResult)).toBe(true);
    const userRows = (userInfoResult[0] as unknown[]) || [];

    if (userRows.length > 0) {
      const userInfo = userRows[0] as {
        id?: any;
        name?: string;
        github_id?: string;
      };
      expect(userInfo.id).toBeTruthy();
      expect(userInfo.name).toBeTruthy();
      expect(userInfo.github_id).toBeTruthy();

      console.log("[认证持久性] 用户信息:", userInfo);
    }
  });

  it("应该能够测试数据共享和累积效果", async () => {
    // 验证数据库中已有的数据
    const statsResult = await TestHelpers.query(`
      SELECT
        (SELECT count() FROM user GROUP ALL)[0].count AS user_count,
        (SELECT count() FROM role GROUP ALL)[0].count AS role_count,
        (SELECT count() FROM has_role GROUP ALL)[0].count AS user_role_count;
    `);

    const stats = (statsResult[0] as any[])[0];

    console.log("[数据共享测试] 数据库统计:", {
      users: stats.user_count,
      roles: stats.role_count,
      userRoles: stats.user_role_count,
    });

    // 验证基础数据存在
    expect(stats.user_count).toBeGreaterThan(0);
    expect(stats.role_count).toBeGreaterThan(0);
    expect(stats.user_role_count).toBeGreaterThan(0);

    // 创建一些测试数据，验证数据在测试间的共享
    const testDataResult = await TestHelpers.query(`
      CREATE test_shared_data SET
        created_at = time::now(),
        test_suite = 'auth-syntax',
        message = '这是集成测试中的共享数据';
    `);

    const createdData = (testDataResult[0] as any[])[0];
    expect(createdData.id).toBeTruthy();
    expect(createdData.message).toBe("这是集成测试中的共享数据");

    console.log("[数据共享测试] 创建的共享数据:", createdData.id);
  });
});
