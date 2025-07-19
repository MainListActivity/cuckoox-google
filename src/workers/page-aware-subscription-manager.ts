import { SubscriptionManager, SubscriptionType, SubscriptionStrategy } from './subscription-manager';
import { DataCacheManager } from './data-cache-manager';
import type { Surreal } from 'surrealdb';

/**
 * 页面数据需求配置
 */
export interface PageDataRequirement {
  pagePath: string;                    // 页面路径（支持参数，如 /cases/:id）
  requiredTables: string[];           // 必需的数据表
  optionalTables?: string[];          // 可选的数据表
  cacheStrategy: 'aggressive' | 'conservative' | 'custom'; // 缓存策略
  subscriptionPriority: number;       // 订阅优先级 1-10
  preloadQueries?: PagePreloadQuery[]; // 预加载查询
  dependencies?: string[];            // 依赖的其他页面
  conditions?: PageSubscriptionCondition[]; // 订阅条件
}

/**
 * 页面预加载查询
 */
export interface PagePreloadQuery {
  table: string;
  query: string;
  params?: Record<string, any>;
  priority: 'high' | 'medium' | 'low';
  cacheType: 'persistent' | 'temporary';
}

/**
 * 页面订阅条件
 */
export interface PageSubscriptionCondition {
  table: string;
  condition: string;              // SQL WHERE 条件
  params?: Record<string, any>;   // 条件参数
}

/**
 * 活跃页面订阅信息
 */
export interface ActivePageSubscription {
  pageId: string;                 // 页面唯一标识
  pagePath: string;              // 页面路径
  userId: string;                // 用户ID
  caseId?: string;               // 案件ID
  requirement: PageDataRequirement; // 页面数据需求
  subscriptionIds: string[];     // 关联的订阅ID列表
  activatedAt: number;           // 激活时间
  lastAccessTime: number;        // 最后访问时间
  isActive: boolean;             // 是否活跃
  preloadStatus: Record<string, 'pending' | 'completed' | 'failed'>; // 预加载状态
}

/**
 * 订阅合并信息
 */
export interface SubscriptionMergeInfo {
  table: string;
  mergedSubscriptionId: string;
  sourcePageIds: string[];
  strategy: SubscriptionStrategy;
  referenceCount: number;
}

/**
 * 页面感知自动订阅管理器
 * 
 * 负责管理页面级别的数据订阅，包括：
 * - 页面进入时自动订阅相关数据表
 * - 页面离开时自动取消订阅
 * - 多页面订阅合并和去重
 * - 订阅状态跟踪和调试
 */
export class PageAwareSubscriptionManager {
  private subscriptionManager: SubscriptionManager;
  private dataCacheManager: DataCacheManager;
  private broadcastToAllClients: (message: Record<string, unknown>) => Promise<void>;

  // 页面数据需求配置
  private pageRequirements = new Map<string, PageDataRequirement>();
  
  // 活跃页面订阅
  private activePageSubscriptions = new Map<string, ActivePageSubscription>();
  
  // 订阅合并管理
  private mergedSubscriptions = new Map<string, SubscriptionMergeInfo>();
  
  // 调试和统计
  private subscriptionStats = {
    totalPages: 0,
    activePages: 0,
    totalSubscriptions: 0,
    mergedSubscriptions: 0,
    preloadQueries: 0,
    lastCleanupTime: 0
  };

  constructor(
    subscriptionManager: SubscriptionManager,
    dataCacheManager: DataCacheManager,
    broadcastToAllClients: (message: Record<string, unknown>) => Promise<void>
  ) {
    this.subscriptionManager = subscriptionManager;
    this.dataCacheManager = dataCacheManager;
    this.broadcastToAllClients = broadcastToAllClients;
    
    // 注册预定义的页面数据需求
    this.registerPredefinedPageRequirements();
    
    // 启动清理任务
    this.startCleanupTask();
  }

