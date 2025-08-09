/**
 * 内嵌数据库测试环境设置
 * 专门用于使用真实SurrealDB数据库的测试
 */

import "@testing-library/jest-dom";
import React from "react";
import { vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { TestDatabaseManager, closeTestDatabase } from "./database/TestDatabaseManager";

// 全局数据库管理器实例
let testDbManager: TestDatabaseManager;

// 初始化内嵌数据库测试环境
beforeAll(async () => {
  console.log('🚀 正在初始化内嵌数据库测试环境...');
  
  // 获取测试数据库管理器
  testDbManager = TestDatabaseManager.getInstance();
  
  // 初始化数据库 - 这会创建内嵌数据库实例并加载测试数据
  await testDbManager.initialize();
  
  // 验证数据库状态
  const isValid = await testDbManager.validateDatabaseState();
  if (!isValid) {
    throw new Error('测试数据库初始化失败 - 数据验证不通过');
  }
  
  const stats = await testDbManager.getDatabaseStats();
  console.log('📊 数据库初始化完成，统计信息:', stats);
  
  // 设置全局数据库实例供测试使用
  (globalThis as any).__TEST_DATABASE__ = testDbManager.getDatabase();
  (globalThis as any).__TEST_DB_MANAGER__ = testDbManager;
}, 30000); // 30秒超时，给数据库初始化足够时间

// 清理数据库测试环境
afterAll(async () => {
  console.log('🧹 正在清理内嵌数据库测试环境...');
  
  try {
    // 清理全局引用
    delete (globalThis as any).__TEST_DATABASE__;
    delete (globalThis as any).__TEST_DB_MANAGER__;
    
    // 关闭数据库连接
    await closeTestDatabase();
    console.log('✅ 数据库测试环境清理完成');
  } catch (error) {
    console.warn('⚠️ 清理数据库环境时出现警告:', error);
  }
}, 10000); // 10秒超时

// 每个测试前重置数据库状态
beforeEach(async () => {
  if (testDbManager) {
    // 重置数据库到初始状态
    await testDbManager.resetDatabase();
    
    // 清除认证状态，每个测试开始时都是未认证状态
    await testDbManager.clearAuth();
  }
  
  // React Testing Library 清理
  cleanup();
}, 5000); // 5秒超时

// 每个测试后清理
afterEach(async () => {
  // 清理认证状态
  if (testDbManager) {
    await testDbManager.clearAuth();
  }
  
  // 清理 React Testing Library
  cleanup();
  
  // 清理所有 mocks
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
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
HTMLElement.prototype.focus = vi.fn();
HTMLElement.prototype.blur = vi.fn();

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

// Mock react-router-dom
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
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
  };
});

// 设置测试超时
vi.setConfig({
  testTimeout: 15000, // 15秒超时，因为数据库操作可能较慢
  hookTimeout: 10000, // 10秒hook超时
});

// 导出测试辅助函数
export const getTestDatabase = () => {
  const db = (globalThis as any).__TEST_DATABASE__;
  if (!db) {
    throw new Error('测试数据库未初始化，请确保在 beforeAll 钩子中正确设置');
  }
  return db;
};

export const getTestDatabaseManager = () => {
  const manager = (globalThis as any).__TEST_DB_MANAGER__;
  if (!manager) {
    throw new Error('测试数据库管理器未初始化');
  }
  return manager as TestDatabaseManager;
};

console.log('📋 内嵌数据库测试设置加载完成');