/**
 * 认证语法调试（基于登录与 $auth 的只读查询）
 * 目标：
 * - 仅通过登录获取认证态，使用 $auth 做只读查询
 * - 不使用 $auth.id（避免不同引擎/版本上的解析差异）
 * - 不尝试给 $auth 赋值（受保护变量）
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TestHelpers, TEST_IDS } from "./utils/realSurrealTestUtils";

describe("认证语法调试（基于登录与 $auth 的只读查询）", () => {
  beforeEach(async () => {
    // 每个用例前重置数据库并以管理员登录，确保具备足够权限
    await TestHelpers.resetDatabase();
    await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);
  });

  it("应该返回 $auth 基本信息", async () => {
    const result = await TestHelpers.query("RETURN $auth;");
    // Surreal 返回值为多结果集数组：这里仅有一个 RETURN 结果
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).not.toBeNull();
    // 不强依赖具体结构，仅断言存在值
    // 某些版本可能返回对象/记录ID，保持宽松检查
  });

  it("应该能够通过 $auth 查询当前用户的角色集合", async () => {
    const roleResult = await TestHelpers.query(`
      SELECT ->has_role->role.* AS roles FROM $auth;
    `);

    // 结果集数组，第一个为 SELECT 结果（数组）
    expect(Array.isArray(roleResult)).toBe(true);
    const rows = (roleResult[0] as unknown[]) || [];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);

    const first = (rows[0] || {}) as { roles?: Array<{ name?: string }> };
    expect(Array.isArray(first.roles)).toBe(true);
    // 管理员应包含 admin 角色
    const hasAdmin = (first.roles || []).some((r) => r && r.name === "admin");
    expect(hasAdmin).toBe(true);
  });

  it("应该能够通过 $auth 查询当前用户的菜单访问权限（menu_id 列表）", async () => {
    // 注意：生产 schema 中 menu_metadata 字段为 menu_id/label_key 等，这里查询 menu_id 以获得字符串数组
    const menuResult = await TestHelpers.query(`
      SELECT ->has_role->role->can_access_menu->menu_metadata.menu_id AS menus FROM $auth;
    `);

    expect(Array.isArray(menuResult)).toBe(true);
    const rows = (menuResult[0] as unknown[]) || [];
    expect(rows.length).toBeGreaterThan(0);

    const first = (rows[0] || {}) as { menus?: string[] };
    expect(Array.isArray(first.menus)).toBe(true);

    // 断言一些关键菜单存在（与 src/lib/surreal_schemas.surql 初始化保持一致）
    const menus = new Set(first.menus || []);
    expect(menus.has("dashboard")).toBe(true);
    expect(menus.has("cases")).toBe(true);
  });

  it("应该能够通过 $auth 查询当前用户的操作权限（operation_id 列表）", async () => {
    const opResult = await TestHelpers.query(`
      SELECT ->has_role->role->can_execute_operation->operation_metadata.operation_id AS operations
      FROM $auth;
    `);

    expect(Array.isArray(opResult)).toBe(true);
    const rows = (opResult[0] as unknown[]) || [];
    expect(rows.length).toBeGreaterThan(0);

    const first = (rows[0] || {}) as { operations?: string[] };
    expect(Array.isArray(first.operations)).toBe(true);

    // 断言一些关键操作存在（与 src/lib/surreal_schemas.surql 初始化保持一致）
    const ops = new Set(first.operations || []);
    expect(ops.has("case_list_view")).toBe(true);
    expect(ops.has("case_view_detail")).toBe(true);
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

  it("在 $auth 只读前提下，仍可进行一般 SELECT 查询（不依赖 $auth.id）", async () => {
    // 直接查询固定记录，避免使用 $auth.id
    const res = await TestHelpers.query(`SELECT * FROM user:admin;`);
    expect(Array.isArray(res)).toBe(true);
    const rows = (res[0] as unknown[]) || [];
    expect(rows.length).toBe(1);
  });
});