  /**
   * 注册预定义的页面数据需求配置
   */
  private registerPredefinedPageRequirements(): void {
    // 案件列表页面
    this.registerPageRequirement({
      pagePath: '/cases',
      requiredTables: ['case', 'case_status', 'case_types'],
      optionalTables: ['user', 'has_case_role'],
      cacheStrategy: 'aggressive',
      subscriptionPriority: 8,
      preloadQueries: [
        {
          table: 'case',
          query: 'SELECT * FROM case WHERE status != "archived" ORDER BY created_at DESC LIMIT 100',
          priority: 'high',
          cacheType: 'temporary'
        },
        {
          table: 'case_status',
          query: 'SELECT * FROM case_status WHERE is_active = true',
          priority: 'medium',
          cacheType: 'persistent'
        }
      ],
      conditions: [
        {
          table: 'case',
          condition: 'status != "archived"'
        }
      ]
    });

    // 案件详情页面
    this.registerPageRequirement({
      pagePath: '/cases/:id',
      requiredTables: ['case', 'claim', 'creditor', 'attachment'],
      optionalTables: ['case_activity', 'case_member'],
      cacheStrategy: 'aggressive',
      subscriptionPriority: 9,
      preloadQueries: [
        {
          table: 'claim',
          query: 'SELECT * FROM claim WHERE case_id = $case_id ORDER BY created_at DESC',
          priority: 'high',
          cacheType: 'temporary'
        },
        {
          table: 'creditor',
          query: 'SELECT * FROM creditor WHERE case_id = $case_id ORDER BY name ASC',
          priority: 'high',
          cacheType: 'temporary'
        },
        {
          table: 'attachment',
          query: 'SELECT * FROM attachment WHERE case_id = $case_id ORDER BY created_at DESC LIMIT 50',
          priority: 'medium',
          cacheType: 'temporary'
        }
      ],
      conditions: [
        {
          table: 'claim',
          condition: 'case_id = $case_id',
          params: { case_id: '$case_id' }
        },
        {
          table: 'creditor',
          condition: 'case_id = $case_id',
          params: { case_id: '$case_id' }
        }
      ]
    });

    // 债权人管理页面
    this.registerPageRequirement({
      pagePath: '/creditors',
      requiredTables: ['creditor', 'creditor_type'],
      optionalTables: ['claim'],
      cacheStrategy: 'conservative',
      subscriptionPriority: 7,
      preloadQueries: [
        {
          table: 'creditor',
          query: 'SELECT * FROM creditor WHERE case_id = $case_id ORDER BY name ASC',
          priority: 'high',
          cacheType: 'temporary'
        }
      ],
      conditions: [
        {
          table: 'creditor',
          condition: 'case_id = $case_id',
          params: { case_id: '$case_id' }
        }
      ]
    });

    // 仪表盘页面
    this.registerPageRequirement({
      pagePath: '/dashboard',
      requiredTables: ['case', 'claim', 'notification'],
      optionalTables: ['case_activity', 'user_stats'],
      cacheStrategy: 'aggressive',
      subscriptionPriority: 8,
      preloadQueries: [
        {
          table: 'case',
          query: 'SELECT * FROM case WHERE status IN ["active", "pending"] ORDER BY updated_at DESC LIMIT 20',
          priority: 'high',
          cacheType: 'temporary'
        },
        {
          table: 'notification',
          query: 'SELECT * FROM notification WHERE user_id = $user_id AND is_read = false ORDER BY created_at DESC LIMIT 50',
          priority: 'high',
          cacheType: 'temporary'
        }
      ],
      conditions: [
        {
          table: 'notification',
          condition: 'user_id = $user_id',
          params: { user_id: '$user_id' }
        }
      ]
    });

    // 消息中心页面
    this.registerPageRequirement({
      pagePath: '/messages',
      requiredTables: ['message', 'conversation'],
      optionalTables: ['user'],
      cacheStrategy: 'aggressive',
      subscriptionPriority: 9,
      preloadQueries: [
        {
          table: 'message',
          query: 'SELECT * FROM message WHERE (sender_id = $user_id OR receiver_id = $user_id) ORDER BY created_at DESC LIMIT 100',
          priority: 'high',
          cacheType: 'temporary'
        },
        {
          table: 'conversation',
          query: 'SELECT * FROM conversation WHERE participants CONTAINS $user_id ORDER BY last_message_at DESC',
          priority: 'high',
          cacheType: 'temporary'
        }
      ],
      conditions: [
        {
          table: 'message',
          condition: '(sender_id = $user_id OR receiver_id = $user_id)',
          params: { user_id: '$user_id' }
        },
        {
          table: 'conversation',
          condition: 'participants CONTAINS $user_id',
          params: { user_id: '$user_id' }
        }
      ]
    });

    // 我的债权页面
    this.registerPageRequirement({
      pagePath: '/my-claims',
      requiredTables: ['claim', 'attachment'],
      optionalTables: ['case', 'creditor'],
      cacheStrategy: 'conservative',
      subscriptionPriority: 7,
      preloadQueries: [
        {
          table: 'claim',
          query: 'SELECT * FROM claim WHERE creditor_id IN (SELECT id FROM creditor WHERE user_id = $user_id) ORDER BY created_at DESC',
          priority: 'high',
          cacheType: 'temporary'
        }
      ],
      conditions: [
        {
          table: 'claim',
          condition: 'creditor_id IN (SELECT id FROM creditor WHERE user_id = $user_id)',
          params: { user_id: '$user_id' }
        }
      ]
    });

    console.log('PageAwareSubscriptionManager: Registered predefined page requirements');
  }

