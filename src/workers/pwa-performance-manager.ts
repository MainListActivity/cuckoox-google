/// <reference lib="WebWorker" />

/**
 * PWA性能优化管理器
 * 
 * 负责PWA应用的性能优化，包括：
 * - App Shell架构实现
 * - 资源预加载和懒加载
 * - 启动性能优化
 * - 内存管理
 * - 关键渲染路径优化
 */

export interface PWAPerformanceConfig {
  appShell: {
    coreResources: string[];
    shellCacheName: string;
    version: string;
  };
  preloading: {
    criticalResources: string[];
    preloadStrategy: 'aggressive' | 'conservative' | 'adaptive';
    maxPreloadSize: number; // bytes
  };
  lazyLoading: {
    routes: string[];
    chunkSize: number;
    loadingThreshold: number; // ms
  };
  performance: {
    memoryThreshold: number; // MB
    cleanupInterval: number; // ms
    targetFCP: number; // ms (First Contentful Paint)
    targetLCP: number; // ms (Largest Contentful Paint)
  };
}

export interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
  memoryUsage: number; // MB
  cacheHitRate: number; // %
}

export interface AppShellState {
  isLoaded: boolean;
  coreResourcesCount: number;
  loadedResourcesCount: number;
  loadingProgress: number; // 0-100
  lastUpdated: Date;
}

export class PWAPerformanceManager {
  private config: PWAPerformanceConfig;
  private performanceObserver: PerformanceObserver | null = null;
  private memoryCleanupTimer: number | null = null;
  private metrics: PerformanceMetrics = {
    fcp: 0,
    lcp: 0,
    fid: 0,
    cls: 0,
    ttfb: 0,
    memoryUsage: 0,
    cacheHitRate: 0
  };
  private appShellState: AppShellState = {
    isLoaded: false,
    coreResourcesCount: 0,
    loadedResourcesCount: 0,
    loadingProgress: 0,
    lastUpdated: new Date()
  };
  private isInitialized = false;

  constructor(config: PWAPerformanceConfig) {
    this.config = config;
  }

  /**
   * 初始化性能管理器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('PWAPerformanceManager: Initializing...');

    try {
      // 初始化App Shell
      await this.initializeAppShell();

      // 设置性能监控
      this.setupPerformanceMonitoring();

      // 启动资源预加载
      this.startResourcePreloading();

      // 启动内存管理
      this.startMemoryManagement();

      this.isInitialized = true;
      console.log('PWAPerformanceManager: Initialized successfully');
    } catch (error) {
      console.error('PWAPerformanceManager: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * 初始化App Shell
   */
  async initializeAppShell(): Promise<void> {
    console.log('PWAPerformanceManager: Initializing App Shell...');

    try {
      const { coreResources, shellCacheName } = this.config.appShell;
      this.appShellState.coreResourcesCount = coreResources.length;

      // 创建或获取App Shell缓存
      const cache = await caches.open(shellCacheName);

      // 检查现有缓存
      const cachedResources = await this.checkCachedResources(cache, coreResources);
      this.appShellState.loadedResourcesCount = cachedResources.length;

      // 缓存缺失的核心资源
      const missingResources = coreResources.filter(url => !cachedResources.includes(url));
      
      if (missingResources.length > 0) {
        console.log('PWAPerformanceManager: Caching missing App Shell resources:', missingResources);
        await this.cacheAppShellResources(cache, missingResources);
      }

      this.appShellState.isLoaded = true;
      this.updateAppShellProgress();

      console.log('PWAPerformanceManager: App Shell initialized successfully');
    } catch (error) {
      console.error('PWAPerformanceManager: App Shell initialization failed:', error);
      throw error;
    }
  }

