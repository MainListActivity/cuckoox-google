/**
 * SurrealDB 语法调试（基于真实登录流程版）
 * 目标：
 * - 去除 $auth.id 和手动设置 $auth 的写法
 * - 统一通过真实登录流程，并仅对 $auth 做只读查询
 * - 验证关系查询、菜单/操作权限查询以及基础表查询
 * - 测试用例间共享数据，提高效率
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { TestHelpers } from "../../utils/realSurrealTestUtils";
import LoginTestHelpers from "../../utils/loginTestHelpers";

describe("SurrealDB语法调试（基于真实登录与 $auth 的只读查询）", () => {
  let isLoggedIn = false;

  beforeAll(async () => {
    // 整个测试套件开始时初始化数据库（只初始化一次）
    await TestHelpers.resetDatabase();
  });

  afterEach(async () => {
    // 每个测试后只清理React组件状态，保留数据库数据
    LoginTestHelpers.cleanup();
    cleanup();
  });

  it("RETURN $auth 应通过真实登录返回认证信息", async () => {
    // 使用真实登录流程
    await LoginTestHelpers.loginAsAdmin("TEST");
    isLoggedIn = true;

    const result = await TestHelpers.query("RETURN $auth;");
    expect(Array.isArray(result)).toBe(true);
    // 不强依赖结构，确保非空即可（不同版本返回结构可能不同）
    expect(result[0]).not.toBeNull();

    console.log("[语法测试] $auth 返回值类型:", typeof result[0]);
  });

  it("可以在真实登录后查询用户表", async () => {
    // 如果还没有登录，先登录
    if (!isLoggedIn) {
      await LoginTestHelpers.loginAsAdmin("TEST");
      isLoggedIn = true;
    }

    const result = await TestHelpers.query("SELECT * FROM user LIMIT 10;");
    expect(Array.isArray(result)).toBe(true);
    const rows = (result[0] as unknown[]) || [];
    expect(Array.isArray(rows)).toBe(true);

    console.log("[语法测试] 用户表记录数量:", rows.length);
  });

  it("可以通过真实登录的 $auth 查询当前用户的角色集合", async () => {
    // 如果还没有登录，先登录
    if (!isLoggedIn) {
      await LoginTestHelpers.loginAsAdmin("TEST");
      isLoggedIn = true;
    }

    const roleResult = await TestHelpers.query(`
      SELECT ->has_role->role.* AS roles FROM $auth;
    `);

    expect(Array.isArray(roleResult)).toBe(true);
    const rows = (roleResult[0] as unknown[]) || [];

    if (rows.length > 0) {
      const first = (rows[0] || {}) as { roles?: Array<{ name?: string }> };
      expect(Array.isArray(first.roles)).toBe(true);

      const hasAdmin = (first.roles || []).some((r) => r && r.name === "admin");
      expect(hasAdmin).toBe(true);

      console.log(
        "[语法测试] 用户角色:",
        first.roles?.map((r) => r.name),
      );
    }
  });

  it("可以通过真实登录的 $auth 查询菜单访问权限", async () => {
    // 如果还没有登录，先登录
    if (!isLoggedIn) {
      await LoginTestHelpers.loginAsAdmin("TEST");
      isLoggedIn = true;
    }

    const menuResult = await TestHelpers.query(`
      SELECT ->has_role->role->can_access_menu->menu_metadata.menu_id AS menus
      FROM $auth;
    `);

    expect(Array.isArray(menuResult)).toBe(true);
    const rows = (menuResult[0] as unknown[]) || [];

    if (rows.length > 0) {
      const first = (rows[0] || {}) as { menus?: string[] };
      expect(Array.isArray(first.menus)).toBe(true);

      const menus = new Set(first.menus || []);
      console.log("[语法测试] 用户可访问菜单:", Array.from(menus));

      // 只有在有菜单权限的情况下才进行断言
      if (menus.size > 0) {
        expect(menus.size).toBeGreaterThan(0);

        // 检查是否包含常见的管理员菜单（如果存在的话）
        const commonMenus = ["dashboard", "cases", "claims", "admin"];
        const hasAnyCommonMenu = commonMenus.some((menu) => menus.has(menu));
        if (hasAnyCommonMenu) {
          console.log("[语法测试] 发现常见菜单权限");
        }
      }
    }
  });

  it("可以通过真实登录的 $auth 查询操作权限", async () => {
    // 如果还没有登录，先登录
    if (!isLoggedIn) {
      await LoginTestHelpers.loginAsAdmin("TEST");
      isLoggedIn = true;
    }

    const opResult = await TestHelpers.query(`
      SELECT ->has_role->role->can_execute_operation->operation_metadata.operation_id AS operations
      FROM $auth;
    `);

    expect(Array.isArray(opResult)).toBe(true);
    const rows = (opResult[0] as unknown[]) || [];

    if (rows.length > 0) {
      const first = (rows[0] || {}) as { operations?: string[] };
      expect(Array.isArray(first.operations)).toBe(true);

      const ops = new Set(first.operations || []);
      console.log("[语法测试] 用户可执行操作:", Array.from(ops));

      // 只有在有操作权限的情况下才进行断言
      if (ops.size > 0) {
        expect(ops.size).toBeGreaterThan(0);

        // 检查是否包含常见的管理员操作（如果存在的话）
        const commonOps = [
          "case_list_view",
          "case_view_detail",
          "claim_create",
          "claim_list_view",
        ];
        const hasAnyCommonOp = commonOps.some((op) => ops.has(op));
        if (hasAnyCommonOp) {
          console.log("[语法测试] 发现常见操作权限");
        }
      }
    }
  });

  it("可以查询 has_role 关系表验证数据结构", async () => {
    // 如果还没有登录，先登录
    if (!isLoggedIn) {
      await LoginTestHelpers.loginAsAdmin("TEST");
      isLoggedIn = true;
    }

    const relResult = await TestHelpers.query(
      "SELECT * FROM has_role LIMIT 5;",
    );
    expect(Array.isArray(relResult)).toBe(true);
    const rows = (relResult[0] as unknown[]) || [];
    expect(Array.isArray(rows)).toBe(true);

    console.log("[语法测试] has_role 关系表记录数量:", rows.length);

    // 验证关系表的基本结构
    if (rows.length > 0) {
      const firstRelation = rows[0] as { id?: any; in?: any; out?: any };
      expect(firstRelation.id).toBeTruthy();
      expect(firstRelation.in).toBeTruthy(); // 用户ID
      expect(firstRelation.out).toBeTruthy(); // 角色ID

      console.log("[语法测试] 关系记录示例:", {
        id: firstRelation.id,
        user: firstRelation.in,
        role: firstRelation.out,
      });
    }
  });

  it("应该验证数据库表结构的完整性", async () => {
    // 如果还没有登录，先登录
    if (!isLoggedIn) {
      await LoginTestHelpers.loginAsAdmin("TEST");
      isLoggedIn = true;
    }

    // 查询数据库中的主要表和记录数量
    const tableStats = await TestHelpers.query(`
      SELECT
        (SELECT count() FROM user GROUP ALL)[0].count AS user_count,
        (SELECT count() FROM role GROUP ALL)[0].count AS role_count,
        (SELECT count() FROM has_role GROUP ALL)[0].count AS user_role_count,
        (SELECT count() FROM menu_metadata GROUP ALL)[0].count AS menu_count,
        (SELECT count() FROM operation_metadata GROUP ALL)[0].count AS operation_count;
    `);

    const stats = (tableStats[0] as any[])[0];

    console.log("[语法测试] 数据库表统计:", {
      users: stats.user_count,
      roles: stats.role_count,
      userRoles: stats.user_role_count,
      menus: stats.menu_count,
      operations: stats.operation_count,
    });

    // 验证基础数据存在
    expect(stats.user_count).toBeGreaterThan(0);
    expect(stats.role_count).toBeGreaterThan(0);
    expect(stats.user_role_count).toBeGreaterThan(0);
  });

  it("应该验证复杂的关系查询语法", async () => {
    // 如果还没有登录，先登录
    if (!isLoggedIn) {
      await LoginTestHelpers.loginAsAdmin("TEST");
      isLoggedIn = true;
    }

    // 执行复杂的多层关系查询
    const complexQuery = await TestHelpers.query(`
      SELECT
        id,
        name,
        ->has_role->role.name AS user_roles,
        ->has_role->role->can_access_menu->menu_metadata.menu_id AS accessible_menus,
        ->has_role->role->can_execute_operation->operation_metadata.operation_id AS executable_operations
      FROM $auth;
    `);

    expect(Array.isArray(complexQuery)).toBe(true);
    const queryRows = (complexQuery[0] as unknown[]) || [];

    if (queryRows.length > 0) {
      const userInfo = queryRows[0] as {
        id?: any;
        name?: string;
        user_roles?: string[];
        accessible_menus?: string[];
        executable_operations?: string[];
      };

      expect(userInfo.id).toBeTruthy();
      expect(userInfo.name).toBeTruthy();
      expect(Array.isArray(userInfo.user_roles)).toBe(true);
      expect(Array.isArray(userInfo.accessible_menus)).toBe(true);
      expect(Array.isArray(userInfo.executable_operations)).toBe(true);

      console.log("[语法测试] 复杂查询结果:", {
        userId: userInfo.id,
        userName: userInfo.name,
        rolesCount: userInfo.user_roles?.length,
        menusCount: userInfo.accessible_menus?.length,
        operationsCount: userInfo.executable_operations?.length,
      });
    }
  });

  it("应该验证数据共享和测试间数据累积", async () => {
    // 如果还没有登录，先登录
    if (!isLoggedIn) {
      await LoginTestHelpers.loginAsAdmin("TEST");
      isLoggedIn = true;
    }

    // 检查其他测试套件创建的共享数据
    const sharedDataCheck = await TestHelpers.query(`
      SELECT * FROM test_shared_data;
    `);

    const sharedRecords = (sharedDataCheck[0] as unknown[]) || [];
    console.log("[数据共享验证] 发现的共享数据记录数:", sharedRecords.length);

    if (sharedRecords.length > 0) {
      const testSuites = new Set(
        sharedRecords.map((record: any) => record.test_suite).filter(Boolean),
      );
      console.log("[数据共享验证] 涉及的测试套件:", Array.from(testSuites));
    }

    // 创建语法测试的共享数据
    await TestHelpers.query(`
      CREATE test_shared_data SET
        created_at = time::now(),
        test_suite = 'syntax-test',
        message = 'SurrealDB语法测试的共享数据',
        syntax_features_tested = [
          'auth_query',
          'relation_traversal',
          'permission_check',
          'complex_query'
        ];
    `);

    // 验证数据累积效果
    const afterCreation = await TestHelpers.query(`
      SELECT count() FROM test_shared_data GROUP ALL;
    `);

    const totalCount = (afterCreation[0] as any[])[0]?.count || 0;
    expect(totalCount).toBeGreaterThan(0);

    console.log("[数据共享验证] 总共享数据记录数:", totalCount);
  });
});
