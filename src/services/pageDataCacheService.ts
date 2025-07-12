import { RecordId } from 'surrealdb';
import { dataService } from './dataService';

/**
 * 页面数据缓存配置
 */
export interface PageCacheConfig {
  pagePath: string; // 页面路径
  requiredTables: string[]; // 需要缓存的表
  cacheStrategy: 'aggressive' | 'conservative' | 'custom'; // 缓存策略
  maxAge: number; // 最大缓存时间（毫秒）
  preloadQueries?: PagePreloadQuery[]; // 预加载查询
  dependencies?: string[]; // 依赖的其他页面缓存
}

/**
 * 预加载查询配置
 */
export interface PagePreloadQuery {
  table: string;
  query: string;
  params?: Record<string, any>;
  priority: 'high' | 'medium' | 'low';
}

/**
 * 页面缓存状态
 */
export interface PageCacheStatus {
  pagePath: string;
  isActive: boolean;
  subscribedTables: string[];
  lastSyncTime: number;
  dataCount: Record<string, number>;
}

/**
 * 页面数据缓存服务
 * 
 * 负责管理页面级别的数据缓存逻辑，包括：
 * - 页面进入时自动订阅相关数据表
 * - 页面离开时自动取消订阅
 * - 智能预加载策略
 * - 缓存依赖管理
 */
export class PageDataCacheService {
  private activeCaches = new Map<string, PageCacheStatus>();
  private cacheConfigs = new Map<string, PageCacheConfig>();
  private subscriptionCallbacks = new Map<string, () => void>();
  
  /**
   * 注册页面缓存配置
   */
  registerPageCache(config: PageCacheConfig): void {
    console.log('PageDataCacheService: Registering page cache config:', config.pagePath);
    
    this.cacheConfigs.set(config.pagePath, config);
    
    // 注册预定义的页面缓存配置
    this.registerPredefinedConfigs();
  }
  
  /**
   * 注册预定义的页面缓存配置
   */
  private registerPredefinedConfigs(): void {
    // 案件列表页面
    this.cacheConfigs.set('/cases', {
      pagePath: '/cases',
      requiredTables: ['cases', 'case_status', 'case_types'],
      cacheStrategy: 'aggressive',
      maxAge: 10 * 60 * 1000, // 10分钟
      preloadQueries: [
        {
          table: 'cases',
          query: 'SELECT * FROM cases WHERE status != "archived" ORDER BY created_at DESC LIMIT 100',
          priority: 'high'
        },
        {
          table: 'case_status',
          query: 'SELECT * FROM case_status WHERE is_active = true',
          priority: 'medium'
        }
      ]
    });
    
    // 案件详情页面
    this.cacheConfigs.set('/cases/:id', {
      pagePath: '/cases/:id',
      requiredTables: ['cases', 'claims', 'creditors', 'attachments', 'case_activities'],
      cacheStrategy: 'aggressive',
      maxAge: 5 * 60 * 1000, // 5分钟
      preloadQueries: [
        {
          table: 'claims',
          query: 'SELECT * FROM claims WHERE case_id = $case_id ORDER BY created_at DESC',
          priority: 'high'
        },
        {
          table: 'creditors',
          query: 'SELECT * FROM creditors WHERE case_id = $case_id ORDER BY name ASC',
          priority: 'high'
        },
        {
          table: 'attachments',
          query: 'SELECT * FROM attachments WHERE case_id = $case_id ORDER BY created_at DESC LIMIT 50',
          priority: 'medium'
        }
      ]
    });
    
    // 债权人管理页面
    this.cacheConfigs.set('/creditors', {
      pagePath: '/creditors',
      requiredTables: ['creditors', 'creditor_types', 'creditor_status'],
      cacheStrategy: 'conservative',
      maxAge: 15 * 60 * 1000, // 15分钟
      preloadQueries: [
        {
          table: 'creditors',
          query: 'SELECT * FROM creditors WHERE case_id = $case_id ORDER BY name ASC',
          priority: 'high'
        }
      ]
    });
    
    // 文档管理页面
    this.cacheConfigs.set('/documents', {
      pagePath: '/documents',
      requiredTables: ['attachments', 'document_types', 'document_status'],
      cacheStrategy: 'conservative',
      maxAge: 20 * 60 * 1000, // 20分钟
      preloadQueries: [
        {
          table: 'attachments',
          query: 'SELECT * FROM attachments WHERE case_id = $case_id ORDER BY created_at DESC LIMIT 100',
          priority: 'high'
        }
      ]
    });
    
    // 仪表盘页面
    this.cacheConfigs.set('/dashboard', {
      pagePath: '/dashboard',
      requiredTables: ['cases', 'claims', 'creditors', 'case_activities', 'user_stats'],
      cacheStrategy: 'aggressive',
      maxAge: 5 * 60 * 1000, // 5分钟
      preloadQueries: [
        {
          table: 'cases',
          query: 'SELECT * FROM cases WHERE status IN ["active", "pending"] ORDER BY updated_at DESC LIMIT 20',
          priority: 'high'
        },
        {
          table: 'case_activities',
          query: 'SELECT * FROM case_activities ORDER BY created_at DESC LIMIT 50',
          priority: 'medium'
        }
      ]
    });
  }
  
