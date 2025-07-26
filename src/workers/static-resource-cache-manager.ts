/// <reference lib="WebWorker" />

/**
 * 静态资源缓存管理器
 * 
 * 负责管理应用的静态资源缓存，包括：
 * - App Shell 资源（HTML、CSS、JS）
 * - 静态资源（图片、字体、图标）
 * - Manifest 文件
 * - WASM 文件
 */

export interface CacheStrategy {
  name: string;
  version: string;
  resources: string[];
  maxAge: number; // 毫秒
  updateStrategy: 'immediate' | 'background' | 'manual';
}

export interface CachedResource {
  url: string;
  cachedAt: Date;
  size: number;
  mimeType: string;
  etag?: string;
}

export interface CacheMetadata {
  name: string;
  version: string;
  createdAt: Date;
  lastAccessed: Date;
  size: number;
  resources: CachedResource[];
}

// 预定义的缓存策略
export const CACHE_STRATEGIES: CacheStrategy[] = [
  {
    name: 'app-shell',
    version: 'v1.0.0',
    resources: [
      '/',
      '/index.html',
      '/static/css/main.css',
      '/static/js/main.js',
      '/manifest.json',
      '/assets/logo/favicon.svg',
      '/assets/logo/cuckoo-icon.svg',
      '/assets/logo/cuckoo-logo-main.svg'
    ],
    maxAge: 86400000, // 24小时
    updateStrategy: 'background'
  },
  {
    name: 'static-assets',
    version: 'v1.0.0',
    resources: [
      '/static/fonts/',
      '/static/media/',
      '/favicon.ico'
    ],
    maxAge: 604800000, // 7天
    updateStrategy: 'manual'
  },
  {
    name: 'wasm-resources',
    version: 'v1.0.0',
    resources: [
      'https://unpkg.com/@surrealdb/wasm@1.4.1/dist/surreal/index_bg.wasm'
    ],
    maxAge: 2592000000, // 30天
    updateStrategy: 'manual'
  }
];

export class StaticResourceCacheManager {
  private cacheStrategies: Map<string, CacheStrategy> = new Map();
  private cacheMetadata: Map<string, CacheMetadata> = new Map();
  private maxTotalCacheSize = 100 * 1024 * 1024; // 100MB

  constructor() {
    // 初始化预定义的缓存策略
    CACHE_STRATEGIES.forEach(strategy => {
      this.cacheStrategies.set(strategy.name, strategy);
    });
  }