  /**
   * 处理请求并优化性能
   */
  async handleRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);

    // App Shell请求优先从缓存获取
    if (this.isAppShellResource(url.pathname)) {
      return this.handleAppShellRequest(request);
    }

    // 动态资源请求优化
    if (this.isDynamicResource(url.pathname)) {
      return this.handleDynamicRequest(request);
    }

    // 其他资源使用标准缓存策略
    return null;
  }

  /**
   * 预加载资源
   */
  async preloadResources(urls: string[]): Promise<void> {
    console.log('PWAPerformanceManager: Preloading resources:', urls);

    const { preloadStrategy, maxPreloadSize } = this.config.preloading;
    
    // 根据策略和网络状况决定预加载行为
    const shouldPreload = await this.shouldPreloadResources(preloadStrategy);
    
    if (!shouldPreload) {
      console.log('PWAPerformanceManager: Skipping preload due to strategy');
      return;
    }

    try {
      const totalSize = 0;
      const preloadPromises: Promise<void>[] = [];

      for (const url of urls) {
        if (totalSize >= maxPreloadSize) {
          console.log('PWAPerformanceManager: Preload size limit reached');
          break;
        }

        preloadPromises.push(this.preloadResource(url));
      }

      await Promise.allSettled(preloadPromises);
      console.log('PWAPerformanceManager: Resource preloading completed');
    } catch (error) {
      console.error('PWAPerformanceManager: Resource preloading failed:', error);
    }
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * 获取App Shell状态
   */
  getAppShellState(): AppShellState {
    return { ...this.appShellState };
  }

  /**
   * 强制清理内存
   */
  async forceMemoryCleanup(): Promise<void> {
    console.log('PWAPerformanceManager: Forcing memory cleanup...');

    try {
      // 清理过期缓存
      await this.cleanupExpiredCaches();

      // 清理未使用的资源
      await this.cleanupUnusedResources();

      // 更新内存使用指标
      this.updateMemoryMetrics();

      console.log('PWAPerformanceManager: Memory cleanup completed');
    } catch (error) {
      console.error('PWAPerformanceManager: Memory cleanup failed:', error);
    }
  }

  /**
   * 销毁性能管理器
   */
  destroy(): void {
    console.log('PWAPerformanceManager: Destroying...');

    // 清理性能观察器
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    // 清理定时器
    if (this.memoryCleanupTimer) {
      clearInterval(this.memoryCleanupTimer);
      this.memoryCleanupTimer = null;
    }

    this.isInitialized = false;
    console.log('PWAPerformanceManager: Destroyed');
  }

  // 私有方法

  private async checkCachedResources(cache: Cache, resources: string[]): Promise<string[]> {
    const cachedResources: string[] = [];

    for (const url of resources) {
      try {
        const response = await cache.match(url);
        if (response) {
          cachedResources.push(url);
        }
      } catch (error) {
        console.warn('PWAPerformanceManager: Error checking cached resource:', url, error);
      }
    }

    return cachedResources;
  }

  private async cacheAppShellResources(cache: Cache, resources: string[]): Promise<void> {
    const cachePromises = resources.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          this.appShellState.loadedResourcesCount++;
          this.updateAppShellProgress();
        }
      } catch (error) {
        console.warn('PWAPerformanceManager: Failed to cache App Shell resource:', url, error);
      }
    });

    await Promise.allSettled(cachePromises);
  }

  private updateAppShellProgress(): void {
    const { coreResourcesCount, loadedResourcesCount } = this.appShellState;
    this.appShellState.loadingProgress = coreResourcesCount > 0 
      ? Math.round((loadedResourcesCount / coreResourcesCount) * 100)
      : 100;
    this.appShellState.lastUpdated = new Date();
  }

  private isAppShellResource(pathname: string): boolean {
    const { coreResources } = this.config.appShell;
    return coreResources.some(resource => {
      // 支持精确匹配和模式匹配
      if (resource.includes('*')) {
        const pattern = resource.replace(/\*/g, '.*');
        return new RegExp(pattern).test(pathname);
      }
      return pathname === resource || pathname.startsWith(resource);
    });
  }

  private isDynamicResource(pathname: string): boolean {
    // 判断是否为动态资源（API请求、数据等）
    return pathname.startsWith('/api/') || 
           pathname.includes('.json') ||
           pathname.includes('query=');
  }

  private async handleAppShellRequest(request: Request): Promise<Response | null> {
    try {
      // POST请求不能被缓存，直接转发到网络
      if (request.method !== 'GET') {
        console.log('PWAPerformanceManager: Non-GET request, bypassing cache:', request.method, request.url);
        return fetch(request.clone());
      }

      const cache = await caches.open(this.config.appShell.shellCacheName);
      
      // 首先尝试从缓存获取
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        console.log('PWAPerformanceManager: Serving App Shell from cache:', request.url);
        return cachedResponse;
      }

      // 缓存未命中，从网络获取
      console.log('PWAPerformanceManager: App Shell cache miss, fetching from network:', request.url);
      const networkResponse = await fetch(request.clone());
      
      if (networkResponse.ok) {
        // 只缓存GET请求的响应
        await cache.put(request.clone(), networkResponse.clone());
      }

      return networkResponse;
    } catch (error) {
      console.error('PWAPerformanceManager: Error handling App Shell request:', error);
      return null;
    }
  }

  private async handleDynamicRequest(request: Request): Promise<Response | null> {
    try {
      // 动态资源使用网络优先策略
      const networkResponse = await fetch(request);
      
      if (networkResponse.ok) {
        // 选择性缓存动态资源
        if (this.shouldCacheDynamicResource(request)) {
          const cache = await caches.open('dynamic-cache');
          await cache.put(request, networkResponse.clone());
        }
      }

      return networkResponse;
    } catch (error) {
      // 网络失败时尝试从缓存获取
      console.log('PWAPerformanceManager: Network failed, trying cache for:', request.url);
      const cache = await caches.open('dynamic-cache');
      return await cache.match(request);
    }
  }

  private shouldCacheDynamicResource(request: Request): boolean {
    // 只缓存GET请求的某些类型的动态资源
    if (request.method !== 'GET') return false;
    
    const url = new URL(request.url);
    
    // 缓存API响应（有选择性）
    if (url.pathname.startsWith('/api/')) {
      // 只缓存读取操作，不缓存写入操作
      return !url.pathname.includes('/create') && 
             !url.pathname.includes('/update') && 
             !url.pathname.includes('/delete');
    }

    return false;
  }

  private async shouldPreloadResources(strategy: string): Promise<boolean> {
    switch (strategy) {
      case 'aggressive':
        return true;
      
      case 'conservative':
        // 只在WiFi连接时预加载
        const connection = (navigator as Navigator & { connection?: { type: string } })?.connection;
        return connection?.type === 'wifi' || !connection;
      
      case 'adaptive':
        // 根据网络质量和设备性能决定
        return this.isGoodNetworkCondition() && this.isGoodDevicePerformance();
      
      default:
        return false;
    }
  }

  private isGoodNetworkCondition(): boolean {
    const connection = (navigator as Navigator & { 
      connection?: { 
        effectiveType: string;
        downlink: number;
        rtt: number;
      }
    })?.connection;
    if (!connection) return true; // 假设网络良好

    return connection.effectiveType === '4g' && 
           connection.downlink > 2 && 
           connection.rtt < 300;
  }

  private isGoodDevicePerformance(): boolean {
    // 简单的设备性能检测
    const memory = (navigator as Navigator & { deviceMemory?: number })?.deviceMemory;
    const hardwareConcurrency = navigator.hardwareConcurrency;

    return (memory === undefined || memory >= 4) && 
           (hardwareConcurrency === undefined || hardwareConcurrency >= 4);
  }

  private async preloadResource(url: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (response.ok) {
        // 将预加载的资源放入适当的缓存
        const cache = await caches.open('preload-cache');
        await cache.put(url, response);
        console.log('PWAPerformanceManager: Preloaded resource:', url);
      }
    } catch (error) {
      console.warn('PWAPerformanceManager: Failed to preload resource:', url, error);
    }
  }

  private setupPerformanceMonitoring(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      console.warn('PWAPerformanceManager: PerformanceObserver not supported');
      return;
    }

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        this.processPerformanceEntries(list.getEntries());
      });

      // 监控各种性能指标
      this.performanceObserver.observe({ 
        entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] 
      });

      console.log('PWAPerformanceManager: Performance monitoring started');
    } catch (error) {
      console.error('PWAPerformanceManager: Failed to setup performance monitoring:', error);
    }
  }

  private processPerformanceEntries(entries: PerformanceEntry[]): void {
    entries.forEach((entry) => {
      switch (entry.entryType) {
        case 'paint':
          if (entry.name === 'first-contentful-paint') {
            this.metrics.fcp = entry.startTime;
          }
          break;

        case 'largest-contentful-paint':
          this.metrics.lcp = (entry as PerformancePaintTiming).startTime;
          break;

        case 'first-input':
          this.metrics.fid = (entry as PerformanceEventTiming).processingStart - entry.startTime;
          break;

        case 'layout-shift':
          this.metrics.cls += (entry as PerformanceEntry & { value: number }).value;
          break;
      }
    });

    // 记录性能指标
    console.log('PWAPerformanceManager: Updated performance metrics:', this.metrics);
  }

  private startMemoryManagement(): void {
    const { cleanupInterval } = this.config.performance;

    this.memoryCleanupTimer = setInterval(() => {
      this.performMemoryCleanup();
    }, cleanupInterval);

    console.log('PWAPerformanceManager: Memory management started');
  }

  private async performMemoryCleanup(): Promise<void> {
    try {
      // 检查内存使用
      this.updateMemoryMetrics();

      // 如果超过阈值，执行清理
      if (this.metrics.memoryUsage > this.config.performance.memoryThreshold) {
        console.log('PWAPerformanceManager: Memory threshold exceeded, performing cleanup');
        await this.forceMemoryCleanup();
      }
    } catch (error) {
      console.error('PWAPerformanceManager: Error during memory cleanup:', error);
    }
  }

  private updateMemoryMetrics(): void {
    if ('memory' in performance) {
      const memory = (performance as Performance & {
        memory: {
          usedJSHeapSize: number;
        }
      }).memory;
      this.metrics.memoryUsage = memory.usedJSHeapSize / (1024 * 1024); // MB
    }
  }

  private async cleanupExpiredCaches(): Promise<void> {
    const cacheNames = await caches.keys();
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7天

    for (const cacheName of cacheNames) {
      if (cacheName.includes('temp-') || cacheName.includes('old-')) {
        // 清理临时和旧版本缓存
        await caches.delete(cacheName);
        console.log('PWAPerformanceManager: Deleted expired cache:', cacheName);
      }
    }
  }

  private async cleanupUnusedResources(): Promise<void> {
    // 清理未使用的预加载缓存
    const preloadCache = await caches.open('preload-cache');
    const requests = await preloadCache.keys();
    
    // 清理超过一定时间未访问的预加载资源
    for (const request of requests) {
      // 这里可以添加更复杂的清理逻辑
      // 比如基于访问时间、重要性等
    }
  }
}

// 性能工具函数
export const PerformanceUtils = {
  /**
   * 测量关键渲染路径性能
   */
  measureCriticalPath(): Promise<PerformanceMetrics> {
    return new Promise((resolve) => {
      // 等待所有关键指标收集完成
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paint = performance.getEntriesByType('paint');
        
        const fcp = paint.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0;
        const ttfb = navigation?.responseStart - navigation?.requestStart || 0;

        resolve({
          fcp,
          lcp: 0, // 需要通过PerformanceObserver获取
          fid: 0, // 需要通过PerformanceObserver获取
          cls: 0, // 需要通过PerformanceObserver获取
          ttfb,
          memoryUsage: 0,
          cacheHitRate: 0
        });
      }, 3000);
    });
  },

  /**
   * 检查是否达到性能目标
   */
  checkPerformanceTargets(metrics: PerformanceMetrics, targets: PWAPerformanceConfig['performance']): {
    fcpPassed: boolean;
    lcpPassed: boolean;
    overall: boolean;
  } {
    const fcpPassed = metrics.fcp <= targets.targetFCP;
    const lcpPassed = metrics.lcp <= targets.targetLCP;
    
    return {
      fcpPassed,
      lcpPassed,
      overall: fcpPassed && lcpPassed
    };
  }
};