  /**
   * 页面进入时激活缓存
   */
  async activatePageCache(
    pagePath: string,
    userId: string,
    caseId?: string,
    customConfig?: Partial<PageCacheConfig>
  ): Promise<void> {
    console.log('PageDataCacheService: Activating page cache for:', pagePath);
    
    // 获取页面缓存配置
    const config = this.getPageCacheConfig(pagePath, customConfig);
    if (!config) {
      console.warn('PageDataCacheService: No cache config found for page:', pagePath);
      return;
    }
    
    // 检查是否已经激活
    if (this.activeCaches.has(pagePath)) {
      console.log('PageDataCacheService: Page cache already active for:', pagePath);
      return;
    }
    
    try {
      // 订阅页面数据
      await this.subscribePageData(config, userId, caseId);
      
      // 记录激活状态
      this.activeCaches.set(pagePath, {
        pagePath,
        isActive: true,
        subscribedTables: config.requiredTables,
        lastSyncTime: Date.now(),
        dataCount: {}
      });
      
      // 执行预加载
      await this.preloadPageData(config, userId, caseId);
      
      console.log('PageDataCacheService: Page cache activated successfully for:', pagePath);
      
    } catch (error) {
      console.error('PageDataCacheService: Error activating page cache:', error);
      throw error;
    }
  }
  
  /**
   * 页面离开时停用缓存
   */
  async deactivatePageCache(pagePath: string, userId: string, caseId?: string): Promise<void> {
    console.log('PageDataCacheService: Deactivating page cache for:', pagePath);
    
    const cacheStatus = this.activeCaches.get(pagePath);
    if (!cacheStatus) {
      console.log('PageDataCacheService: No active cache found for page:', pagePath);
      return;
    }
    
    try {
      // 取消订阅页面数据
      await this.unsubscribePageData(cacheStatus.subscribedTables, userId, caseId);
      
      // 移除激活状态
      this.activeCaches.delete(pagePath);
      
      // 清理订阅回调
      const callbackKey = `${pagePath}_${userId}_${caseId || 'global'}`;
      if (this.subscriptionCallbacks.has(callbackKey)) {
        this.subscriptionCallbacks.get(callbackKey)?.();
        this.subscriptionCallbacks.delete(callbackKey);
      }
      
      console.log('PageDataCacheService: Page cache deactivated successfully for:', pagePath);
      
    } catch (error) {
      console.error('PageDataCacheService: Error deactivating page cache:', error);
      throw error;
    }
  }
  
  /**
   * 获取页面缓存配置
   */
  private getPageCacheConfig(
    pagePath: string,
    customConfig?: Partial<PageCacheConfig>
  ): PageCacheConfig | null {
    // 首先尝试精确匹配
    let config = this.cacheConfigs.get(pagePath);
    
    // 如果没有精确匹配，尝试模式匹配
    if (!config) {
      for (const [configPath, configData] of this.cacheConfigs.entries()) {
        if (this.matchPagePath(configPath, pagePath)) {
          config = configData;
          break;
        }
      }
    }
    
    // 如果还没有找到，创建默认配置
    if (!config) {
      config = {
        pagePath,
        requiredTables: [],
        cacheStrategy: 'conservative',
        maxAge: 10 * 60 * 1000 // 10分钟
      };
    }
    
    // 合并自定义配置
    if (customConfig) {
      config = { ...config, ...customConfig };
    }
    
    return config;
  }
  
  /**
   * 页面路径匹配
   */
  private matchPagePath(configPath: string, actualPath: string): boolean {
    // 简单的路径匹配逻辑
    if (configPath === actualPath) return true;
    
    // 处理动态路径参数，如 /cases/:id
    const configParts = configPath.split('/');
    const actualParts = actualPath.split('/');
    
    if (configParts.length !== actualParts.length) return false;
    
    return configParts.every((part, index) => {
      return part.startsWith(':') || part === actualParts[index];
    });
  }
  
