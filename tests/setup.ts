import "@testing-library/jest-dom";
import { vi, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// 存储原始全局对象引用
const originalGlobals = {
  DOMException: globalThis.DOMException,
  matchMedia: globalThis.matchMedia,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  setInterval: globalThis.setInterval,
  clearInterval: globalThis.clearInterval,
  HTMLVideoElement: globalThis.HTMLVideoElement?.prototype,
  HTMLElement: globalThis.HTMLElement?.prototype,
  Element: globalThis.Element?.prototype,
  document: globalThis.document,
  console: globalThis.console,
  fetch: globalThis.fetch,
};

// 完全清理函数
function completeCleanup() {
  // 1. React Testing Library 清理
  cleanup();
  
  // 2. 重置全局对象到原始状态
  if (originalGlobals.DOMException && globalThis.DOMException !== originalGlobals.DOMException) {
    globalThis.DOMException = originalGlobals.DOMException;
  }
  
  if (originalGlobals.matchMedia && globalThis.matchMedia !== originalGlobals.matchMedia) {
    globalThis.matchMedia = originalGlobals.matchMedia;
  }
  
  // 3. 确保DOM结构存在
  if (!document.documentElement) {
    const html = document.createElement('html');
    const head = document.createElement('head');
    const body = document.createElement('body');
    html.appendChild(head);
    html.appendChild(body);
    document.appendChild(html);
  } else {
    if (!document.head) {
      const head = document.createElement('head');
      document.documentElement.appendChild(head);
    }
    if (!document.body) {
      const body = document.createElement('body');
      document.documentElement.appendChild(body);
    }
  }
  
  // 4. 清理DOM内容但保留body元素
  if (document.body) {
    document.body.innerHTML = '';
  }
  
  // 5. 重置DOM原型方法
  if (originalGlobals.HTMLElement && globalThis.HTMLElement?.prototype) {
    // 重置可能被修改的方法
    if (originalGlobals.HTMLElement.focus) {
      globalThis.HTMLElement.prototype.focus = originalGlobals.HTMLElement.focus;
    }
    if (originalGlobals.HTMLElement.blur) {
      globalThis.HTMLElement.prototype.blur = originalGlobals.HTMLElement.blur;
    }
  }
  
  if (originalGlobals.Element && globalThis.Element?.prototype) {
    if (originalGlobals.Element.scrollIntoView) {
      globalThis.Element.prototype.scrollIntoView = originalGlobals.Element.scrollIntoView;
    }
  }
  
  // 6. 清理所有定时器
  vi.clearAllTimers();
  vi.useRealTimers();
  
  // 7. 清理所有mock
  vi.clearAllMocks();
  
  // 8. 重置模块缓存
  vi.resetModules();
}

// 最小化DOM设置 - 使用存储的原始值或fallback
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
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

// 基本DOM方法mock - 确保可以重置
const elementScrollIntoView = vi.fn();
const htmlElementFocus = vi.fn();
const htmlElementBlur = vi.fn();

Element.prototype.scrollIntoView = elementScrollIntoView;
HTMLElement.prototype.focus = htmlElementFocus;
HTMLElement.prototype.blur = htmlElementBlur;

// 确保DOMException可用 - 使用原生的或创建fallback
if (!globalThis.DOMException) {
  globalThis.DOMException = class DOMException extends Error {
    constructor(message = '', name = 'Error') {
      super(message);
      this.name = name;
    }
  } as any;
}

// Mock createPortal 来避免portal相关的DOM问题
vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal() as any;
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

// 设置测试超时 - 保持原有配置
vi.setConfig({
  testTimeout: 2000, // 2秒超时
  hookTimeout: 1000, // 1秒hook超时
});