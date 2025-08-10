/**
 * 内嵌数据库测试环境设置
 * 专门用于使用真实SurrealDB数据库的测试
 */

import "@testing-library/jest-dom";
import React from "react";
import { vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import {
  TestDatabaseManager,
  closeTestDatabase,
} from "./database/TestDatabaseManager";
import { TestDiagnostics } from "./utils/testDiagnostics";
// Service Worker测试在Node.js环境中不可用，移除相关导入
// import {
//   registerTestServiceWorker,
//   cleanupTestServiceWorker,
//   isTestServiceWorkerReady,
// } from "./test-service-worker/test-sw-registration";

// 全局数据库管理器实例
let testDbManager: TestDatabaseManager | null = null;

// 初始化内嵌数据库测试环境
beforeAll(async () => {
  console.log("🚀 正在初始化内嵌数据库测试环境...");

  try {
    // 获取测试数据库管理器单例
    testDbManager = TestDatabaseManager.getInstance();

    // 初始化数据库 - 这会创建内嵌数据库实例并加载测试数据
    await testDbManager.initialize();

    // 验证数据库状态
    const isValid = await testDbManager.validateDatabaseState();
    if (!isValid) {
      throw new Error("测试数据库初始化失败 - 数据验证不通过");
    }

    const stats = await testDbManager.getDatabaseStats();
    console.log("📊 数据库初始化完成，统计信息:", stats);

    // 运行诊断检查
    await TestDiagnostics.generateDiagnosticReport();

    // 设置全局数据库实例供测试使用
    (globalThis as any).__TEST_DATABASE__ = testDbManager.getDatabase();
    (globalThis as any).__TEST_DB_MANAGER__ = testDbManager;

    // Node.js环境中不支持Service Worker，跳过注册
    console.log("ℹ️ 跳过Service Worker注册，直接使用数据库连接");
  } catch (error) {
    console.error("❌ 测试数据库初始化失败:", error);
    throw error;
  }
}, 30000); // 30秒超时，给数据库初始化足够时间

// 清理数据库测试环境 - 只在最后一个测试文件完成时关闭
afterAll(async () => {
  console.log("🧹 正在清理内嵌数据库测试环境...");

  try {
    // 清理全局引用
    delete (globalThis as any).__TEST_DATABASE__;
    delete (globalThis as any).__TEST_DB_MANAGER__;

    // 注意：不关闭数据库连接，让它在所有测试完成后自动关闭
    // await closeTestDatabase();
    console.log("✅ 数据库测试环境清理完成");
  } catch (error) {
    console.warn("⚠️ 清理数据库环境时出现警告:", error);
  }
}, 10000); // 10秒超时

// 集成测试支持数据共享 - 不清理数据库数据
// 让测试用例创建的数据保留在数据库中，供后续测试使用

// 每个测试后只清理React组件状态和Mock，保留所有数据库数据
afterEach(async () => {
  // 清理 React Testing Library
  cleanup();

  // 清理所有 mocks 但保留数据库连接和数据
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();

  // 注意：不清理数据库数据，不调用signOut，保持数据和认证状态
}, 3000); // 3秒超时

// DOM Mock 设置
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// 基本DOM方法mock
Element.prototype.scrollIntoView = vi.fn();
// 使用 Object.defineProperty 来 mock 只读属性
Object.defineProperty(HTMLElement.prototype, "focus", {
  value: vi.fn(),
  writable: true,
  configurable: true,
});
Object.defineProperty(HTMLElement.prototype, "blur", {
  value: vi.fn(),
  writable: true,
  configurable: true,
});

// Mock createPortal
vi.mock("react-dom", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    createPortal: (children: any) => children,
  };
});

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: "zh-CN",
      changeLanguage: vi.fn().mockResolvedValue(undefined),
    },
  }),
  Trans: ({ children }: any) => children,
  I18nextProvider: ({ children }: any) => children,
  withTranslation: () => (Component: any) => Component,
  Translation: ({ children }: any) => children({ t: (key: string) => key }),
  initReactI18next: {
    type: "3rdParty",
    init: vi.fn(),
  },
}));