  /**
   * 注册页面数据需求
   */
  registerPageRequirement(requirement: PageDataRequirement): void {
    this.pageRequirements.set(requirement.pagePath, requirement);
    console.log(`PageAwareSubscriptionManager: Registered page requirement for: ${requirement.pagePath}`);
  }

  /**
   * 激活页面订阅
   */
  async activatePageSubscription(
    pagePath: string,
    userId: string,
    caseId?: string,
    customRequirement?: Partial<PageDataRequirement>
  ): Promise<string> {
    const pageId = this.generatePageId(pagePath, userId, caseId);
    
    // 检查是否已经激活
    if (this.activePageSubscriptions.has(pageId)) {
      const existing = this.activePageSubscriptions.get(pageId)!;
      existing.lastAccessTime = Date.now();
      existing.isActive = true;
      console.log(`PageAwareSubscriptionManager: Page subscription already active: ${pageId}`);
      return pageId;
    }

    try {
      // 获取页面数据需求配置
      const requirement = this.getPageRequirement(pagePath, customRequirement);
      if (!requirement) {
        throw new Error(`No page requirement found for: ${pagePath}`);
      }

      console.log(`PageAwareSubscriptionManager: Activating page subscription for: ${pagePath}`);

      // 创建活跃页面订阅记录
      const pageSubscription: ActivePageSubscription = {
        pageId,
        pagePath,
        userId,
        caseId,
        requirement,
        subscriptionIds: [],
        activatedAt: Date.now(),
        lastAccessTime: Date.now(),
        isActive: true,
        preloadStatus: {}
      };

      // 订阅必需的数据表
      const subscriptionIds = await this.subscribeToTables(
        requirement.requiredTables,
        userId,
        caseId,
        requirement,
        pageId
      );
      pageSubscription.subscriptionIds.push(...subscriptionIds);

      // 订阅可选的数据表（如果配置了）
      if (requirement.optionalTables && requirement.optionalTables.length > 0) {
        try {
          const optionalSubscriptionIds = await this.subscribeToTables(
            requirement.optionalTables,
            userId,
            caseId,
            requirement,
            pageId
          );
          pageSubscription.subscriptionIds.push(...optionalSubscriptionIds);
        } catch (error) {
          console.warn(`PageAwareSubscriptionManager: Failed to subscribe to optional tables:`, error);
        }
      }

      // 记录活跃订阅
      this.activePageSubscriptions.set(pageId, pageSubscription);

      // 执行预加载查询
      await this.executePreloadQueries(pageSubscription);

      // 更新统计信息
      this.updateStats();

      // 广播页面订阅激活事件
      await this.broadcastToAllClients({
        type: 'page_subscription_activated',
        payload: {
          pageId,
          pagePath,
          userId,
          caseId,
          subscriptionCount: pageSubscription.subscriptionIds.length
        }
      });

      console.log(`PageAwareSubscriptionManager: Successfully activated page subscription: ${pageId}`);
      return pageId;

    } catch (error) {
      console.error(`PageAwareSubscriptionManager: Failed to activate page subscription for ${pagePath}:`, error);
      throw error;
    }
  }

