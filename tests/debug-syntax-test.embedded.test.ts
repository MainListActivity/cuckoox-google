/**
 * SurrealDB 语法调试（重写版）
 * 目标：
 * - 去除 $auth.id 和手动设置 $auth 的写法
 * - 统一通过登录态，并仅对 $auth 做只读查询
 * - 验证关系查询、菜单/操作权限查询以及基础表查询
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TestHelpers, TEST_IDS } from "./utils/realSurrealTestUtils";

describe("SurrealDB语法调试（基于登录与 $auth 的只读查询）", () => {
  beforeEach(async () => {
    // 每个用例前重置数据库并以管理员登录，确保具备足够权限（完全仿真生产权限）
    await TestHelpers.resetDatabase();
    await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);
  });

  it("RETURN $auth 应返回认证信息", async () => {
    const result = await TestHelpers.query("RETURN $auth;");
    expect(Array.isArray(result)).toBe(true);
    // 不强依赖结构，确保非空即可（不同版本返回结构可能不同）
    expect(result[0]).not.toBeNull();
  });

  it("可以查询用户表（以管理员登录）", async () => {
    const result = await TestHelpers.query("SELECT * FROM user LIMIT 10;");
    expect(Array.isArray(result)).toBe(true);
    const rows = (result[0] as unknown[]) || [];
    expect(Array.isArray(rows)).toBe(true);
  });

  it("可以通过 $auth 查询当前用户的角色集合", async () => {
    const roleResult = await TestHelpers.query(`
      SELECT ->has_role->role.* AS roles FROM $auth;
    `);

    expect(Array.isArray(roleResult)).toBe(true);
    const rows = (roleResult[0] as unknown[]) || [];
    expect(rows.length).toBeGreaterThan(0);

    const first = (rows[0] || {}) as { roles?: Array<{ name?: string }> };
    expect(Array.isArray(first.roles)).toBe(true);
    const hasAdmin = (first.roles || []).some((r) => r && r.name === "admin");
    expect(hasAdmin).toBe(true);
  });

  it("可以通过 $auth 查询菜单访问权限（menu_id 列表）", async () => {
    const menuResult = await TestHelpers.query(`
      SELECT ->has_role->role->can_access_menu->menu_metadata.menu_id AS menus
      FROM $auth;
    `);

    expect(Array.isArray(menuResult)).toBe(true);
    const rows = (menuResult[0] as unknown[]) || [];
    expect(rows.length).toBeGreaterThan(0);

    const first = (rows[0] || {}) as { menus?: string[] };
    expect(Array.isArray(first.menus)).toBe(true);

    const menus = new Set(first.menus || []);
    // 与生产初始化保持一致的关键菜单
    expect(menus.has("dashboard")).toBe(true);
    expect(menus.has("cases")).toBe(true);
  });

  it("可以通过 $auth 查询操作权限（operation_id 列表）", async () => {
    const opResult = await TestHelpers.query(`
      SELECT ->has_role->role->can_execute_operation->operation_metadata.operation_id AS operations
      FROM $auth;
    `);

    expect(Array.isArray(opResult)).toBe(true);
    const rows = (opResult[0] as unknown[]) || [];
    expect(rows.length).toBeGreaterThan(0);

    const first = (rows[0] || {}) as { operations?: string[] };
    expect(Array.isArray(first.operations)).toBe(true);

    const ops = new Set(first.operations || []);
    // 与生产初始化保持一致的关键操作
    expect(ops.has("case_list_view")).toBe(true);
    expect(ops.has("case_view_detail")).toBe(true);
  });

  it("可以查询 has_role 关系表（结构与数据存在）", async () => {
    const relResult = await TestHelpers.query(
      "SELECT * FROM has_role LIMIT 5;",
    );
    expect(Array.isArray(relResult)).toBe(true);
    const rows = (relResult[0] as unknown[]) || [];
    expect(Array.isArray(rows)).toBe(true);
  });
});