// Mock Service Worker 相关功能
vi.mock("@/src/contexts/SurrealProvider", () => ({
  SurrealProvider: ({ children }: { children: React.ReactNode }) => children,
  useServiceWorkerComm: () => ({
    sendMessage: vi.fn().mockImplementation((type: string, data: any) => {
      // Mock Service Worker responses
      if (type === 'get_connection_state') {
        return Promise.resolve({
          isAuthenticated: true, // 在测试中默认认证成功
          isConnected: true,
          currentUser: { id: 'user:admin', name: '系统管理员' }
        });
      }
      if (type === 'authenticate') {
        return Promise.resolve({
          success: true,
          user: { id: 'user:admin', name: '系统管理员' }
        });
      }
      return Promise.resolve({});
    }),
    isReady: true,
    worker: null
  }),
  useSurrealData: () => ({
    data: [],
    isLoading: false,
    error: null,
    refetch: vi.fn()
  }),
  useSurrealClient: () => ({
    client: {
      // Mock完整的SurrealDB客户端API，使其能够与真实数据库交互
      authenticate: vi.fn().mockImplementation(async (accessToken: string, refreshToken?: string, expiresIn?: number, tenantCode?: string) => {
        // 获取测试数据库实例并设置认证状态
        const testDbManager = (globalThis as any).__TEST_DB_MANAGER__;
        if (testDbManager) {
          await testDbManager.setAuthUser('user:admin');
        }
        return Promise.resolve({ success: true });
      }),
      invalidate: vi.fn().mockImplementation(async () => {
        // 清除认证状态
        const testDbManager = (globalThis as any).__TEST_DB_MANAGER__;
        if (testDbManager) {
          await testDbManager.clearAuth();
        }
        return Promise.resolve({ success: true });
      }),
      connect: vi.fn().mockResolvedValue({ success: true }),
      query: vi.fn().mockImplementation(async (sql: string, vars?: Record<string, any>) => {
        // 代理到真实的数据库查询
        const testDb = (globalThis as any).__TEST_DATABASE__;
        if (testDb) {
          // 特殊处理queryWithAuth的认证查询模式
          if (sql.startsWith('return $auth;') || sql.includes('return $auth;')) {
            console.log('检测到认证查询，模拟成功认证状态');
            
            // 分离认证查询和实际查询
            const actualSql = sql.replace(/^return\s+\$auth\s*;\s*/i, '').trim();
            
            // 模拟成功的认证结果（返回admin用户对象）
            const mockAuthResult = {
              id: 'user:admin',
              username: 'admin',
              name: '系统管理员',
              email: 'admin@test.com'
            };
            
            // 执行实际查询
            let actualResult;
            if (actualSql) {
              actualResult = await testDb.query(actualSql, vars);
              // 确保actualResult是数组格式
              if (!Array.isArray(actualResult)) {
                actualResult = [actualResult];
              }
              // 如果actualResult是嵌套数组，取第一层
              if (Array.isArray(actualResult[0]) && actualResult.length === 1) {
                actualResult = actualResult[0];
              }
            } else {
              actualResult = [];
            }
            
            // 返回认证查询格式：[认证结果, 实际查询结果]
            return [[mockAuthResult], actualResult];
          }
          
          // 普通查询直接执行
          return testDb.query(sql, vars);
        }
        return [];
      }),
      select: vi.fn().mockImplementation(async (recordId: any) => {
        const testDb = (globalThis as any).__TEST_DATABASE__;
        if (testDb) {
          return testDb.select(recordId);
        }
        return null;
      }),
      create: vi.fn().mockImplementation(async (table: string, data: any) => {
        const testDb = (globalThis as any).__TEST_DATABASE__;
        if (testDb) {
          return testDb.create(table, data);
        }
        return null;
      }),
      update: vi.fn().mockImplementation(async (recordId: any, data: any) => {
        const testDb = (globalThis as any).__TEST_DATABASE__;
        if (testDb) {
          return testDb.update(recordId, data);
        }
        return null;
      }),
      delete: vi.fn().mockImplementation(async (recordId: any) => {
        const testDb = (globalThis as any).__TEST_DATABASE__;
        if (testDb) {
          return testDb.delete(recordId);
        }
        return null;
      })
    },
    isConnected: true,
    connect: vi.fn().mockResolvedValue({ success: true }),
    disconnect: vi.fn().mockResolvedValue({ success: true })
  }),
  useSurreal: () => ({
    db: (globalThis as any).__TEST_DATABASE__ || null,
    isConnected: true,
    connect: vi.fn().mockResolvedValue({ success: true }),
    disconnect: vi.fn().mockResolvedValue({ success: true }),
    query: vi.fn().mockImplementation(async (sql: string, vars?: Record<string, any>) => {
      const testDb = (globalThis as any).__TEST_DATABASE__;
      if (testDb) {
        // 特殊处理queryWithAuth的认证查询模式
        if (sql.startsWith('return $auth;') || sql.includes('return $auth;')) {
          console.log('useSurreal: 检测到认证查询，模拟成功认证状态');
          
          // 分离认证查询和实际查询
          const actualSql = sql.replace(/^return\s+\$auth\s*;\s*/i, '').trim();
          
          // 模拟成功的认证结果
          const mockAuthResult = {
            id: 'user:admin',
            username: 'admin',
            name: '系统管理员',
            email: 'admin@test.com'
          };
          
          // 执行实际查询
          let actualResult;
          if (actualSql) {
            actualResult = await testDb.query(actualSql, vars);
            if (!Array.isArray(actualResult)) {
              actualResult = [actualResult];
            }
            if (Array.isArray(actualResult[0]) && actualResult.length === 1) {
              actualResult = actualResult[0];
            }
          } else {
            actualResult = [];
          }
          
          // 返回认证查询格式：[认证结果, 实际查询结果]
          return [[mockAuthResult], actualResult];
        }
        
        // 普通查询直接执行
        return testDb.query(sql, vars);
      }
      return [];
    })
  })
}));

