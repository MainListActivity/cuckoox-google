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

// Mock MUI's useMediaQuery with more comprehensive support
vi.mock("@mui/material/useMediaQuery", () => ({
  __esModule: true,
  default: vi.fn().mockImplementation((query) => {
    // Always return false for all media queries in tests for consistency
    return false;
  }),
}));

// Also mock the system level useMediaQuery
vi.mock("@mui/system/useMediaQuery", () => ({
  __esModule: true,
  default: vi.fn().mockImplementation((query) => {
    // Always return false for all media queries in tests for consistency
    return false;
  }),
}));

// Mock theme's breakpoints.up and breakpoints.down methods
vi.mock("@mui/material/styles", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    useTheme: vi.fn().mockReturnValue({
      breakpoints: {
        up: vi.fn().mockReturnValue("@media (min-width:0px)"),
        down: vi.fn().mockReturnValue("@media (max-width:9999px)"),
        between: vi.fn().mockReturnValue("@media (min-width:0px) and (max-width:9999px)"),
        only: vi.fn().mockReturnValue("@media (min-width:0px) and (max-width:9999px)"),
        values: {
          xs: 0,
          sm: 600,
          md: 900,
          lg: 1200,
          xl: 1536,
        },
        keys: ['xs', 'sm', 'md', 'lg', 'xl'],
      },
      palette: {
        mode: 'light',
        primary: { main: '#1976d2' },
        secondary: { main: '#dc004e' },
      },
      spacing: vi.fn().mockImplementation((...args) => args.map(arg => `${arg * 8}px`).join(' ')),
      shape: {
        borderRadius: 4,
      },
      typography: {
        fontSize: 14,
        htmlFontSize: 16,
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      },
      shadows: Array(25).fill('none'),
      transitions: {
        duration: {
          shortest: 150,
          shorter: 200,
          short: 250,
          standard: 300,
          complex: 375,
          enteringScreen: 225,
          leavingScreen: 195,
        },
        easing: {
          easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
          easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
          easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
          sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
        },
      },
      zIndex: {
        mobileStepper: 1000,
        speedDial: 1050,
        appBar: 1100,
        drawer: 1200,
        modal: 1300,
        snackbar: 1400,
        tooltip: 1500,
      },
    }),
  };
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

// Mock console methods to prevent test failures
const originalConsole = { ...console };
Object.defineProperty(global, 'console', {
  value: {
    ...originalConsole,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    debug: vi.fn(),
  },
  writable: true,
});

// Increase timeout for async operations
vi.setConfig({
  testTimeout: 1000,
  hookTimeout: 500,
});

// Mock window.location to prevent JSDOM navigation errors
Object.defineProperty(window, 'location', {
  value: {
    href: '',
    origin: 'http://localhost:3000',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    pathname: '/',
    search: '',
    hash: '',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    toString: vi.fn(() => 'http://localhost:3000/'),
  },
  writable: true,
  configurable: true,
});

// Global cleanup for all tests to prevent cross-contamination
import { afterEach, beforeEach } from "vitest";

// Store original objects to restore them
const originalMatchMedia = window.matchMedia;
const originalHTMLVideoElement = global.HTMLVideoElement;
const originalRequestFullscreen = document.documentElement.requestFullscreen;
const originalExitFullscreen = document.exitFullscreen;

beforeEach(() => {
  // Reset global mocks to ensure clean state
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
  
  // Ensure window.matchMedia is properly mocked
  if (!window.matchMedia || typeof window.matchMedia !== 'function') {
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
});

afterEach(() => {
  // Clear all mocks, timers, and modules
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.resetModules();
  
  // Reset window.location.href to default
  (window.location as any).href = '';
  (window.location as any).pathname = '/';
  
  // Reset window.matchMedia to original or ensure proper mock
  try {
    if (originalMatchMedia) {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: originalMatchMedia,
      });
    }
    
    // Re-establish the mock for consistency
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
  } catch (e) {
    // Fallback - just ensure we have a working mock
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
  }
  
  // Reset HTMLVideoElement if modified
  if (originalHTMLVideoElement) {
    global.HTMLVideoElement = originalHTMLVideoElement;
  }
  
  // Reset fullscreen APIs if modified
  if (originalRequestFullscreen) {
    document.documentElement.requestFullscreen = originalRequestFullscreen;
  }
  if (originalExitFullscreen) {
    document.exitFullscreen = originalExitFullscreen;
  }
  
  // Clean up DOM elements to prevent component duplication
  try {
    document.body.innerHTML = '';
    // Also clear any style elements or other document modifications
    const headElements = document.head.querySelectorAll('style[data-emotion], meta[data-testid], title[data-testid], link[data-testid]');
    headElements.forEach(element => {
      try {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      } catch (e) {
        // Ignore removal errors
      }
    });
  } catch (error) {
    // Silently ignore DOM errors during cleanup
  }
  
  // Reset any global state that might leak between tests
  if (typeof window !== 'undefined') {
    // Clear localStorage and sessionStorage
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      // Ignore storage errors in test environment
    }
    
    // Clear any global event listeners that might have been added during tests
    const events = ['resize', 'scroll', 'keydown', 'keyup', 'click', 'focus', 'blur', 'beforeunload', 'unload'];
    events.forEach(event => {
      try {
        // Create a dummy function to remove any potential listeners
        const dummyHandler = () => {};
        window.removeEventListener(event, dummyHandler, false);
        window.removeEventListener(event, dummyHandler, true);
      } catch (e) {
        // Ignore errors
      }
    });
    
    // Reset window properties that might be modified during tests
    try {
      // Reset any global variables that might have been set
      delete (window as any).gtag;
      delete (window as any).dataLayer;
      
      // Clear any timeouts or intervals that might still be running
      const maxId = 1000; // Arbitrary max ID to clear
      for (let i = 0; i < maxId; i++) {
        try {
          clearTimeout(i);
          clearInterval(i);
        } catch (e) {
          // Ignore errors
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Force garbage collection in tests if available
  if (typeof global !== 'undefined' && typeof global.gc === 'function') {
    try {
      global.gc();
    } catch (e) {
      // Ignore if gc is not available
    }
  }
});
