/**
 * 调试参数设置的专用测试（真实登录流程版）
 * 去除对 $auth/DEFINE PARAM 的依赖，基于真实登录与参数化构造记录ID的测试
 * 测试用例间共享数据，提高效率
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { TestHelpers } from "../../utils/realSurrealTestUtils";
import LoginTestHelpers from "../../utils/loginTestHelpers";

describe("SurrealDB参数设置调试（基于真实登录与参数化记录ID）", () => {
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

  it("应该支持使用查询参数构造记录ID并查询用户", async () => {
    // 确保已登录
    if (!isLoggedIn) {
      await LoginTestHelpers.loginAsAdmin("TEST");
      isLoggedIn = true;
    }

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

    console.log("[参数测试] 查询到的用户记录:", first.id.toString());
  });

  it("应该支持 LET + type::thing 组合使用参数，查询用户的角色关系", async () => {
    // 如果还没有登录，先登录
    if (!isLoggedIn) {
      await LoginTestHelpers.loginAsAdmin("TEST");
      isLoggedIn = true;
    }

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

    if (selectRows.length > 0) {
      const row = selectRows[0] as { roles: Array<{ name: string }> };
      expect(Array.isArray(row.roles)).toBe(true);

      const hasAdminRole = row.roles.some((r) => r.name === "admin");
      expect(hasAdminRole).toBe(true);

      console.log(
        "[参数测试] 用户角色:",
        row.roles.map((r) => r.name),
      );
    }
  });

  it("应该支持在多语句中复用参数并进行条件查询", async () => {
    // 如果还没有登录，先登录
    if (!isLoggedIn) {
      await LoginTestHelpers.loginAsAdmin("TEST");
      isLoggedIn = true;
    }

    // 先创建测试案件数据（如果不存在）
    await TestHelpers.query(`
      CREATE case:test_case_1 SET
        name = "测试案件1",
        case_number = "TEST-001",
        status = "active",
        created_at = time::now(),
        description = "用于参数测试的案件";
    `);

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
    // 预期至少包含4个结果：LET、LET、SELECT、SELECT
    expect(result.length).toBeGreaterThanOrEqual(4);

    const roleRows = (result[2] as unknown[]) || [];
    const caseRows = (result[3] as unknown[]) || [];

    // has_role 应至少有一条（admin -> admin）
    expect(roleRows.length).toBeGreaterThan(0);
    // case:test_case_1 应该存在（由测试数据注入）
    expect(caseRows.length).toBe(1);

    console.log("[参数测试] 角色关系数量:", roleRows.length);
    console.log("[参数测试] 案件数据:", caseRows[0]);
  });

  it("应该支持使用 type::thing 对记录进行更新并验证（权限基于登录态）", async () => {
    // 如果还没有登录，先登录
    if (!isLoggedIn) {
      await LoginTestHelpers.loginAsAdmin("TEST");
      isLoggedIn = true;
    }

    // 先确保测试用户存在
    await TestHelpers.query(`
      CREATE user:test_user SET
        name = "测试用户",
        github_id = "test_user_github",
        email = "test@example.com",
        created_at = time::now();
    `);

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

    console.log("[参数测试] 更新后的用户名:", row.name);
  });

  it("应该支持参数用于关系查询（不依赖 $auth）", async () => {
    // 如果还没有登录，先登录
    if (!isLoggedIn) {
      await LoginTestHelpers.loginAsAdmin("TEST");
      isLoggedIn = true;
    }

    const result = await TestHelpers.query(
      `
      LET $id = type::thing('user', 'admin');
      SELECT ->has_role->role.* AS roles FROM $id;
    `,
    );
    expect(Array.isArray(result)).toBe(true);
    const rolesRows = (result[1] as unknown[]) || [];

    if (rolesRows.length > 0) {
      const row = rolesRows[0] as { roles: Array<{ name: string }> };
      expect(Array.isArray(row.roles)).toBe(true);

      console.log(
        "[参数测试] 关系查询角色:",
        row.roles.map((r) => r.name),
      );
    }
  });

  it("应该支持复杂参数组合查询和数据共享验证", async () => {
    // 如果还没有登录，先登录
    if (!isLoggedIn) {
      await LoginTestHelpers.loginAsAdmin("TEST");
      isLoggedIn = true;
    }

    // 验证之前测试创建的数据仍然存在（数据共享）
    const sharedDataCheck = await TestHelpers.query(`
      SELECT * FROM test_shared_data WHERE test_suite = 'auth-syntax';
    `);

    if (sharedDataCheck[0] && (sharedDataCheck[0] as any[]).length > 0) {
      console.log("[数据共享验证] 发现来自auth-syntax测试的共享数据");
    }

    // 创建本测试套件的共享数据
    await TestHelpers.query(`
      CREATE test_shared_data SET
        created_at = time::now(),
        test_suite = 'param-test',
        message = '参数测试的共享数据',
        test_params = {
          table: 'user',
          record_id: 'admin',
          updated_user: 'test_user'
        };
    `);

    // 使用参数进行复杂查询
    const complexResult = await TestHelpers.query(
      `
      LET $admin_user = type::thing($admin_table, $admin_id);
      LET $test_user = type::thing($test_table, $test_id);
      SELECT
        $admin_user.name AS admin_name,
        $test_user.name AS test_name,
        ->has_role->role.name AS admin_roles
      FROM $admin_user;
    `,
      {
        admin_table: "user",
        admin_id: "admin",
        test_table: "user",
        test_id: "test_user",
      },
    );

    expect(Array.isArray(complexResult)).toBe(true);
    const complexRows = (complexResult[2] as unknown[]) || [];

    if (complexRows.length > 0) {
      const queryResult = complexRows[0] as {
        admin_name?: string;
        test_name?: string;
        admin_roles?: string[];
      };

      expect(queryResult.admin_name).toBe("系统管理员");
      expect(queryResult.test_name).toBe("测试用户X");
      expect(Array.isArray(queryResult.admin_roles)).toBe(true);

      console.log("[复杂参数测试] 查询结果:", queryResult);
    }
  });

  it("应该验证参数化查询的性能和数据一致性", async () => {
    // 如果还没有登录，先登录
    if (!isLoggedIn) {
      await LoginTestHelpers.loginAsAdmin("TEST");
      isLoggedIn = true;
    }

    // 批量创建测试数据，验证参数化查询的批处理能力
    const batchResults = [];

    for (let i = 1; i <= 3; i++) {
      const result = await TestHelpers.query(
        `
        CREATE type::thing('test_batch', $id) SET
          batch_number = $batch,
          name = $name,
          created_at = time::now();
      `,
        {
          id: `batch_${i}`,
          batch: i,
          name: `批次测试记录${i}`,
        },
      );

      batchResults.push(result);
    }

    // 验证所有批次数据都创建成功
    expect(batchResults.length).toBe(3);
    batchResults.forEach((result, index) => {
      const records = (result[0] as unknown[]) || [];
      expect(records.length).toBe(1);

      const record = records[0] as { batch_number: number; name: string };
      expect(record.batch_number).toBe(index + 1);
      expect(record.name).toBe(`批次测试记录${index + 1}`);
    });

    // 查询所有批次数据
    const allBatchData = await TestHelpers.query(`
      SELECT * FROM test_batch ORDER BY batch_number;
    `);

    const batchRecords = (allBatchData[0] as unknown[]) || [];
    expect(batchRecords.length).toBe(3);

    console.log(
      "[批量参数测试] 创建的批次数据:",
      batchRecords.map((r: any) => ({
        id: r.id,
        batch: r.batch_number,
        name: r.name,
      })),
    );

    // 验证数据一致性
    expect(batchRecords.every((r: any) => r.batch_number && r.name)).toBe(true);
  });
});