  /**
   * 初始化缓存管理器
   */
  async initialize(): Promise<void> {
    console.log('StaticResourceCacheManager: Initializing...');
    
    try {
      // 加载现有缓存的元数据
      await this.loadCacheMetadata();
      
      // 清理过期缓存
      await this.cleanupExpiredCaches();
      
      console.log('StaticResourceCacheManager: Initialized successfully');
    } catch (error) {
      console.error('StaticResourceCacheManager: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * 缓存静态资源
   */
  async cacheStaticResources(strategyName: string): Promise<void> {
    const strategy = this.cacheStrategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Cache strategy not found: ${strategyName}`);
    }

    const cacheName = this.getCacheName(strategy);
    const cache = await caches.open(cacheName);
    const cachedResources: CachedResource[] = [];

    console.log(`StaticResourceCacheManager: Caching resources for strategy: ${strategyName}`);

    try {
      for (const resourceUrl of strategy.resources) {
        try {
          // 处理通配符路径
          if (resourceUrl.endsWith('/')) {
            await this.cacheDirectory(cache, resourceUrl, cachedResources);
          } else {
            await this.cacheResource(cache, resourceUrl, cachedResources);
          }
        } catch (error) {
          console.warn(`StaticResourceCacheManager: Failed to cache resource: ${resourceUrl}`, error);
          // 继续缓存其他资源，不因单个资源失败而中断
        }
      }

      // 更新缓存元数据
      const metadata: CacheMetadata = {
        name: strategy.name,
        version: strategy.version,
        createdAt: new Date(),
        lastAccessed: new Date(),
        size: cachedResources.reduce((total, resource) => total + resource.size, 0),
        resources: cachedResources
      };

      this.cacheMetadata.set(cacheName, metadata);
      await this.saveCacheMetadata();

      console.log(`StaticResourceCacheManager: Successfully cached ${cachedResources.length} resources for ${strategyName}`);
    } catch (error) {
      console.error(`StaticResourceCacheManager: Error caching resources for ${strategyName}:`, error);
      throw error;
    }
  }

  /**
   * 处理 fetch 请求
   */
  async handleFetch(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    
    // 只处理同源请求或预定义的外部资源
    if (!this.shouldHandleRequest(request)) {
      return null;
    }

    try {
      // 先尝试从缓存获取
      const cachedResponse = await this.getCachedResponse(request);
      if (cachedResponse) {
        console.log(`StaticResourceCacheManager: Serving from cache: ${request.url}`);
        return cachedResponse;
      }

      // 缓存未命中，从网络获取
      console.log(`StaticResourceCacheManager: Cache miss, fetching from network: ${request.url}`);
      const networkResponse = await fetch(request);
      
      // 缓存响应（如果合适）
      if (networkResponse.ok && this.shouldCacheResponse(request, networkResponse)) {
        await this.cacheResponse(request, networkResponse.clone());
      }

      return networkResponse;
    } catch (error) {
      console.error(`StaticResourceCacheManager: Error handling fetch for ${request.url}:`, error);
      
      // 网络失败时尝试从缓存获取
      const cachedResponse = await this.getCachedResponse(request);
      if (cachedResponse) {
        console.log(`StaticResourceCacheManager: Serving stale cache due to network error: ${request.url}`);
        return cachedResponse;
      }
      
      throw error;
    }
  }

  /**
   * 更新缓存
   */
  async updateCache(strategyName: string): Promise<void> {
    const strategy = this.cacheStrategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Cache strategy not found: ${strategyName}`);
    }

    console.log(`StaticResourceCacheManager: Updating cache for strategy: ${strategyName}`);

    if (strategy.updateStrategy === 'immediate') {
      // 立即更新
      await this.cacheStaticResources(strategyName);
    } else if (strategy.updateStrategy === 'background') {
      // 后台更新
      setTimeout(() => {
        this.cacheStaticResources(strategyName).catch(error => {
          console.error(`StaticResourceCacheManager: Background update failed for ${strategyName}:`, error);
        });
      }, 1000);
    }
    // manual 策略不自动更新
  }

  /**
   * 清理旧缓存
   */
  async clearOldCaches(): Promise<void> {
    console.log('StaticResourceCacheManager: Clearing old caches...');

    try {
      const cacheNames = await caches.keys();
      const currentCacheNames = new Set(
        Array.from(this.cacheStrategies.values()).map(strategy => this.getCacheName(strategy))
      );

      const oldCacheNames = cacheNames.filter(name => 
        name.startsWith('cuckoox-static-') && !currentCacheNames.has(name)
      );

      await Promise.all(
        oldCacheNames.map(async cacheName => {
          await caches.delete(cacheName);
          this.cacheMetadata.delete(cacheName);
          console.log(`StaticResourceCacheManager: Deleted old cache: ${cacheName}`);
        })
      );

      if (oldCacheNames.length > 0) {
        await this.saveCacheMetadata();
      }

      console.log(`StaticResourceCacheManager: Cleared ${oldCacheNames.length} old caches`);
    } catch (error) {
      console.error('StaticResourceCacheManager: Error clearing old caches:', error);
    }
  }

  /**
   * 获取缓存状态信息
   */
  getCacheStatus(): { [key: string]: CacheMetadata } {
    const status: { [key: string]: CacheMetadata } = {};
    this.cacheMetadata.forEach((metadata, cacheName) => {
      status[cacheName] = { ...metadata };
    });
    return status;
  }

  // 私有方法

  private getCacheName(strategy: CacheStrategy): string {
    return `cuckoox-static-${strategy.name}-${strategy.version}`;
  }

  private shouldHandleRequest(request: Request): boolean {
    const url = new URL(request.url);
    
    // 处理同源请求
    if (url.origin === self.location.origin) {
      return true;
    }
    
    // 处理预定义的外部资源
    const externalResources = ['unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
    return externalResources.some(domain => url.hostname.includes(domain));
  }

  private shouldCacheResponse(request: Request, response: Response): boolean {
    // 只缓存成功的 GET 请求
    if (request.method !== 'GET' || !response.ok) {
      return false;
    }

    const contentType = response.headers.get('content-type') || '';
    const cacheableTypes = [
      'text/html',
      'text/css',
      'application/javascript',
      'application/json',
      'image/',
      'font/',
      'application/wasm'
    ];

    return cacheableTypes.some(type => contentType.includes(type));
  }

  private async getCachedResponse(request: Request): Promise<Response | null> {
    // 按优先级检查各个缓存
    for (const strategy of this.cacheStrategies.values()) {
      const cacheName = this.getCacheName(strategy);
      const cache = await caches.open(cacheName);
      const response = await cache.match(request);
      
      if (response) {
        // 更新访问时间
        this.updateAccessTime(cacheName);
        return response;
      }
    }

    return null;
  }

  private async cacheResponse(request: Request, response: Response): Promise<void> {
    // 确定使用哪个缓存策略
    let targetStrategy: CacheStrategy | null = null;
    const url = new URL(request.url);

    for (const strategy of this.cacheStrategies.values()) {
      if (this.matchesStrategy(url.pathname, strategy)) {
        targetStrategy = strategy;
        break;
      }
    }

    if (!targetStrategy) {
      return; // 不匹配任何策略，不缓存
    }

    const cacheName = this.getCacheName(targetStrategy);
    const cache = await caches.open(cacheName);
    await cache.put(request, response);

    console.log(`StaticResourceCacheManager: Cached response: ${request.url}`);
  }

  private matchesStrategy(pathname: string, strategy: CacheStrategy): boolean {
    return strategy.resources.some(pattern => {
      if (pattern.endsWith('/')) {
        return pathname.startsWith(pattern);
      }
      return pathname === pattern || pathname.endsWith(pattern);
    });
  }

  private async cacheResource(cache: Cache, resourceUrl: string, cachedResources: CachedResource[]): Promise<void> {
    try {
      const response = await fetch(resourceUrl);
      if (response.ok) {
        const clonedResponse = response.clone();
        await cache.put(resourceUrl, response);
        
        const size = parseInt(clonedResponse.headers.get('content-length') || '0');
        cachedResources.push({
          url: resourceUrl,
          cachedAt: new Date(),
          size,
          mimeType: clonedResponse.headers.get('content-type') || 'unknown',
          etag: clonedResponse.headers.get('etag') || undefined
        });
      }
    } catch (error) {
      console.warn(`StaticResourceCacheManager: Failed to cache resource: ${resourceUrl}`, error);
    }
  }

  private async cacheDirectory(cache: Cache, directoryUrl: string, cachedResources: CachedResource[]): Promise<void> {
    // 对于目录，我们暂时跳过，因为无法枚举目录内容
    // 在实际使用中，这些应该被具体的文件路径替换
    console.log(`StaticResourceCacheManager: Skipping directory pattern: ${directoryUrl}`);
  }

  private updateAccessTime(cacheName: string): void {
    const metadata = this.cacheMetadata.get(cacheName);
    if (metadata) {
      metadata.lastAccessed = new Date();
    }
  }

  private async loadCacheMetadata(): Promise<void> {
    // 这里可以从 IndexedDB 或其他持久化存储加载元数据
    // 暂时使用内存存储，重启后会丢失
    console.log('StaticResourceCacheManager: Loading cache metadata from memory');
  }

  private async saveCacheMetadata(): Promise<void> {
    // 这里可以将元数据保存到 IndexedDB 或其他持久化存储
    // 暂时使用内存存储
    console.log('StaticResourceCacheManager: Saving cache metadata to memory');
  }

  private async cleanupExpiredCaches(): Promise<void> {
    const now = Date.now();
    const expiredCaches: string[] = [];

    for (const [cacheName, metadata] of this.cacheMetadata) {
      const strategy = Array.from(this.cacheStrategies.values()).find(s => 
        this.getCacheName(s) === cacheName
      );
      
      if (strategy && now - metadata.lastAccessed.getTime() > strategy.maxAge) {
        expiredCaches.push(cacheName);
      }
    }

    // 清理过期缓存
    for (const cacheName of expiredCaches) {
      await caches.delete(cacheName);
      this.cacheMetadata.delete(cacheName);
      console.log(`StaticResourceCacheManager: Cleaned up expired cache: ${cacheName}`);
    }

    // LRU 清理：如果总缓存大小超出限制
    await this.cleanupLRU();
  }

  private async cleanupLRU(): Promise<void> {
    const totalSize = Array.from(this.cacheMetadata.values()).reduce(
      (sum, metadata) => sum + metadata.size, 0
    );

    if (totalSize > this.maxTotalCacheSize) {
      // 按最后访问时间排序
      const sortedCaches = Array.from(this.cacheMetadata.entries()).sort(
        ([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime()
      );

      let currentSize = totalSize;
      for (const [cacheName, metadata] of sortedCaches) {
        if (currentSize <= this.maxTotalCacheSize * 0.8) { // 清理到80%
          break;
        }

        await caches.delete(cacheName);
        this.cacheMetadata.delete(cacheName);
        currentSize -= metadata.size;
        
        console.log(`StaticResourceCacheManager: LRU cleanup removed cache: ${cacheName}`);
      }
    }
  }
}