  /**
   * 停用页面订阅
   */
  async deactivatePageSubscription(pageId: string): Promise<void> {
    const pageSubscription = this.activePageSubscriptions.get(pageId);
    if (!pageSubscription) {
      console.warn(`PageAwareSubscriptionManager: Page subscription not found: ${pageId}`);
      return;
    }

    try {
      console.log(`PageAwareSubscriptionManager: Deactivating page subscription: ${pageId}`);

      // 标记为非活跃
      pageSubscription.isActive = false;

      // 取消订阅（考虑合并情况）
      await this.unsubscribeFromTables(pageSubscription.subscriptionIds, pageId);

      // 移除活跃订阅记录
      this.activePageSubscriptions.delete(pageId);

      // 更新统计信息
      this.updateStats();

      // 广播页面订阅停用事件
      await this.broadcastToAllClients({
        type: 'page_subscription_deactivated',
        payload: {
          pageId,
          pagePath: pageSubscription.pagePath,
          userId: pageSubscription.userId,
          caseId: pageSubscription.caseId
        }
      });

      console.log(`PageAwareSubscriptionManager: Successfully deactivated page subscription: ${pageId}`);

    } catch (error) {
      console.error(`PageAwareSubscriptionManager: Failed to deactivate page subscription ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * 订阅数据表（支持合并）
   */
  private async subscribeToTables(
    tables: string[],
    userId: string,
    caseId: string | undefined,
    requirement: PageDataRequirement,
    pageId: string
  ): Promise<string[]> {
    const subscriptionIds: string[] = [];

    for (const table of tables) {
      try {
        // 检查是否可以合并订阅
        const mergeInfo = this.findMergeableSubscription(table, userId, caseId);
        
        if (mergeInfo) {
          // 使用现有的合并订阅
          mergeInfo.sourcePageIds.push(pageId);
          mergeInfo.referenceCount++;
          subscriptionIds.push(mergeInfo.mergedSubscriptionId);
          
          console.log(`PageAwareSubscriptionManager: Merged subscription for table ${table}: ${mergeInfo.mergedSubscriptionId}`);
        } else {
          // 创建新订阅
          const subscriptionStrategy = this.createSubscriptionStrategy(table, requirement);
          const subscriptionId = await this.subscriptionManager.subscribeToTable(
            table,
            userId,
            caseId,
            subscriptionStrategy
          );
          
          subscriptionIds.push(subscriptionId);

          // 检查是否需要创建合并记录
          if (this.shouldCreateMergedSubscription(table)) {
            this.mergedSubscriptions.set(`${table}_${userId}_${caseId || 'global'}`, {
              table,
              mergedSubscriptionId: subscriptionId,
              sourcePageIds: [pageId],
              strategy: subscriptionStrategy as SubscriptionStrategy,
              referenceCount: 1
            });
          }

          console.log(`PageAwareSubscriptionManager: Created new subscription for table ${table}: ${subscriptionId}`);
        }
      } catch (error) {
        console.error(`PageAwareSubscriptionManager: Failed to subscribe to table ${table}:`, error);
        // 继续处理其他表，不中断整个流程
      }
    }

    return subscriptionIds;
  }

  /**
   * 取消订阅数据表（考虑合并情况）
   */
  private async unsubscribeFromTables(subscriptionIds: string[], pageId: string): Promise<void> {
    for (const subscriptionId of subscriptionIds) {
      try {
        // 查找对应的合并信息
        const mergeInfo = Array.from(this.mergedSubscriptions.values()).find(
          info => info.mergedSubscriptionId === subscriptionId
        );

        if (mergeInfo) {
          // 从合并订阅中移除页面引用
          const pageIndex = mergeInfo.sourcePageIds.indexOf(pageId);
          if (pageIndex >= 0) {
            mergeInfo.sourcePageIds.splice(pageIndex, 1);
            mergeInfo.referenceCount--;
          }

          // 如果没有其他页面引用，则取消订阅
          if (mergeInfo.referenceCount <= 0) {
            await this.subscriptionManager.unsubscribe(subscriptionId);
            this.mergedSubscriptions.delete(`${mergeInfo.table}_${pageId.split('_')[1]}_${pageId.split('_')[2] || 'global'}`);
            console.log(`PageAwareSubscriptionManager: Unsubscribed merged subscription: ${subscriptionId}`);
          } else {
            console.log(`PageAwareSubscriptionManager: Kept merged subscription (${mergeInfo.referenceCount} references): ${subscriptionId}`);
          }
        } else {
          // 直接取消订阅
          await this.subscriptionManager.unsubscribe(subscriptionId);
          console.log(`PageAwareSubscriptionManager: Unsubscribed: ${subscriptionId}`);
        }
      } catch (error) {
        console.error(`PageAwareSubscriptionManager: Failed to unsubscribe ${subscriptionId}:`, error);
      }
    }
  }

  /**
   * 执行预加载查询
   */
  private async executePreloadQueries(pageSubscription: ActivePageSubscription): Promise<void> {
    const { requirement, userId, caseId } = pageSubscription;
    
    if (!requirement.preloadQueries || requirement.preloadQueries.length === 0) {
      return;
    }

    console.log(`PageAwareSubscriptionManager: Executing preload queries for page: ${pageSubscription.pagePath}`);

    // 按优先级排序
    const sortedQueries = [...requirement.preloadQueries].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // 并行执行高优先级查询，串行执行其他查询
    const highPriorityQueries = sortedQueries.filter(q => q.priority === 'high');
    const otherQueries = sortedQueries.filter(q => q.priority !== 'high');

    // 执行高优先级查询
    if (highPriorityQueries.length > 0) {
      await Promise.allSettled(
        highPriorityQueries.map(query => this.executePreloadQuery(query, userId, caseId, pageSubscription))
      );
    }

    // 串行执行其他查询
    for (const query of otherQueries) {
      try {
        await this.executePreloadQuery(query, userId, caseId, pageSubscription);
      } catch (error) {
        console.warn(`PageAwareSubscriptionManager: Preload query failed for table ${query.table}:`, error);
      }
    }

    this.subscriptionStats.preloadQueries += requirement.preloadQueries.length;
  }

  /**
   * 执行单个预加载查询
   */
  private async executePreloadQuery(
    query: PagePreloadQuery,
    userId: string,
    caseId: string | undefined,
    pageSubscription: ActivePageSubscription
  ): Promise<void> {
    try {
      pageSubscription.preloadStatus[query.table] = 'pending';

      // 准备查询参数
      const params = {
        ...query.params,
        user_id: userId,
        case_id: caseId || null
      };

      // 执行查询
      const result = await this.dataCacheManager.query(query.query, params);

      // 缓存结果
      await this.dataCacheManager.cacheData(
        query.table,
        result,
        query.cacheType,
        userId,
        caseId
      );

      pageSubscription.preloadStatus[query.table] = 'completed';
      console.log(`PageAwareSubscriptionManager: Preloaded ${result.length} records for table: ${query.table}`);

    } catch (error) {
      pageSubscription.preloadStatus[query.table] = 'failed';
      console.error(`PageAwareSubscriptionManager: Preload query failed for table ${query.table}:`, error);
      throw error;
    }
  }

  /**
   * 获取页面数据需求配置
   */
  private getPageRequirement(
    pagePath: string,
    customRequirement?: Partial<PageDataRequirement>
  ): PageDataRequirement | null {
    // 首先尝试精确匹配
    let requirement = this.pageRequirements.get(pagePath);

    // 如果没有精确匹配，尝试模式匹配
    if (!requirement) {
      for (const [configPath, configData] of Array.from(this.pageRequirements.entries())) {
        if (this.matchPagePath(configPath, pagePath)) {
          requirement = configData;
          break;
        }
      }
    }

    // 如果还没有找到，创建默认配置
    if (!requirement) {
      requirement = {
        pagePath,
        requiredTables: [],
        cacheStrategy: 'conservative',
        subscriptionPriority: 5
      };
    }

    // 合并自定义配置
    if (customRequirement) {
      requirement = { ...requirement, ...customRequirement };
    }

    return requirement;
  }

  /**
   * 页面路径匹配
   */
  private matchPagePath(configPath: string, actualPath: string): boolean {
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
   * 创建订阅策略
   */
  private createSubscriptionStrategy(
    table: string,
    requirement: PageDataRequirement
  ): Partial<SubscriptionStrategy> {
    const baseStrategy: Partial<SubscriptionStrategy> = {
      priority: requirement.subscriptionPriority,
      enableIncrementalSync: true,
      maxRetries: 3
    };

    // 根据缓存策略调整参数
    switch (requirement.cacheStrategy) {
      case 'aggressive':
        baseStrategy.updateFrequency = 15 * 1000; // 15秒
        baseStrategy.batchSize = 200;
        break;
      case 'conservative':
        baseStrategy.updateFrequency = 2 * 60 * 1000; // 2分钟
        baseStrategy.batchSize = 100;
        break;
      case 'custom':
      default:
        baseStrategy.updateFrequency = 30 * 1000; // 30秒
        baseStrategy.batchSize = 150;
        break;
    }

    // 查找表特定的条件
    const tableCondition = requirement.conditions?.find(c => c.table === table);
    if (tableCondition) {
      baseStrategy.conditions = tableCondition.condition;
    }

    return baseStrategy;
  }

  /**
   * 查找可合并的订阅
   */
  private findMergeableSubscription(
    table: string,
    userId: string,
    caseId: string | undefined
  ): SubscriptionMergeInfo | null {
    const mergeKey = `${table}_${userId}_${caseId || 'global'}`;
    return this.mergedSubscriptions.get(mergeKey) || null;
  }

  /**
   * 判断是否应该创建合并订阅
   */
  private shouldCreateMergedSubscription(table: string): boolean {
    // 对于常用的表，启用合并订阅
    const commonTables = ['user', 'role', 'case', 'notification', 'message'];
    return commonTables.includes(table);
  }

  /**
   * 生成页面ID
   */
  private generatePageId(pagePath: string, userId: string, caseId?: string): string {
    const parts = [pagePath.replace(/[/:]/g, '_'), userId];
    if (caseId) parts.push(caseId);
    return parts.join('_');
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    this.subscriptionStats.totalPages = this.pageRequirements.size;
    this.subscriptionStats.activePages = this.activePageSubscriptions.size;
    this.subscriptionStats.totalSubscriptions = Array.from(this.activePageSubscriptions.values())
      .reduce((sum, page) => sum + page.subscriptionIds.length, 0);
    this.subscriptionStats.mergedSubscriptions = this.mergedSubscriptions.size;
  }

  /**
   * 启动清理任务
   */
  private startCleanupTask(): void {
    setInterval(() => {
      this.performCleanup();
    }, 5 * 60 * 1000); // 每5分钟执行一次清理
  }

  /**
   * 执行清理任务
   */
  private async performCleanup(): Promise<void> {
    const now = Date.now();
    const maxInactiveTime = 10 * 60 * 1000; // 10分钟不活跃则清理

    const inactivePages: string[] = [];

    for (const [pageId, pageSubscription] of Array.from(this.activePageSubscriptions.entries())) {
      const inactiveTime = now - pageSubscription.lastAccessTime;
      
      if (!pageSubscription.isActive && inactiveTime > maxInactiveTime) {
        inactivePages.push(pageId);
      }
    }

    // 清理不活跃的页面订阅
    for (const pageId of inactivePages) {
      try {
        await this.deactivatePageSubscription(pageId);
        console.log(`PageAwareSubscriptionManager: Cleaned up inactive page subscription: ${pageId}`);
      } catch (error) {
        console.error(`PageAwareSubscriptionManager: Failed to cleanup page subscription ${pageId}:`, error);
      }
    }

    this.subscriptionStats.lastCleanupTime = now;
    
    if (inactivePages.length > 0) {
      console.log(`PageAwareSubscriptionManager: Cleaned up ${inactivePages.length} inactive page subscriptions`);
    }
  }

  /**
   * 获取活跃页面订阅列表
   */
  getActivePageSubscriptions(): ActivePageSubscription[] {
    return Array.from(this.activePageSubscriptions.values());
  }

  /**
   * 获取合并订阅信息
   */
  getMergedSubscriptions(): SubscriptionMergeInfo[] {
    return Array.from(this.mergedSubscriptions.values());
  }

  /**
   * 获取订阅统计信息
   */
  getSubscriptionStats(): typeof this.subscriptionStats {
    this.updateStats();
    return { ...this.subscriptionStats };
  }

  /**
   * 获取页面订阅状态
   */
  getPageSubscriptionStatus(pageId: string): ActivePageSubscription | null {
    return this.activePageSubscriptions.get(pageId) || null;
  }

  /**
   * 更新页面访问时间
   */
  updatePageAccessTime(pageId: string): void {
    const pageSubscription = this.activePageSubscriptions.get(pageId);
    if (pageSubscription) {
      pageSubscription.lastAccessTime = Date.now();
    }
  }

  /**
   * 获取调试信息
   */
  getDebugInfo(): {
    pageRequirements: PageDataRequirement[];
    activeSubscriptions: ActivePageSubscription[];
    mergedSubscriptions: SubscriptionMergeInfo[];
    stats: typeof this.subscriptionStats;
  } {
    return {
      pageRequirements: Array.from(this.pageRequirements.values()),
      activeSubscriptions: this.getActivePageSubscriptions(),
      mergedSubscriptions: this.getMergedSubscriptions(),
      stats: this.getSubscriptionStats()
    };
  }

  /**
   * 关闭页面感知订阅管理器
   */
  async close(): Promise<void> {
    console.log('PageAwareSubscriptionManager: Closing...');

    // 停用所有活跃的页面订阅
    const deactivatePromises = Array.from(this.activePageSubscriptions.keys()).map(pageId =>
      this.deactivatePageSubscription(pageId)
    );

    await Promise.allSettled(deactivatePromises);

    // 清理状态
    this.pageRequirements.clear();
    this.activePageSubscriptions.clear();
    this.mergedSubscriptions.clear();

    console.log('PageAwareSubscriptionManager: Closed successfully');
  }
}