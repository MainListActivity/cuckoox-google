import "@testing-library/jest-dom";
import { vi, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// 完全清理函数
function completeCleanup() {
  // 1. React Testing Library 清理
  cleanup();

  // 2. 确保DOM结构存在
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

  // 3. 清理DOM内容但保留body元素
  if (document.body) {
    document.body.innerHTML = "";
  }

  // 4. 清理所有定时器
  vi.clearAllTimers();
  vi.useRealTimers();

  // 5. 清理所有mock
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

// 测试生命周期管理
beforeEach(() => {
  completeCleanup();
});

afterEach(() => {
  completeCleanup();
});

// 设置测试超时
vi.setConfig({
  testTimeout: 5000, // 5秒超时
  hookTimeout: 3000, // 3秒hook超时
});
