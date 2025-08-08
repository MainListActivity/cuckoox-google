import React from "react";
import { render as originalRender } from "@testing-library/react";
import { vi } from "vitest";
import {
  MockFactory,
  createTestEnvironment,
  createLightweightTestEnvironment,
} from "./mockFactory";

// 统一的Mock配置
let globalMocks: any = null;
let currentTestEnvironment: any = null;

// 全局Mock对象
let routerMocks: any = null;
let i18nMocks: any = null;

// 创建带有全局mock的测试环境
export function setupGlobalMocks() {
  if (globalMocks) return globalMocks;

  // 使用mockFactory创建统一的mock
  routerMocks = MockFactory.createReactRouterMocks();
  i18nMocks = MockFactory.createI18nMocks();

  // Mock react-router-dom
  vi.mock("react-router-dom", async (importOriginal) => {
    const actual = await importOriginal();
    return {
      ...actual,
      useNavigate: () => routerMocks.navigate,
      useLocation: () => routerMocks.location,
      useParams: () => routerMocks.params,
      BrowserRouter: ({ children, ...props }: any) =>
        React.createElement(
          "div",
          {
            "data-testid": "mock-browser-router",
            key: Math.random(),
            ...props,
          },
          children,
        ),
      Route: ({ children }: any) =>
        React.createElement("div", { "data-testid": "mock-route" }, children),
      Routes: ({ children }: any) =>
        React.createElement("div", { "data-testid": "mock-routes" }, children),
    };
  });

  // Mock react-i18next
  vi.mock("react-i18next", () => ({
    useTranslation: () =>
      i18nMocks?.useTranslation() || {
        t: (key: string) => key,
        i18n: { language: "zh-CN" },
      },
    Trans: ({ children }: any) => children,
    I18nextProvider: ({ children }: any) =>
      React.createElement(
        "div",
        { "data-testid": "mock-i18n-provider" },
        children,
      ),
    withTranslation: () => (Component: any) => Component,
    Translation: ({ children }: any) => children({ t: (key: string) => key }),
    initReactI18next: {
      type: "3rdParty",
      init: vi.fn(),
    },
  }));

  // Mock常用的浏览器API
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

  // Mock createPortal
  vi.mock("react-dom", async (importOriginal) => {
    const actual = (await importOriginal()) as any;
    return {
      ...actual,
      createPortal: (children: any) => children,
    };
  });

  globalMocks = {
    navigate: routerMocks.navigate,
    location: routerMocks.location,
    params: routerMocks.params,
    t: i18nMocks?.t || ((key: string) => key),
    i18n: i18nMocks?.i18n || { language: "zh-CN", changeLanguage: vi.fn() },
    useTranslation:
      i18nMocks?.useTranslation ||
      (() => ({ t: (key: string) => key, i18n: { language: "zh-CN" } })),
  };

  return globalMocks;
}

// 为组件测试创建完整的测试环境
export function createComponentTestEnvironment() {
  if (currentTestEnvironment) {
    currentTestEnvironment.cleanup();
  }

  currentTestEnvironment = createTestEnvironment();
  setupGlobalMocks();

  return currentTestEnvironment;
}

// 为简单测试创建轻量级环境
export function createSimpleTestEnvironment() {
  if (currentTestEnvironment) {
    currentTestEnvironment.cleanup();
  }

  currentTestEnvironment = createLightweightTestEnvironment();
  setupGlobalMocks();

  return currentTestEnvironment;
}

// 清理测试环境
export function cleanupTestEnvironment() {
  if (currentTestEnvironment) {
    currentTestEnvironment.cleanup();
    currentTestEnvironment = null;
  }
  MockFactory.cleanup();
}

// 重置测试环境的mock状态
export function resetTestEnvironment() {
  if (currentTestEnvironment && currentTestEnvironment.reset) {
    currentTestEnvironment.reset();
  }
  MockFactory.resetAllInstances();
}

// 带Provider的渲染器 - 用于需要完整上下文的组件测试
export function renderWithProviders(ui: React.ReactElement, options: any = {}) {
  const testEnv = createComponentTestEnvironment();

  const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(
      "div",
      { "data-testid": "test-providers" },
      children,
    );
  };

  return {
    ...originalRender(ui, { wrapper: AllTheProviders, ...options }),
    testEnv,
  };
}

// 简单渲染器 - 保持向后兼容
export function simpleRender(ui: React.ReactElement, options: any = {}) {
  setupGlobalMocks();
  return originalRender(ui, options);
}

// 默认渲染器 - 使用简单渲染保持兼容性
export const render = simpleRender;

// 导出mockFactory的便捷方法
export const createMockSurrealClient = MockFactory.createSurrealClient;
export const createMockDataService = MockFactory.createDataService;
export const createMockAuthService = MockFactory.createAuthService;
export const createMockMenuService = MockFactory.createMenuService;
export const createMockServiceWorkerComm = MockFactory.createServiceWorkerComm;

// 导出测试数据创建函数
export const createMockCase = MockFactory.createMockCase;
export const createMockUser = MockFactory.createMockUser;
export const createMockCreditor = MockFactory.createMockCreditor;

// 导出全局mock对象，保持向后兼容
export const mockUseTranslation = () => {
  if (!i18nMocks) {
    setupGlobalMocks();
  }
  return (
    i18nMocks?.useTranslation() ||
    (() => ({ t: (key: string) => key, i18n: { language: "zh-CN" } }))
  );
};

export const mockUseNavigate = () => {
  if (!routerMocks) {
    setupGlobalMocks();
  }
  return routerMocks?.navigate || vi.fn();
};

export const mockUseLocation = () => {
  if (!routerMocks) {
    setupGlobalMocks();
  }
  return (
    routerMocks?.location || {
      pathname: "/",
      search: "",
      hash: "",
      state: null,
      key: "default",
    }
  );
};

export const mockUseParams = () => {
  if (!routerMocks) {
    setupGlobalMocks();
  }
  return routerMocks?.params || {};
};

// 常用的测试工具函数
export function waitForTestEnvironment() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// 模拟异步操作
export function mockAsyncOperation<T>(result: T, delay = 0): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(result), delay));
}

// 模拟错误
export function mockAsyncError(
  error: Error | string,
  delay = 0,
): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(
      () => reject(typeof error === "string" ? new Error(error) : error),
      delay,
    ),
  );
}

// 创建测试用的RecordId
export function createTestRecordId(table: string, id: string) {
  return { tb: table, id };
}

// Export everything from testing-library
export * from "@testing-library/react";
