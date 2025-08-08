import "@testing-library/jest-dom";
import React from "react";
import { vi, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { MockFactory } from "./unit/utils/mockFactory";
import {
  cleanupTestEnvironment,
  resetTestEnvironment,
} from "./unit/utils/testUtils";

// 完全清理函数
function completeCleanup() {
  // 1. React Testing Library 清理
  cleanup();

  // 2. MockFactory清理
  MockFactory.cleanup();

  // 3. 测试环境清理
  cleanupTestEnvironment();

  // 4. 确保DOM结构存在
  if (!document.documentElement) {
    const html = document.createElement("html");
    const head = document.createElement("head");
    const body = document.createElement("body");
    html.appendChild(head);
    html.appendChild(body);
    document.appendChild(html);
  } else {
    if (!document.head) {
      const head = document.createElement("head");
      document.documentElement.appendChild(head);
    }
    if (!document.body) {
      const body = document.createElement("body");
      document.documentElement.appendChild(body);
    }
  }

  // 5. 清理DOM内容但保留body元素
  if (document.body) {
    document.body.innerHTML = "";
  }

  // 6. 清理所有定时器
  vi.clearAllTimers();
  vi.useRealTimers();

  // 7. 清理所有mock
  vi.clearAllMocks();

  // 8. 重置模块
  vi.resetModules();
}

// 轻量级重置函数 - 用于beforeEach
function lightweightReset() {
  // 重置mock状态但不重新创建
  resetTestEnvironment();
  MockFactory.resetAllInstances();
  vi.clearAllMocks();
}

// 最小化DOM设置
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

// Mock createPortal 来避免portal相关的DOM问题
vi.mock("react-dom", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    createPortal: (children: any) => children, // 直接返回children，避免portal DOM操作
  };
});

// 全局 Mock react-i18next
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

// 全局 Mock react-router-dom
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

// 测试生命周期管理
beforeEach(() => {
  lightweightReset();
});

afterEach(() => {
  completeCleanup();
});

// 设置测试超时
vi.setConfig({
  testTimeout: 5000, // 5秒超时
  hookTimeout: 3000, // 3秒hook超时
});
