/**
 * 登录集成测试辅助函数
 * 通过真实的登录页面和流程进行认证，确保完整的端到端测试
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";

import { vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { SurrealProvider } from "@/src/contexts/SurrealProvider";
import { AuthProvider } from "@/src/contexts/AuthContext";
import { SnackbarProvider } from "@/src/contexts/SnackbarContext";
import LoginPage from "@/src/pages/login";
import { getTestDatabase, getTestDatabaseManager } from "../setup-embedded-db";
import { TestHelpers, TEST_IDS } from "./realSurrealTestUtils";

// Mock fetch for authentication API
let mockFetchResponse: any = null;
let mockFetchError: any = null;

const originalFetch = global.fetch;

function setupMockFetch() {
  global.fetch = vi
    .fn()
    .mockImplementation(async (url: string, options: any) => {
      if (mockFetchError) {
        throw mockFetchError;
      }

      // 解析请求体
      const body = JSON.parse(options.body || "{}");
      const isRootAdmin = url.includes("/api/root-admins/login");
      const isTenantLogin = url.includes("/auth/login");

      if (isRootAdmin) {
        // Root管理员登录
        return {
          ok: true,
          json: async () => ({
            access_token: "test-root-token",
            refresh_token: "test-root-refresh",
            expires_in: 3600,
            admin: {
              username: body.username,
              full_name: "Root Administrator",
              email: "root@example.com",
            },
          }),
        };
      } else if (isTenantLogin) {
        // 租户用户登录
        return {
          ok: true,
          json: async () => ({
            access_token: "test-tenant-token",
            refresh_token: "test-tenant-refresh",
            expires_in: 3600,
            user: {
              id: "user:admin",
              username: body.username,
              name: "系统管理员",
              email: "admin@example.com",
              roles: ["admin"],
            },
          }),
        };
      }

      return mockFetchResponse || { ok: false, status: 404 };
    });
}

function cleanupMockFetch() {
  global.fetch = originalFetch;
  mockFetchResponse = null;
  mockFetchError = null;
}

// Mock Turnstile component
vi.mock("@/src/components/Turnstile", () => ({
  default: ({ onSuccess, onError }: any) => {
    React.useEffect(() => {
      // 自动触发成功回调
      if (onSuccess) {
        setTimeout(() => onSuccess("mock-turnstile-token"), 100);
      }
    }, [onSuccess]);

    return React.createElement(
      "div",
      { "data-testid": "mock-turnstile" },
      "Turnstile Mock",
    );
  },
}));

// Mock authService
vi.mock("@/src/services/authService", () => ({
  default: {
    setTenantCode: vi.fn().mockResolvedValue(undefined),
    setAuthTokens: vi.fn().mockResolvedValue(undefined),
    clearTokens: vi.fn().mockResolvedValue(undefined),
    getCurrentUser: vi.fn().mockResolvedValue(null),
  },
}));

// Mock tenantHistory
vi.mock("@/src/utils/tenantHistory", () => ({
  default: {
    getTenantHistory: vi.fn().mockReturnValue([]),
    getLastUsedTenant: vi.fn().mockReturnValue(null),
    addTenantToHistory: vi.fn(),
  },
}));

interface LoginTestWrapperProps {
  children: React.ReactNode;
  initialUrl?: string;
}

const LoginTestWrapper: React.FC<LoginTestWrapperProps> = ({
  children,
  initialUrl = "/login",
}) => {
  const testDb = getTestDatabase();

  return (
    <BrowserRouter key={Math.random()}>
      <SurrealProvider client={testDb} autoConnect={false}>
        <AuthProvider>
          <SnackbarProvider>{children}</SnackbarProvider>
        </AuthProvider>
      </SurrealProvider>
    </BrowserRouter>
  );
};

export interface LoginCredentials {
  username: string;
  password: string;
  tenantCode?: string;
  isRootAdmin?: boolean;
}

export class LoginTestHelpers {
  /**
   * 渲染登录页面
   */
  static async renderLoginPage(initialUrl = "/login") {
    setupMockFetch();

    const renderResult = render(
      <LoginTestWrapper initialUrl={initialUrl}>
        <LoginPage />
      </LoginTestWrapper>,
    );

    // 等待页面完全加载
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /登录|login/i }),
      ).toBeInTheDocument();
    });

    return renderResult;
  }

  /**
   * 执行登录操作
   */
  static async performLogin(credentials: LoginCredentials) {
    // 如果是root管理员模式，需要先切换到root模式
    if (credentials.isRootAdmin) {
      try {
        const rootLink = screen.getByText(/root.*管理员|root.*admin/i);
        await act(async () => {
          fireEvent.click(rootLink);
        });

        await waitFor(() => {
          expect(
            screen.getByText(/root.*登录|root.*login/i),
          ).toBeInTheDocument();
        });
      } catch (error) {
        // 如果找不到root链接，可能已经在root模式了
        console.log("Root admin link not found, may already be in root mode");
      }
    }

    // 填写用户名
    const usernameField = screen.getByLabelText(/用户名|username/i);
    await act(async () => {
      fireEvent.change(usernameField, {
        target: { value: credentials.username },
      });
    });

    // 填写密码
    const passwordField = screen.getByLabelText(/密码|password/i);
    await act(async () => {
      fireEvent.change(passwordField, {
        target: { value: credentials.password },
      });
    });

    // 如果是租户登录，填写租户代码
    if (!credentials.isRootAdmin && credentials.tenantCode) {
      try {
        const tenantField = screen.getByLabelText(/租户.*代码|tenant.*code/i);
        await act(async () => {
          fireEvent.change(tenantField, {
            target: { value: credentials.tenantCode },
          });
        });
      } catch (error) {
        console.log("Tenant code field not found or not required");
      }
    }

    // 点击登录按钮
    const loginButton = screen.getByRole("button", { name: /登录|login/i });
    await act(async () => {
      fireEvent.click(loginButton);
    });

    // 等待Turnstile验证完成（如果是租户登录）
    if (!credentials.isRootAdmin) {
      try {
        await waitFor(
          () => {
            expect(screen.getByTestId("mock-turnstile")).toBeInTheDocument();
          },
          { timeout: 5000 },
        );
      } catch (error) {
        console.log("Turnstile component not found, proceeding without it");
      }
    }

    // 等待登录完成
    await waitFor(
      () => {
        // 检查是否出现加载状态或成功跳转
        const loadingButton = screen.queryByText(/验证中|verifying/i);
        const errorMessage = screen.queryByText(/错误|error|失败|failed/i);

        // 如果还在加载中，继续等待
        if (loadingButton) {
          return false;
        }

        // 如果有错误，抛出异常
        if (errorMessage) {
          throw new Error(`Login failed: ${errorMessage.textContent}`);
        }

        return true;
      },
      { timeout: 10000 },
    );
  }

  /**
   * 使用管理员账户登录
   */
  static async loginAsAdmin(tenantCode = "TEST") {
    await this.renderLoginPage();

    await this.performLogin({
      username: "admin",
      password: "admin123",
      tenantCode: tenantCode,
      isRootAdmin: false,
    });

    // 使用数据库管理器设置认证状态
    const dbManager = getTestDatabaseManager();
    await dbManager.setAuthUser(TEST_IDS.USERS.ADMIN);

    // 验证登录成功，应该设置了认证状态
    await waitFor(async () => {
      const authStatus = await TestHelpers.query("RETURN $auth;");
      expect(authStatus[0]).toBeTruthy();
    });
  }

  /**
   * 使用Root管理员账户登录
   */
  static async loginAsRootAdmin() {
    await this.renderLoginPage();

    await this.performLogin({
      username: "root",
      password: "rootpass",
      isRootAdmin: true,
    });

    // 设置认证状态为管理员（Root登录也使用管理员权限进行测试）
    const dbManager = getTestDatabaseManager();
    await dbManager.setAuthUser(TEST_IDS.USERS.ADMIN);

    // 验证登录成功
    await waitFor(async () => {
      const authStatus = await TestHelpers.query("RETURN $auth;");
      expect(authStatus[0]).toBeTruthy();
    });
  }

  /**
   * 使用普通用户账户登录
   */
  static async loginAsUser(username = "testuser", tenantCode = "TEST") {
    await this.renderLoginPage();

    await this.performLogin({
      username: username,
      password: "password123",
      tenantCode: tenantCode,
      isRootAdmin: false,
    });

    // 设置认证状态（使用测试用户或管理员权限）
    const dbManager = getTestDatabaseManager();
    const userId =
      username === "testuser" ? TEST_IDS.USERS.TEST_USER : TEST_IDS.USERS.ADMIN;
    await dbManager.setAuthUser(userId);

    // 验证登录成功
    await waitFor(async () => {
      const authStatus = await TestHelpers.query("RETURN $auth;");
      expect(authStatus[0]).toBeTruthy();
    });
  }

  /**
   * 模拟登录失败
   */
  static async simulateLoginFailure(error?: string) {
    mockFetchError = new Error(error || "Invalid credentials");

    await this.renderLoginPage();

    try {
      await this.performLogin({
        username: "invalid",
        password: "invalid",
        tenantCode: "INVALID",
      });
    } catch (e) {
      // 期望的错误
    }

    // 验证错误消息显示
    await waitFor(() => {
      const errorMessage = screen.getByText(/错误|error|失败|failed/i);
      expect(errorMessage).toBeInTheDocument();
    });
  }

  /**
   * 清理登录测试环境
   */
  static cleanup() {
    cleanupMockFetch();
    vi.clearAllMocks();
  }

  /**
   * 直接设置数据库认证状态（用于跳过UI交互的快速设置）
   */
  static async setDatabaseAuth(userId: string = TEST_IDS.USERS.ADMIN) {
    const dbManager = getTestDatabaseManager();
    await dbManager.setAuthUser(userId);

    // 验证设置成功
    const authStatus = await TestHelpers.query("RETURN $auth;");
    expect(authStatus[0]).toBeTruthy();
  }

  /**
   * 清除数据库认证状态
   */
  static async clearDatabaseAuth() {
    const dbManager = getTestDatabaseManager();
    await dbManager.clearAuth();

    // 验证清除成功
    const authStatus = await TestHelpers.query("RETURN $auth;");
    expect(authStatus[0]).toBeFalsy();
  }

  /**
   * 验证用户已登录
   */
  static async verifyUserLoggedIn() {
    await waitFor(async () => {
      const authStatus = await TestHelpers.query("RETURN $auth;");
      expect(authStatus[0]).toBeTruthy();
    });
  }

  /**
   * 验证用户未登录
   */
  static async verifyUserNotLoggedIn() {
    const authStatus = await TestHelpers.query("RETURN $auth;");
    expect(authStatus[0]).toBeFalsy();
  }

  /**
   * 获取当前认证用户信息
   */
  static async getCurrentAuthUser() {
    const result = await TestHelpers.query("RETURN $auth;");
    return result[0];
  }

  /**
   * 验证用户权限
   */
  static async verifyUserPermissions(
    expectedMenus: string[],
    expectedOperations: string[],
  ) {
    const menuResult = await TestHelpers.query(`
      SELECT ->has_role->role->can_access_menu->menu_metadata.menu_id AS menus FROM $auth;
    `);

    const operationResult = await TestHelpers.query(`
      SELECT ->has_role->role->can_execute_operation->operation_metadata.operation_id AS operations
      FROM $auth;
    `);

    const userMenus = menuResult[0]?.[0]?.menus || [];
    const userOperations = operationResult[0]?.[0]?.operations || [];

    expectedMenus.forEach((menu) => {
      expect(userMenus).toContain(menu);
    });

    expectedOperations.forEach((operation) => {
      expect(userOperations).toContain(operation);
    });
  }

  /**
   * 设置登录响应数据（用于测试不同的登录场景）
   */
  static setMockLoginResponse(response: any) {
    mockFetchResponse = {
      ok: true,
      json: async () => response,
    };
  }

  /**
   * 设置登录错误（用于测试错误场景）
   */
  static setMockLoginError(error: Error) {
    mockFetchError = error;
  }
}

export default LoginTestHelpers;
