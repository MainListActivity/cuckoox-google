import "@testing-library/jest-dom";
import { vi } from "vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Initialize i18n for tests
i18n.use(initReactI18next).init({
  lng: "zh",
  fallbackLng: "zh",
  debug: false,
  interpolation: {
    escapeValue: false,
  },
  resources: {
    zh: {
      translation: {
        // Add minimal translations for tests
        creditor_list_page_title: "债权人列表",
        add_single_creditor_button: "添加单个债权人",
        batch_import_creditors_button: "批量导入债权人",
        print_waybill_button: "打印运单",
        loading: "加载中...",
        no_data_available: "暂无数据",

        // Login page error messages
        error_admin_credentials_required: "Username and password are required.",
        error_tenant_code_required: "Tenant code is required.",
        error_invalid_credentials_or_server: "Invalid credentials",
        loading_session: "Loading session...",
        redirecting: "已登录，正在跳转...",
        authenticating: "正在进行身份验证...",
        login_page_title: "CuckooX",
        login_page_subtitle: "破产案件管理平台",
        login_page_subtitle_admin: "管理员登录",
        login_page_subtitle_user: "用户登录",
        login_subtitle: "欢迎登陆",
        or: "或",
        admin_login_link: "使用 admin 登录",
        login_github_prompt: "请使用您的 GitHub 帐号登录以继续。",
        login_github_button: "使用 GitHub 登录",
        login_github_redirect_info: "您将被重定向到 GitHub进行身份验证。",
      },
    },
  },
});

// Mock global objects that might not be available in test environment
// Only set these if they don't already exist to avoid conflicts with test-specific mocks
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Mock MUI's useMediaQuery to work with matchMedia
vi.mock("@mui/material/useMediaQuery", () => ({
  __esModule: true,
  default: vi.fn((query) => {
    // Return false for all media queries in tests
    return false;
  }),
}));

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

// Mock Service Worker
Object.defineProperty(navigator, "serviceWorker", {
  writable: true,
  value: {
    register: vi.fn().mockResolvedValue({}),
    ready: Promise.resolve({
      active: {
        postMessage: vi.fn(),
      },
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
});

// Mock WebRTC APIs
const RTCPeerConnectionMock = vi.fn().mockImplementation(() => ({
  createOffer: vi.fn().mockResolvedValue({}),
  createAnswer: vi.fn().mockResolvedValue({}),
  setLocalDescription: vi.fn().mockResolvedValue(undefined),
  setRemoteDescription: vi.fn().mockResolvedValue(undefined),
  addIceCandidate: vi.fn().mockResolvedValue(undefined),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

// Add static method to fix TypeScript error
Object.defineProperty(RTCPeerConnectionMock, "generateCertificate", {
  value: vi.fn().mockResolvedValue({}),
  writable: true,
  configurable: true,
});

global.RTCPeerConnection = RTCPeerConnectionMock as any;

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn().mockReturnValue("mock-object-url");
global.URL.revokeObjectURL = vi.fn();

// Increase timeout for async operations
vi.setConfig({
  testTimeout: 1000,
  hookTimeout: 500,
});

// Global cleanup for all tests to prevent cross-contamination
import { afterEach } from "vitest";

afterEach(() => {
  // Clear all mocks, timers, and modules
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.resetModules();
  
  // Clean up DOM elements to prevent component duplication
  document.body.innerHTML = '';
  
  // Reset document head if needed (for title changes, meta tags, etc.)
  const metaElements = document.head.querySelectorAll('meta[data-testid], title[data-testid], link[data-testid]');
  metaElements.forEach(element => element.remove());
  
  // Reset any global state that might leak between tests
  if (typeof window !== 'undefined') {
    // Clear any global event listeners that might have been added during tests
    const events = ['resize', 'scroll', 'keydown', 'keyup', 'click', 'focus', 'blur'];
    events.forEach(event => {
      const clonedWindow = window.cloneNode ? window.cloneNode(true) : window;
    });
  }
});
