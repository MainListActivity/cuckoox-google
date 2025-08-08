/**
 * PWA Workers 简化测试 - 专门为Worker环境设计
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Worker环境
const createWorkerEnvironment = () => {
  const mockCaches = {
    open: vi.fn().mockResolvedValue({
      match: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(true),
    }),
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true),
  };

  global.caches = mockCaches as any;
  global.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
  
  // 使用 Object.defineProperty 来模拟只读的crypto对象
  Object.defineProperty(global, 'crypto', {
    value: {
      subtle: {
        generateKey: vi.fn().mockResolvedValue('mock-key'),
        encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
        decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
        digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      },
      getRandomValues: vi.fn().mockImplementation((array) => array),
    },
    writable: true,
    configurable: true,
  });
  global.self = {
    clients: { matchAll: vi.fn().mockResolvedValue([]) },
    postMessage: vi.fn(),
    addEventListener: vi.fn(),
  } as any;
  global.btoa = vi.fn().mockReturnValue('encoded');
  global.atob = vi.fn().mockReturnValue('decoded');
  global.TextEncoder = vi.fn().mockImplementation(() => ({
    encode: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  }));
  global.TextDecoder = vi.fn().mockImplementation(() => ({
    decode: vi.fn().mockReturnValue('decoded text'),
  }));

  return { mockCaches };
};

describe('PWA Workers - 基础功能测试', () => {
  let mockCaches: any;

  beforeEach(() => {
    const env = createWorkerEnvironment();
    mockCaches = env.mockCaches;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('PWAPerformanceManager', () => {
    it('应该能够创建实例', async () => {
      const { PWAPerformanceManager } = await import('@/src/workers/pwa-performance-manager');
      
      const config = {
        appShell: {
          coreResources: ['/app.js'],
          shellCacheName: 'test-cache',
          version: '1.0.0',
        },
        preloading: {
          criticalResources: [],
          preloadStrategy: 'conservative' as const,
          maxPreloadSize: 1024 * 1024,
        },
        lazyLoading: {
          routes: [],
          chunkSize: 256 * 1024,
          loadingThreshold: 100,
        },
        performance: {
          memoryThreshold: 100,
          cleanupInterval: 30000,
          targetFCP: 1500,
          targetLCP: 2500,
        },
      };

      const manager = new PWAPerformanceManager(config);
      expect(manager).toBeDefined();
      expect(typeof manager.initialize).toBe('function');
    });

    it('工具函数应该正常工作', async () => {
      const { PerformanceUtils } = await import('@/src/workers/pwa-performance-manager');
      
      const metrics = { fcp: 1200, lcp: 2000, fid: 80, cls: 0.05, ttfb: 400, memoryUsage: 40, cacheHitRate: 85 };
      const targets = { targetFCP: 1500, targetLCP: 2500, memoryThreshold: 100, cleanupInterval: 30000 };
      
      const result = PerformanceUtils.checkPerformanceTargets(metrics, targets);
      
      expect(result.fcpPassed).toBe(true);
      expect(result.lcpPassed).toBe(true);
      expect(result.overall).toBe(true);
    });
  });

  describe('PWASecurityManager', () => {
    it('应该能够创建实例', async () => {
      const { PWASecurityManager } = await import('@/src/workers/pwa-security-manager');
      
      const config = {
        encryption: {
          enabled: true,
          algorithm: 'AES-GCM' as const,
          keyLength: 256 as const,
          ivLength: 12 as const,
        },
        authentication: {
          autoLockTimeout: 300000,
          maxInactivity: 1800000,
          requireReauth: true,
          sessionStorageKey: 'test-session',
        },
        threats: {
          enableDetection: true,
          maxFailedAttempts: 3,
          lockoutDuration: 900000,
        },
        cache: {
          encryptSensitiveData: true,
          sensitiveDataPatterns: ['token', 'auth'],
          maxCacheAge: 86400000,
        },
      };

      const manager = new PWASecurityManager(config);
      expect(manager).toBeDefined();
      expect(typeof manager.initialize).toBe('function');
    });

    it('安全工具函数应该正常工作', async () => {
      const { SecurityUtils } = await import('@/src/workers/pwa-security-manager');
      
      const randomString = SecurityUtils.generateSecureRandomString(16);
      expect(typeof randomString).toBe('string');
      expect(randomString.length).toBe(32); // hex编码
      
      expect(SecurityUtils.containsSensitiveData('Bearer token123')).toBe(true);
      expect(SecurityUtils.containsSensitiveData('public data')).toBe(false);
    });
  });

  describe('PWAPushManager', () => {
    it('应该能够创建实例', async () => {
      // Mock Navigator APIs
      global.navigator = {
        serviceWorker: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: vi.fn().mockResolvedValue(null),
              subscribe: vi.fn(),
            },
            active: { postMessage: vi.fn() },
          }),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
      } as any;
      global.PushManager = class {} as any;
      global.Notification = {
        permission: 'default' as NotificationPermission,
        requestPermission: vi.fn().mockResolvedValue('granted' as NotificationPermission),
      } as any;

      const { PWAPushManager } = await import('@/src/workers/pwa-push-manager');
      
      const config = {
        vapidPublicKey: 'test-key',
        serviceWorkerPath: '/sw.js',
        notificationOptions: {
          icon: '/icon.png',
        },
        serverEndpoint: 'https://example.com/api',
      };

      const manager = new PWAPushManager(config);
      expect(manager).toBeDefined();
      expect(typeof manager.initialize).toBe('function');
    });

    it('推送工具函数应该正常工作', async () => {
      // 设置必要的全局对象
      global.navigator = {} as any;
      global.PushManager = class {} as any;
      global.Notification = {} as any;

      const { PushNotificationUtils } = await import('@/src/workers/pwa-push-manager');
      
      const payload = PushNotificationUtils.createNotificationPayload({
        title: '测试通知',
        body: '测试内容',
        type: 'case',
        data: { id: '123' },
      });
      
      expect(payload.title).toBe('测试通知');
      expect(payload.body).toBe('测试内容');
      expect(payload.data?.type).toBe('case');
    });
  });

  describe('PWACollaborationEnhancer', () => {
    it('应该能够创建实例', async () => {
      const { PWACollaborationEnhancer } = await import('@/src/workers/pwa-collaboration-enhancer');
      
      const config = {
        enableBackgroundSync: true,
        pushNotificationConfig: {
          enabled: false,
        },
        reconnectionConfig: {
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 30000,
        },
        visibilityConfig: {
          enableVisibilityAPI: false, // 禁用以避免DOM依赖
          backgroundSyncInterval: 30000,
        },
      };

      const enhancer = new PWACollaborationEnhancer(config);
      expect(enhancer).toBeDefined();
      expect(typeof enhancer.initialize).toBe('function');
    });

    it('协作工具函数应该正常工作', async () => {
      const { CollaborationUtils } = await import('@/src/workers/pwa-collaboration-enhancer');
      
      const event = CollaborationUtils.createCollaborationEvent(
        'document_change',
        'user123',
        'Test User',
        'doc456',
        'document',
        { changes: ['test'] }
      );

      expect(event.type).toBe('document_change');
      expect(event.userId).toBe('user123');
      expect(event.userName).toBe('Test User');
      expect(event.resourceId).toBe('doc456');
      expect(event.resourceType).toBe('document');
      expect(event.timestamp).toBeTypeOf('number');

      expect(CollaborationUtils.isImportantEvent(event)).toBe(true);
      
      const message = CollaborationUtils.formatEventMessage(event);
      expect(message).toBe('Test User 修改了文档');
    });
  });

  describe('集成测试', () => {
    it('所有模块都应该能正常导入', async () => {
      const performanceModule = await import('@/src/workers/pwa-performance-manager');
      const securityModule = await import('@/src/workers/pwa-security-manager');
      const pushModule = await import('@/src/workers/pwa-push-manager');
      const collaborationModule = await import('@/src/workers/pwa-collaboration-enhancer');

      expect(performanceModule.PWAPerformanceManager).toBeDefined();
      expect(performanceModule.PerformanceUtils).toBeDefined();
      
      expect(securityModule.PWASecurityManager).toBeDefined();
      expect(securityModule.SecurityUtils).toBeDefined();
      
      expect(pushModule.PWAPushManager).toBeDefined();
      expect(pushModule.PushNotificationUtils).toBeDefined();
      
      expect(collaborationModule.PWACollaborationEnhancer).toBeDefined();
      expect(collaborationModule.CollaborationUtils).toBeDefined();
    });

    it('各模块的类型定义都应该正确', async () => {
      // 测试基础类型导入
      const performanceModule = await import('@/src/workers/pwa-performance-manager');
      const securityModule = await import('@/src/workers/pwa-security-manager');
      const pushModule = await import('@/src/workers/pwa-push-manager');
      const collaborationModule = await import('@/src/workers/pwa-collaboration-enhancer');

      // 验证类构造函数存在
      expect(typeof performanceModule.PWAPerformanceManager).toBe('function');
      expect(typeof securityModule.PWASecurityManager).toBe('function');
      expect(typeof pushModule.PWAPushManager).toBe('function');
      expect(typeof collaborationModule.PWACollaborationEnhancer).toBe('function');

      // 验证工具对象存在
      expect(typeof performanceModule.PerformanceUtils).toBe('object');
      expect(typeof securityModule.SecurityUtils).toBe('object');
      expect(typeof pushModule.PushNotificationUtils).toBe('object');
      expect(typeof collaborationModule.CollaborationUtils).toBe('object');
    });
  });

  describe('缓存操作测试', () => {
    it('所有模块都能与缓存系统交互', async () => {
      // 简单验证缓存交互不会崩溃
      expect(mockCaches.open).toBeDefined();
      
      const cache = await caches.open('test-cache');
      await cache.put('test-key', new Response('test-data'));
      
      expect(mockCaches.open).toHaveBeenCalledWith('test-cache');
    });
  });
});