// Mock fetch API for login endpoints
globalThis.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
  // Mock login API responses
  if (url.includes('/auth/login') || url.includes('/root-admins/login')) {
    const body = options?.body ? JSON.parse(options.body as string) : {};
    
    // Mock successful login response
    if (body.username === 'admin' || body.username === 'admin') {
      return Promise.resolve(new Response(
        JSON.stringify({
          success: true,
          access_token: 'mock_jwt_token_for_admin',
          refresh_token: 'mock_refresh_token',
          expires_in: 3600,
          user: {
            id: 'user:admin',
            name: '系统管理员',
            email: 'admin@test.com',
            username: 'admin'
          },
          admin: {
            username: 'admin',
            full_name: '系统管理员',
            email: 'admin@test.com'
          }
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      ));
    }
    
    // Mock failed login response
    return Promise.resolve(new Response(
      JSON.stringify({
        success: false,
        message: 'Invalid credentials'
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    ));
  }
  
  // For other requests, return a mock response or reject
  return Promise.reject(new Error(`Unmocked fetch call to ${url}`));
});

// Mock AuthService
vi.mock("@/src/services/authService", () => ({
  default: {
    authenticateUser: vi.fn().mockResolvedValue({
      success: true,
      user: { id: 'user:admin', name: '系统管理员', email: 'admin@test.com' }
    }),
    getCurrentUser: vi.fn().mockResolvedValue({ 
      id: 'user:admin', 
      name: '系统管理员',
      email: 'admin@test.com' 
    }),
    logout: vi.fn().mockImplementation(async () => {
      const testDbManager = (globalThis as any).__TEST_DB_MANAGER__;
      if (testDbManager) {
        await testDbManager.clearAuth();
      }
      return true;
    }),
    checkAuthStatus: vi.fn().mockResolvedValue(true),
    setSurrealClient: vi.fn(),
    setTenantCode: vi.fn().mockImplementation(async (tenantCode: string) => {
      // 在测试环境中，租户代码设置总是成功
      return true;
    }),
    setAuthTokens: vi.fn().mockImplementation(async (accessToken: string, refreshToken?: string, expiresIn?: number) => {
      // 在测试环境中，设置认证令牌意味着设置数据库认证状态
      const testDbManager = (globalThis as any).__TEST_DB_MANAGER__;
      if (testDbManager) {
        await testDbManager.setAuthUser('user:admin');
      }
      return true;
    }),
    getAuthStatusFromSurreal: vi.fn().mockImplementation(async () => {
      // 检查数据库中的认证状态
      const testDb = (globalThis as any).__TEST_DATABASE__;
      if (testDb) {
        try {
          const result = await testDb.query('RETURN $auth;');
          return result && Array.isArray(result) && result[0] && result[0] !== null && result[0] !== undefined;
        } catch (error) {
          return false;
        }
      }
      return false;
    }),
    clearAuthTokens: vi.fn().mockImplementation(async () => {
      const testDbManager = (globalThis as any).__TEST_DB_MANAGER__;
      if (testDbManager) {
        await testDbManager.clearAuth();
      }
      return true;
    })
  }
}));

// Mock react-router-dom
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({
    pathname: "/",
    search: "",
    hash: "",
    state: null,
    key: "default",
  }),
  useParams: () => ({}),
  BrowserRouter: ({ children, ...props }: any) =>
    React.createElement(
      "div",
      { "data-testid": "mock-browser-router", key: Math.random(), ...props },
      children,
    ),
  Route: ({ children }: any) =>
    React.createElement("div", { "data-testid": "mock-route" }, children),
  Routes: ({ children }: any) =>
    React.createElement("div", { "data-testid": "mock-routes" }, children),
}));