  /**
   * 订阅页面数据
   */
  private async subscribePageData(
    config: PageCacheConfig,
    userId: string,
    caseId?: string
  ): Promise<void> {
    if (config.requiredTables.length === 0) return;
    
    // 发送订阅消息到Service Worker
    await this.sendMessageToServiceWorker('subscribe_page_data', {
      tables: config.requiredTables,
      userId,
      caseId: caseId || null,
      config: {
        type: 'temporary',
        enableLiveQuery: true,
        enableIncrementalSync: true,
        syncInterval: this.getSyncInterval(config.cacheStrategy),
        expirationMs: config.maxAge
      }
    });
  }
  
  /**
   * 取消订阅页面数据
   */
  private async unsubscribePageData(
    tables: string[],
    userId: string,
    caseId?: string
  ): Promise<void> {
    if (tables.length === 0) return;
    
    // 发送取消订阅消息到Service Worker
    await this.sendMessageToServiceWorker('unsubscribe_page_data', {
      tables,
      userId,
      caseId: caseId || null
    });
  }
  
  /**
   * 预加载页面数据
   */
  private async preloadPageData(
    config: PageCacheConfig,
    userId: string,
    caseId?: string
  ): Promise<void> {
    if (!config.preloadQueries || config.preloadQueries.length === 0) return;
    
    console.log('PageDataCacheService: Preloading data for page:', config.pagePath);
    
    // 按优先级排序
    const sortedQueries = [...config.preloadQueries].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    // 执行预加载查询
    for (const queryConfig of sortedQueries) {
      try {
        const params = {
          ...queryConfig.params,
          user_id: userId,
          case_id: caseId || null
        };
        
        // 直接执行查询并缓存结果
        const result = await dataService.query(queryConfig.query, params);
        
        // 通知Service Worker缓存数据
        await this.sendMessageToServiceWorker('cache_query_result', {
          table: queryConfig.table,
          query: queryConfig.query,
          params,
          result,
          userId,
          caseId: caseId || null
        });
        
        console.log(`PageDataCacheService: Preloaded ${result.length} records for table: ${queryConfig.table}`);
        
      } catch (error) {
        console.error(`PageDataCacheService: Error preloading data for table ${queryConfig.table}:`, error);
      }
    }
  }
  
  /**
   * 获取同步间隔
   */
  private getSyncInterval(strategy: 'aggressive' | 'conservative' | 'custom'): number {
    switch (strategy) {
      case 'aggressive':
        return 15 * 1000; // 15秒
      case 'conservative':
        return 2 * 60 * 1000; // 2分钟
      case 'custom':
      default:
        return 30 * 1000; // 30秒
    }
  }
  
  /**
   * 获取活跃的页面缓存状态
   */
  getActiveCacheStatus(): PageCacheStatus[] {
    return Array.from(this.activeCaches.values());
  }
  
  /**
   * 检查页面缓存是否活跃
   */
  isPageCacheActive(pagePath: string): boolean {
    return this.activeCaches.has(pagePath);
  }
  
  /**
   * 清除页面缓存
   */
  async clearPageCache(pagePath: string, userId: string, caseId?: string): Promise<void> {
    const cacheStatus = this.activeCaches.get(pagePath);
    if (!cacheStatus) return;
    
    try {
      // 清除相关表的缓存
      await Promise.all(
        cacheStatus.subscribedTables.map(table => 
          this.sendMessageToServiceWorker('clear_table_cache', {
            table,
            userId,
            caseId: caseId || null
          })
        )
      );
      
      console.log('PageDataCacheService: Cleared cache for page:', pagePath);
      
    } catch (error) {
      console.error('PageDataCacheService: Error clearing page cache:', error);
      throw error;
    }
  }
  
  /**
   * 发送消息到Service Worker
   */
  private async sendMessageToServiceWorker(type: string, payload: any): Promise<any> {
    // 使用统一的Service Worker客户端
    const { surrealServiceWorkerClient } = await import('../lib/surrealServiceWorkerClient');
    
    if (!surrealServiceWorkerClient.isServiceWorkerAvailable()) {
      console.warn('PageDataCacheService: Service Worker not available');
      return Promise.resolve({ success: true });
    }
    
    try {
      await surrealServiceWorkerClient.waitForReady();
      return await surrealServiceWorkerClient.sendGenericMessage(type, payload);
    } catch (error) {
      console.error('PageDataCacheService: Service Worker communication error:', error);
      throw error;
    }
  }
}

export const pageDataCacheService = new PageDataCacheService();