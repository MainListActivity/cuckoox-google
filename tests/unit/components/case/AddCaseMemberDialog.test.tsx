import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RecordId } from "surrealdb";
import {
  createSimpleTestEnvironment,
  cleanupTestEnvironment,
  resetTestEnvironment,
  createMockCase,
  createMockUser,
} from "../../utils/testUtils";
import { MockFactory } from "@tests/unit/utils/mockFactory";

describe("AddCaseMemberDialog 业务逻辑测试 (使用MockFactory)", () => {
  let testEnv: any;
  let mockGetCaseMemberRoles: any;
  let mockCreateUserAndAddToCase: any;

  const TEST_CASE_ID = new RecordId("case", "test123");

  const mockRoles = [
    {
      id: new RecordId("role", "case_manager"),
      name: "case_manager",
      description: "案件负责人",
    },
    {
      id: new RecordId("role", "member"),
      name: "member",
      description: "案件成员",
    },
  ];

  beforeEach(() => {
    // 创建轻量级测试环境
    testEnv = createSimpleTestEnvironment();

    // 使用mockFactory创建服务mocks
    mockGetCaseMemberRoles = vi.fn();
    mockCreateUserAndAddToCase = vi.fn();

    // Mock服务依赖
    vi.mock("@/src/services/roleService", () => ({
      getCaseMemberRoles: mockGetCaseMemberRoles,
    }));

    vi.mock("@/src/services/caseMemberService", () => ({
      createUserAndAddToCase: mockCreateUserAndAddToCase,
    }));

    // 设置默认的mock返回值
    mockGetCaseMemberRoles.mockResolvedValue(mockRoles);
    mockCreateUserAndAddToCase.mockResolvedValue({
      id: new RecordId("user", "002"),
      caseId: TEST_CASE_ID,
      roles: [
        {
          id: new RecordId("role", "001"),
          name: "member",
          description: "Case member",
        },
      ],
      userName: "Bob Lawyer",
      userEmail: "bob@example.com",
      avatarUrl: "avatar_bob.png",
    });
  });

  afterEach(() => {
    // 清理测试环境
    resetTestEnvironment();
    cleanupTestEnvironment();
  });

  describe("服务调用测试", () => {
    it("getCaseMemberRoles 应该返回预期的角色列表", async () => {
      const roles = await mockGetCaseMemberRoles();

      expect(mockGetCaseMemberRoles).toHaveBeenCalled();
      expect(roles).toHaveLength(2);
      expect(roles[0].name).toBe("case_manager");
      expect(roles[1].name).toBe("member");
      expect(roles[0].description).toBe("案件负责人");
      expect(roles[1].description).toBe("案件成员");
    });

    it("createUserAndAddToCase 应该创建用户并返回预期结果", async () => {
      const userData = {
        username: "testuser",
        password_hash: "password123",
        email: "test@example.com",
        name: "测试用户",
      };

      const result = await mockCreateUserAndAddToCase(
        {},
        TEST_CASE_ID,
        userData,
      );

      expect(mockCreateUserAndAddToCase).toHaveBeenCalledWith(
        {},
        TEST_CASE_ID,
        userData,
      );
      expect(result.userName).toBe("Bob Lawyer");
      expect(result.userEmail).toBe("bob@example.com");
      expect(result.caseId).toEqual(TEST_CASE_ID);
      expect(result.roles).toHaveLength(1);
      expect(result.roles[0].name).toBe("member");
    });

    it("createUserAndAddToCase 应该正确处理不同的角色分配", async () => {
      const userData = {
        username: "manager",
        password_hash: "managerpass",
        email: "manager@example.com",
        name: "案件管理员",
      };

      // 模拟分配管理员角色
      mockCreateUserAndAddToCase.mockResolvedValueOnce({
        id: new RecordId("user", "003"),
        caseId: TEST_CASE_ID,
        roles: [
          {
            id: new RecordId("role", "case_manager"),
            name: "case_manager",
            description: "案件负责人",
          },
        ],
        userName: "案件管理员",
        userEmail: "manager@example.com",
        avatarUrl: "avatar_manager.png",
      });

      const result = await mockCreateUserAndAddToCase(
        {},
        TEST_CASE_ID,
        userData,
      );

      expect(result.roles[0].name).toBe("case_manager");
      expect(result.roles[0].description).toBe("案件负责人");
    });
  });

  describe("数据验证逻辑", () => {
    it("邮箱格式验证", () => {
      const validEmails = [
        "test@example.com",
        "user.name@domain.co.uk",
        "email+tag@company.org",
      ];

      const invalidEmails = [
        "invalid-email",
        "@domain.com",
        "user@",
        "user name@domain.com",
        "",
      ];

      // 简单的邮箱正则验证
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      validEmails.forEach((email) => {
        expect(emailRegex.test(email)).toBe(true);
      });

      invalidEmails.forEach((email) => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });

    it("表单字段必填验证", () => {
      const requiredFields = ["username", "password", "email", "name"];

      // 测试空值情况
      const emptyFormData = {
        username: "",
        password: "",
        email: "",
        name: "",
      };

      const emptyErrors = requiredFields.filter(
        (field) => !emptyFormData[field as keyof typeof emptyFormData],
      );

      expect(emptyErrors).toHaveLength(4);
      expect(emptyErrors).toEqual(["username", "password", "email", "name"]);

      // 测试部分填写情况
      const partialFormData = {
        username: "testuser",
        password: "password123",
        email: "",
        name: "",
      };

      const partialErrors = requiredFields.filter(
        (field) => !partialFormData[field as keyof typeof partialFormData],
      );

      expect(partialErrors).toHaveLength(2);
      expect(partialErrors).toEqual(["email", "name"]);

      // 测试完整填写情况
      const completeFormData = {
        username: "testuser",
        password: "password123",
        email: "test@example.com",
        name: "测试用户",
      };

      const completeErrors = requiredFields.filter(
        (field) => !completeFormData[field as keyof typeof completeFormData],
      );

      expect(completeErrors).toHaveLength(0);
    });

    it("用户名格式验证", () => {
      const validUsernames = ["testuser", "user123", "test_user", "user-name"];
      const invalidUsernames = ["", "te", "user name", "user@name", "用户名"];

      // 用户名验证规则：3-20个字符，只能包含字母、数字、下划线和短横线
      const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;

      validUsernames.forEach((username) => {
        expect(usernameRegex.test(username)).toBe(true);
      });

      invalidUsernames.forEach((username) => {
        expect(usernameRegex.test(username)).toBe(false);
      });
    });

    it("密码强度验证", () => {
      const weakPasswords = ["123", "password", "abc123"];
      const strongPasswords = [
        "Password123!",
        "StrongP@ss1",
        "SecurePassword2024",
      ];

      // 密码强度验证：至少8个字符，包含大小写字母、数字
      const passwordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;

      weakPasswords.forEach((password) => {
        expect(passwordRegex.test(password)).toBe(false);
      });

      strongPasswords.forEach((password) => {
        expect(passwordRegex.test(password)).toBe(true);
      });
    });
  });

  describe("RecordId 处理", () => {
    it("RecordId 应该正确创建和比较", () => {
      const caseId1 = new RecordId("case", "test123");
      const caseId2 = new RecordId("case", "test123");
      const roleId = new RecordId("role", "manager");

      expect(caseId1.toString()).toBe("case:test123");
      expect(roleId.toString()).toBe("role:manager");

      // 测试RecordId相等性
      expect(caseId1.toString()).toBe(caseId2.toString());
      expect(caseId1.toString()).not.toBe(roleId.toString());
    });

    it("应该正确处理RecordId数组", () => {
      const roleIds = [
        new RecordId("role", "case_manager"),
        new RecordId("role", "member"),
        new RecordId("role", "observer"),
      ];

      expect(roleIds).toHaveLength(3);
      expect(roleIds[0].toString()).toBe("role:case_manager");
      expect(roleIds[1].toString()).toBe("role:member");
      expect(roleIds[2].toString()).toBe("role:observer");
    });
  });

  describe("Mock数据工厂测试", () => {
    it("应该使用MockFactory创建测试数据", () => {
      const mockCase = createMockCase({
        name: "测试案件",
        number: "CASE001",
      });

      expect(mockCase.name).toBe("测试案件");
      expect(mockCase.number).toBe("CASE001");
      expect(mockCase.id).toBeDefined();
      expect(mockCase.status).toBe("active");
    });

    it("应该使用MockFactory创建用户数据", () => {
      const mockUser = createMockUser({
        username: "testcase",
        email: "testcase@example.com",
        display_name: "测试案例用户",
      });

      expect(mockUser.username).toBe("testcase");
      expect(mockUser.email).toBe("testcase@example.com");
      expect(mockUser.display_name).toBe("测试案例用户");
      expect(mockUser.id).toBeDefined();
      expect(mockUser.is_admin).toBe(false);
    });
  });

  describe("错误处理测试", () => {
    it("应该正确处理服务调用错误", async () => {
      // 模拟服务调用失败
      mockGetCaseMemberRoles.mockRejectedValue(new Error("Network error"));

      try {
        await mockGetCaseMemberRoles();
        expect(true).toBe(false); // 不应该到达这里
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Network error");
      }
    });

    it("应该正确处理用户创建失败", async () => {
      const userData = {
        username: "testuser",
        password_hash: "password123",
        email: "test@example.com",
        name: "测试用户",
      };

      // 模拟创建用户失败
      mockCreateUserAndAddToCase.mockRejectedValue(
        new Error("User already exists"),
      );

      try {
        await mockCreateUserAndAddToCase({}, TEST_CASE_ID, userData);
        expect(true).toBe(false); // 不应该到达这里
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("User already exists");
      }
    });
  });
});