// 设置测试超时 - 减少超时时间避免hang
vi.setConfig({
  testTimeout: 10000, // 10秒超时
  hookTimeout: 8000, // 8秒hook超时
});

// 导出测试辅助函数
export const getTestDatabase = () => {
  const db = (globalThis as any).__TEST_DATABASE__;
  if (!db) {
    console.warn("⚠️ 测试数据库未初始化，尝试重新初始化...");
    // 尝试从当前管理器获取数据库
    if (testDbManager) {
      try {
        const database = testDbManager.getDatabase();
        (globalThis as any).__TEST_DATABASE__ = database;
        return database;
      } catch (error) {
        console.error("❌ 无法获取测试数据库实例:", error);
        throw new Error("测试数据库未初始化，请确保在 beforeAll 钩子中正确设置");
      }
    }
    throw new Error("测试数据库未初始化，请确保在 beforeAll 钩子中正确设置");
  }
  return db;
};

export const getTestDatabaseManager = () => {
  const manager = (globalThis as any).__TEST_DB_MANAGER__ || testDbManager;
  if (!manager) {
    console.warn("⚠️ 测试数据库管理器未初始化，尝试获取单例...");
    // 尝试获取单例实例
    try {
      const dbManager = TestDatabaseManager.getInstance();
      (globalThis as any).__TEST_DB_MANAGER__ = dbManager;
      return dbManager;
    } catch (error) {
      console.error("❌ 无法获取测试数据库管理器:", error);
      throw new Error("测试数据库管理器未初始化");
    }
  }
  return manager as TestDatabaseManager;
};

// 集成测试数据共享辅助函数
export const preserveTestData = () => {
  console.log("📋 保持测试数据，不进行清理");
};

export const getSharedTestData = async () => {
  const db = getTestDatabase();
  const cases = await db.query("SELECT * FROM case");
  const users = await db.query("SELECT * FROM user");
  return { cases, users };
};

console.log("📋 内嵌数据库测试设置加载完成");
