import '@testing-library/jest-dom';
import { vi } from 'vitest';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Initialize i18n for tests
i18n
  .use(initReactI18next)
  .init({
    lng: 'zh',
    fallbackLng: 'zh',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    resources: {
      zh: {
        translation: {
          // Add minimal translations for tests
          "creditor_list_page_title": "债权人列表",
          "add_single_creditor_button": "添加单个债权人",
          "batch_import_creditors_button": "批量导入债权人",
          "print_waybill_button": "打印运单",
          "loading": "加载中...",
          "no_data_available": "暂无数据",
        },
      },
    },
  });

// Mock global objects that might not be available in test environment
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
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
Object.defineProperty(navigator, 'serviceWorker', {
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
Object.defineProperty(RTCPeerConnectionMock, 'generateCertificate', {
  value: vi.fn().mockResolvedValue({}),
  writable: true,
  configurable: true,
});

global.RTCPeerConnection = RTCPeerConnectionMock as any;

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn().mockReturnValue('mock-object-url');
global.URL.revokeObjectURL = vi.fn();

// Increase timeout for async operations
vi.setConfig({
  testTimeout: 15000,
  hookTimeout: 10000,
});
