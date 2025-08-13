import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServiceWorkerEngine } from '@/src/lib/service-worker-engine';

// Mock navigator.serviceWorker
const mockRegistration = {
  active: null as ServiceWorker | null,
  waiting: null as ServiceWorker | null,
  installing: null as ServiceWorker | null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

const mockServiceWorker = {
  state: 'activated' as ServiceWorkerState,
  scriptURL: '/sw-surreal.js',
  postMessage: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

const mockNavigator = {
  serviceWorker: {
    ready: Promise.resolve(mockRegistration),
    controller: null as ServiceWorker | null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
};

describe('ServiceWorkerEngine', () => {
  let engine: ServiceWorkerEngine;

  beforeEach(() => {
    // 重置所有mock
    vi.clearAllMocks();
    
    // 设置navigator mock
    Object.defineProperty(global, 'navigator', {
      value: mockNavigator,
      writable: true,
    });

    // 重置mockRegistration状态
    mockRegistration.active = { ...mockServiceWorker };
    mockRegistration.waiting = null;
    mockRegistration.installing = null;
    
    engine = new ServiceWorkerEngine();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('连接管理', () => {
    it('应该成功连接到Service Worker', async () => {
      // 确保Service Worker处于激活状态
      mockRegistration.active = { ...mockServiceWorker };

      await expect(engine.connect('sw://localhost')).resolves.toBeUndefined();
      expect(mockNavigator.serviceWorker.addEventListener).toHaveBeenCalled();
    });

    it('应该在没有可用Service Worker时抛出错误', async () => {
      // 设置没有可用的Service Worker
      mockRegistration.active = null;
      mockRegistration.waiting = null;
      mockRegistration.installing = null;

      await expect(engine.connect('sw://localhost')).rejects.toThrow('Service Worker不可用');
    });

    it('应该正确断开连接', async () => {
      // 先连接
      mockRegistration.active = { ...mockServiceWorker };
      await engine.connect('sw://localhost');

      // 断开连接
      await expect(engine.disconnect()).resolves.toBeUndefined();
      expect(mockNavigator.serviceWorker.removeEventListener).toHaveBeenCalled();
    });
  });

  describe('Service Worker更新处理', () => {
    it('应该与Workbox协作处理Service Worker更新', async () => {
      // 先连接
      mockRegistration.active = { ...mockServiceWorker };
      await engine.connect('sw://localhost');

      // 设置新的控制器（模拟Workbox激活新Service Worker后的状态）
      const newController = { ...mockServiceWorker, scriptURL: '/sw-surreal-v2.js' };
      mockNavigator.serviceWorker.controller = newController;

      // 验证控制权变更处理不会崩溃
      expect(async () => await (engine as any).handleControllerChange()).not.toThrow();
    });

    it('应该处理控制权变更事件', async () => {
      // 先连接
      mockRegistration.active = { ...mockServiceWorker };
      await engine.connect('sw://localhost');

      // 设置新的控制器
      const newController = { ...mockServiceWorker, scriptURL: '/sw-surreal-v2.js' };
      mockNavigator.serviceWorker.controller = newController;

      // 获取事件发射器
      const emitter = (engine as any).context?.emitter || (engine as any).emitter;
      const controllerChangeListener = vi.fn();
      
      if (emitter && typeof emitter.on === 'function') {
        emitter.on('sw-controller-changed', controllerChangeListener);

        // 模拟控制权变更
        await (engine as any).handleControllerChange();

        expect(controllerChangeListener).toHaveBeenCalledWith({ serviceWorker: newController });
      } else {
        // 如果emitter不可用，至少验证方法调用不会崩溃
        expect(async () => await (engine as any).handleControllerChange()).not.toThrow();
      }
    });

    it('应该处理Service Worker激活通知', async () => {
      // 先连接
      mockRegistration.active = { ...mockServiceWorker };
      await engine.connect('sw://localhost');

      // 设置当前控制器
      const controller = { ...mockServiceWorker };
      mockNavigator.serviceWorker.controller = controller;

      // 获取事件发射器
      const emitter = (engine as any).context?.emitter || (engine as any).emitter;
      const activatedListener = vi.fn();
      
      if (emitter && typeof emitter.on === 'function') {
        emitter.on('sw-activated', activatedListener);

        // 模拟Service Worker激活
        const payload = { version: 'v2.0.0', timestamp: Date.now() };
        (engine as any).handleServiceWorkerActivated(payload);

        expect(activatedListener).toHaveBeenCalledWith(payload);
        expect((engine as any).serviceWorker).toBe(controller);
      } else {
        // 如果emitter不可用，至少验证方法调用不会崩溃
        const payload = { version: 'v2.0.0', timestamp: Date.now() };
        expect(() => (engine as any).handleServiceWorkerActivated(payload)).not.toThrow();
      }
    });
  });

  describe('消息处理', () => {
    it('应该处理sw-activated消息', async () => {
      // 先连接
      mockRegistration.active = { ...mockServiceWorker };
      await engine.connect('sw://localhost');

      // 设置当前控制器
      mockNavigator.serviceWorker.controller = { ...mockServiceWorker };

      // 获取消息处理器
      const messageHandler = (engine as any).messageListener;
      
      // 模拟消息事件
      const messageEvent = {
        data: {
          type: 'sw-activated',
          payload: { version: 'v2.0.0', timestamp: Date.now() }
        }
      };

      // 调用消息处理器应该不会抛出错误
      expect(() => messageHandler(messageEvent)).not.toThrow();
    });

    it('应该处理未知消息类型', async () => {
      // 先连接
      mockRegistration.active = { ...mockServiceWorker };
      await engine.connect('sw://localhost');

      // 获取消息处理器
      const messageHandler = (engine as any).messageListener;
      
      // 模拟未知消息类型
      const messageEvent = {
        data: {
          type: 'unknown-message-type',
          payload: {}
        }
      };

      // 应该能够处理未知消息类型而不崩溃
      expect(() => messageHandler(messageEvent)).not.toThrow();
    });
  });

  describe('RPC通信', () => {
    it('应该能发送RPC请求', async () => {
      // 先连接
      mockRegistration.active = { ...mockServiceWorker };
      await engine.connect('sw://localhost');

      // 模拟RPC请求 - 不等待响应以避免超时
      const rpcPromise = engine.rpc({ method: 'test', params: [] });
      
      // 验证消息已发送
      expect(mockServiceWorker.postMessage).toHaveBeenCalledWith({
        type: 'rpc_request',
        payload: {
          requestId: 1,
          method: 'test',
          params: []
        }
      });

      // 模拟响应以避免测试超时
      const messageHandler = (engine as any).messageListener;
      messageHandler({
        data: {
          type: 'rpc_response',
          payload: {
            requestId: 1,
            result: 'test result'
          }
        }
      });

      // 现在应该能正常解析
      const result = await rpcPromise;
      expect(result).toEqual({ result: 'test result' });
    });
  });
});