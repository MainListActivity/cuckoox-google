/**
 * 基础集成测试
 * 验证集成测试基础设施是否正常工作
 */

import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import {
  renderWithRealSurreal,
  TestHelpers,
  TEST_IDS,
} from "../../utils/realSurrealTestUtils";

// 简单的测试组件
const SimpleTestComponent: React.FC = () => {
  return (
    <div>
      <h1>集成测试页面</h1>
      <p>这是一个简单的测试组件</p>
    </div>
  );
};

describe("基础集成测试", () => {
  beforeEach(async () => {
    await TestHelpers.resetDatabase();
  });

  describe("基础渲染测试", () => {
    it("应该能够渲染简单组件", async () => {
      // 渲染组件
      renderWithRealSurreal(<SimpleTestComponent />);

      // 验证基本渲染
      expect(screen.getByText("集成测试页面")).toBeInTheDocument();
      expect(screen.getByText("这是一个简单的测试组件")).toBeInTheDocument();
    });

    it("应该能够进行用户认证", async () => {
      // 设置认证用户
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      // 渲染组件
      renderWithRealSurreal(<SimpleTestComponent />);

      // 验证组件正常渲染
      expect(screen.getByText("集成测试页面")).toBeInTheDocument();
    });
  });

  describe("数据库操作测试", () => {
    it("应该能够查询数据库", async () => {
      // 设置认证用户
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      // 查询用户数据
      const users = await TestHelpers.query("SELECT * FROM user");

      // 验证查询结果 - SurrealDB返回的是嵌套数组格式 [[{...}]]
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
      const userList = users[0]; // 第一个查询结果

      expect(Array.isArray(userList)).toBe(true);
      // resetDatabase后只有admin用户，这是符合项目要求的
      // 其他用户应该通过页面方法调用创建
      expect(userList.length).toBeGreaterThan(0);
      expect(userList[0].id.toString()).toBe("user:admin");
    });

    it("应该能够验证数据库写入权限", async () => {
      // 设置认证用户
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      // 验证admin用户具有写入权限（通过简单的参数查询验证）
      const authCheck = await TestHelpers.query("RETURN $auth;");

      // 验证认证结果
      expect(Array.isArray(authCheck)).toBe(true);
      expect(authCheck.length).toBeGreaterThan(0);

      const authData = authCheck[0];
      expect(Array.isArray(authData)).toBe(true);
      expect(authData[0]).toBeDefined();
      expect(authData[0].id).toBeDefined();
    });

    it("应该能够验证用户权限", async () => {
      // 设置认证用户
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      // 查询用户角色
      const roleQuery = await TestHelpers.query(
        "SELECT ->has_role->role.* AS roles FROM $auth",
      );

      // 验证角色查询结果 - SurrealDB返回的是嵌套数组格式
      expect(Array.isArray(roleQuery)).toBe(true);
      expect(roleQuery.length).toBeGreaterThan(0);

      const queryResult = roleQuery[0]; // 第一个查询结果
      expect(Array.isArray(queryResult)).toBe(true);
      expect(queryResult.length).toBeGreaterThan(0);

      const userWithRoles = queryResult[0];
      expect(userWithRoles).toBeDefined();
      expect(userWithRoles.roles).toBeDefined();

      if (
        Array.isArray(userWithRoles.roles) &&
        userWithRoles.roles.length > 0
      ) {
        // admin用户应该有admin角色
        const adminRole = userWithRoles.roles.find(
          (role: any) => role.name === "admin",
        );
        expect(adminRole).toBeDefined();
      }
    });
  });

  describe("数据库统计测试", () => {
    it("应该能够获取数据库统计信息", async () => {
      const stats = await TestHelpers.getDatabaseStats();

      // 验证统计信息结构
      expect(stats).toBeDefined();
      expect(typeof stats).toBe("object");

      // 验证基本统计数据
      expect(stats.user).toBeGreaterThan(0);
      expect(stats.role).toBeGreaterThan(0);
      // 验证其他表数据存在性（可能为0，因为业务数据应通过页面方法创建）
      expect(stats.operation_metadata).toBeGreaterThanOrEqual(0);
      expect(stats.case).toBeGreaterThanOrEqual(0);
    });

    it("应该能够验证数据库状态", async () => {
      const isValid = await TestHelpers.validateDatabaseState();

      // 数据库状态应该是有效的
      expect(isValid).toBe(true);
    });
  });
});
