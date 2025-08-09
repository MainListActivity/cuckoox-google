/**
 * 调试参数设置的专用测试（重写版）
 * 去除对 $auth/DEFINE PARAM 的依赖，基于登录与参数化构造记录ID的测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TestHelpers, TEST_IDS } from "./utils/realSurrealTestUtils";

describe("SurrealDB参数设置调试（基于登录与参数化记录ID）", () => {
  beforeEach(async () => {
    await TestHelpers.resetDatabase();
    // 统一使用管理员登录，确保具备查询/更新权限（完全仿真生产权限）
    await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);
  });

  it("应该支持使用查询参数构造记录ID并查询用户", async () => {
    // 使用查询参数传入表名与主键，并在查询中用 type::thing 构造记录ID
    const result = await TestHelpers.query(
      `
      SELECT * FROM type::thing($tb, $id);
    `,
      { tb: "user", id: "admin" },
    );

    // 期望返回集合，并且第一条记录是 user:admin
    expect(Array.isArray(result)).toBe(true);
    const rows = (result[0] as unknown[]) || [];
    expect(rows.length).toBeGreaterThan(0);
    const first = rows[0] as { id: { toString: () => string } };
    expect(first.id.toString()).toBe("user:admin");
  });

  it("应该支持 LET + type::thing 组合使用参数，查询用户的角色关系", async () => {
    const result = await TestHelpers.query(
      `
      LET $user = type::thing($tb, $id);
      SELECT ->has_role->role.* AS roles FROM $user;
    `,
      { tb: "user", id: "admin" },
    );

    // 结果应包含两条：LET 的结果（一般为 null）与 SELECT 的结果
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(2);

    const selectRows = (result[1] as unknown[]) || [];
    expect(selectRows.length).toBeGreaterThan(0);

    const row = selectRows[0] as { roles: Array<{ name: string }> };
    expect(Array.isArray(row.roles)).toBe(true);
    const hasAdminRole = row.roles.some((r) => r.name === "admin");
    expect(hasAdminRole).toBe(true);
  });

  it("应该支持在多语句中复用参数并进行条件查询", async () => {
    const result = await TestHelpers.query(
      `
      LET $u = type::thing($tb, $id);
      LET $case = type::thing('case', 'test_case_1');
      SELECT * FROM has_role WHERE in = $u;
      SELECT * FROM case WHERE id = $case;
    `,
      { tb: "user", id: "admin" },
    );

    expect(Array.isArray(result)).toBe(true);
    // 预期至少包含3个结果：LET、LET、SELECT、SELECT
    expect(result.length).toBeGreaterThanOrEqual(4);

    const roleRows = (result[2] as unknown[]) || [];
    const caseRows = (result[3] as unknown[]) || [];

    // has_role 应至少有一条（admin -> admin）
    expect(roleRows.length).toBeGreaterThan(0);
    // case:test_case_1 应该存在（由测试数据注入）
    expect(caseRows.length).toBe(1);
  });

  it("应该支持使用 type::thing 对记录进行更新并验证（权限基于登录态）", async () => {
    // 更新 user:test_user 的 name 字段
    const updateRes = await TestHelpers.query(
      `
      UPDATE type::thing('user', 'test_user') SET name = '测试用户X' RETURN AFTER;
    `,
    );
    expect(Array.isArray(updateRes)).toBe(true);
    const updatedRows = (updateRes[0] as unknown[]) || [];
    expect(updatedRows.length).toBeGreaterThan(0);
    const updated = updatedRows[0] as { name: string };
    expect(updated.name).toBe("测试用户X");

    // 再次查询验证
    const verify = await TestHelpers.query(
      `
      SELECT * FROM type::thing('user', 'test_user');
    `,
    );
    const verifyRows = (verify[0] as unknown[]) || [];
    expect(verifyRows.length).toBe(1);
    const row = verifyRows[0] as { name: string };
    expect(row.name).toBe("测试用户X");
  });

  it("应该支持参数用于关系查询（不依赖 $auth）", async () => {
    const result = await TestHelpers.query(
      `
      LET $id = type::thing('user', 'admin');
      SELECT ->has_role->role.* AS roles FROM $id;
    `,
    );
    expect(Array.isArray(result)).toBe(true);
    const rolesRows = (result[1] as unknown[]) || [];
    expect(rolesRows.length).toBeGreaterThan(0);
    const row = rolesRows[0] as { roles: Array<{ name: string }> };
    expect(Array.isArray(row.roles)).toBe(true);
  });
});
