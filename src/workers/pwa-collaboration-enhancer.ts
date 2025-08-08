/// <reference lib="WebWorker" />

/**
 * PWA实时协作增强器
 * 
 * 为PWA环境优化实时协作功能，包括：
 * - 增强Live Query在后台运行时的稳定性
 * - 优化WebSocket连接管理
 * - 集成Push API发送协作通知
 * - 处理PWA特定的连接场景
 */

import type { NetworkState } from './network-state-manager';
import type { NotificationPayload } from './pwa-push-manager';

export interface CollaborationEvent {
  type: 'document_change' | 'user_joined' | 'user_left' | 'comment_added' | 'status_changed';
  userId: string;
  userName: string;
  resourceId: string;
  resourceType: 'case' | 'claim' | 'document' | 'message';
  data: Record<string, unknown>;
  timestamp: number;
}

export interface PWACollaborationConfig {
  enableBackgroundSync: boolean;
  pushNotificationConfig?: {
    enabled: boolean;
    vapidPublicKey?: string;
  };
  reconnectionConfig: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
  };
  visibilityConfig: {
    enableVisibilityAPI: boolean;
    backgroundSyncInterval: number; // ms
  };
}

export class PWACollaborationEnhancer {
  private config: PWACollaborationConfig;
  private isDocumentVisible = true;
  private backgroundSyncTimer: number | null = null;
  private collaborationEventListeners: Set<(event: CollaborationEvent) => void> = new Set();
  private currentUserId: string | null = null;
  private currentUserName: string | null = null;
  private isInitialized = false;

  // 引用现有的管理器
  private networkStateManager: {
    onStateChange: (callback: (state: NetworkState) => void) => void;
  } | null = null;
  private connectionRecoveryManager: Record<string, unknown> | null = null;
  private subscriptionManager: {
    createSubscription: (query: string, vars?: Record<string, unknown>) => Promise<string>;
  } | null = null;

  constructor(config: PWACollaborationConfig) {
    this.config = config;
  }

  /**
   * 初始化PWA协作增强器
   */
  async initialize(managers: {
    networkStateManager?: {
      onStateChange: (callback: (state: NetworkState) => void) => void;
    };
    connectionRecoveryManager?: Record<string, unknown>;
    subscriptionManager?: {
      createSubscription: (query: string, vars?: Record<string, unknown>) => Promise<string>;
    };
  }): Promise<void> {
    if (this.isInitialized) return;

    console.log('PWACollaborationEnhancer: Initializing...');

    this.networkStateManager = managers.networkStateManager;
    this.connectionRecoveryManager = managers.connectionRecoveryManager;
    this.subscriptionManager = managers.subscriptionManager;

    // 设置文档可见性监听
    if (this.config.visibilityConfig.enableVisibilityAPI) {
      this.setupVisibilityListeners();
    }

    // 设置网络状态监听
    if (this.networkStateManager) {
      this.setupNetworkListeners();
    }

    // 设置协作事件监听
    this.setupCollaborationListeners();

    this.isInitialized = true;
    console.log('PWACollaborationEnhancer: Initialized successfully');
  }

  /**
   * 设置用户信息
   */
  setUserInfo(userId: string, userName: string): void {
    this.currentUserId = userId;
    this.currentUserName = userName;
  }

  /**
   * 处理协作事件
   */
  async handleCollaborationEvent(event: CollaborationEvent): Promise<void> {
    console.log('PWACollaborationEnhancer: Handling collaboration event:', event);

    try {
      // 通知所有监听器
      this.notifyEventListeners(event);

      // 如果文档不可见，发送推送通知
      if (!this.isDocumentVisible && this.shouldSendNotification(event)) {
        await this.sendCollaborationNotification(event);
      }

      // 记录协作活动
      await this.recordCollaborationActivity(event);
    } catch (error) {
      console.error('PWACollaborationEnhancer: Error handling collaboration event:', error);
    }
  }

  /**
   * 优化Live Query订阅
   */
  async enhanceLiveQuery(query: string, vars?: Record<string, unknown>): Promise<string> {
    if (!this.subscriptionManager) {
      throw new Error('Subscription manager not available');
    }

    console.log('PWACollaborationEnhancer: Enhancing live query:', query);

    try {
      // 使用现有的订阅管理器创建订阅
      const uuid = await this.subscriptionManager.createSubscription(query, vars);

      // 增强订阅处理
      this.enhanceSubscriptionHandling(uuid);

      return uuid;
    } catch (error) {
      console.error('PWACollaborationEnhancer: Error enhancing live query:', error);
      throw error;
    }
  }

  /**
   * 处理连接中断时的协作状态
   */
  async handleConnectionLoss(): Promise<void> {
    console.log('PWACollaborationEnhancer: Handling connection loss');

    try {
      // 暂停实时更新
      this.pauseCollaborationUpdates();

      // 如果启用了后台同步，启动定期检查
      if (this.config.enableBackgroundSync) {
        this.startBackgroundSync();
      }

      // 通知用户连接中断
      const event: CollaborationEvent = {
        type: 'status_changed',
        userId: 'system',
        userName: '系统',
        resourceId: 'connection',
        resourceType: 'document',
        data: { status: 'disconnected' },
        timestamp: Date.now()
      };

      await this.handleCollaborationEvent(event);
    } catch (error) {
      console.error('PWACollaborationEnhancer: Error handling connection loss:', error);
    }
  }

  /**
   * 处理连接恢复时的协作状态
   */
  async handleConnectionRecovery(): Promise<void> {
    console.log('PWACollaborationEnhancer: Handling connection recovery');

    try {
      // 停止后台同步
      this.stopBackgroundSync();

      // 恢复实时更新
      this.resumeCollaborationUpdates();

      // 同步离线期间的变更
      await this.syncOfflineChanges();

      // 通知用户连接已恢复
      const event: CollaborationEvent = {
        type: 'status_changed',
        userId: 'system',
        userName: '系统',
        resourceId: 'connection',
        resourceType: 'document',
        data: { status: 'connected' },
        timestamp: Date.now()
      };

      await this.handleCollaborationEvent(event);
    } catch (error) {
      console.error('PWACollaborationEnhancer: Error handling connection recovery:', error);
    }
  }

  /**
   * 添加协作事件监听器
   */
  onCollaborationEvent(listener: (event: CollaborationEvent) => void): () => void {
    this.collaborationEventListeners.add(listener);
    return () => this.collaborationEventListeners.delete(listener);
  }

  /**
   * 销毁增强器
   */
  destroy(): void {
    console.log('PWACollaborationEnhancer: Destroying...');

    // 清理定时器
    this.stopBackgroundSync();

    // 清理事件监听器
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // 清理监听器
    this.collaborationEventListeners.clear();

    this.isInitialized = false;
    console.log('PWACollaborationEnhancer: Destroyed');
  }

  // 私有方法

  private setupVisibilityListeners(): void {
    if (typeof document === 'undefined') return;

    this.isDocumentVisible = !document.hidden;

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handleVisibilityChange = (): void => {
    const wasVisible = this.isDocumentVisible;
    this.isDocumentVisible = !document.hidden;

    console.log('PWACollaborationEnhancer: Visibility changed:', {
      from: wasVisible,
      to: this.isDocumentVisible
    });

    if (this.isDocumentVisible && !wasVisible) {
      // 从后台切换到前台
      this.handleDocumentVisible();
    } else if (!this.isDocumentVisible && wasVisible) {
      // 从前台切换到后台
      this.handleDocumentHidden();
    }
  };

  private handleDocumentVisible(): void {
    console.log('PWACollaborationEnhancer: Document became visible');

    // 停止后台同步
    this.stopBackgroundSync();

    // 恢复正常的协作更新
    this.resumeCollaborationUpdates();

    // 同步可能错过的更新
    this.syncMissedUpdates();
  }

  private handleDocumentHidden(): void {
    console.log('PWACollaborationEnhancer: Document became hidden');

    if (this.config.enableBackgroundSync) {
      // 启动后台同步
      this.startBackgroundSync();
    }
  }

  private setupNetworkListeners(): void {
    if (!this.networkStateManager) return;

    this.networkStateManager.onStateChange((state: NetworkState) => {
      if (!state.isOnline) {
        this.handleConnectionLoss();
      } else {
        this.handleConnectionRecovery();
      }
    });
  }

  private setupCollaborationListeners(): void {
    // 监听来自主线程的协作事件
    self.addEventListener('message', (event) => {
      if (event.data.type === 'collaboration_event') {
        this.handleCollaborationEvent(event.data.payload);
      }
    });
  }

  private enhanceSubscriptionHandling(uuid: string): void {
    // 为订阅添加增强处理逻辑
    console.log('PWACollaborationEnhancer: Enhancing subscription handling for UUID:', uuid);

    // 这里可以添加订阅级别的优化，比如：
    // - 基于网络质量调整更新频率
    // - 在后台时减少更新频率
    // - 优先处理重要的协作事件
  }

  private shouldSendNotification(event: CollaborationEvent): boolean {
    // 不为自己的操作发送通知
    if (event.userId === this.currentUserId) {
      return false;
    }

    // 只为重要的协作事件发送通知
    const importantEvents = ['document_change', 'comment_added'];
    return importantEvents.includes(event.type);
  }

  private async sendCollaborationNotification(event: CollaborationEvent): Promise<void> {
    if (!this.config.pushNotificationConfig?.enabled) {
      return;
    }

    try {
      const notification = this.createCollaborationNotification(event);
      
      // 发送到Service Worker显示通知
      self.postMessage({
        type: 'show_notification',
        payload: notification
      });
    } catch (error) {
      console.error('PWACollaborationEnhancer: Error sending collaboration notification:', error);
    }
  }

  private createCollaborationNotification(event: CollaborationEvent): NotificationPayload {
    const titleMap = {
      'document_change': '文档已更新',
      'user_joined': '用户加入协作',
      'user_left': '用户离开协作',
      'comment_added': '新评论',
      'status_changed': '状态变更'
    };

    const bodyMap = {
      'document_change': `${event.userName} 修改了文档`,
      'user_joined': `${event.userName} 加入了协作`,
      'user_left': `${event.userName} 离开了协作`,
      'comment_added': `${event.userName} 添加了新评论`,
      'status_changed': `${event.userName} 更改了状态`
    };

    return {
      title: titleMap[event.type] || '协作通知',
      body: bodyMap[event.type] || '有新的协作活动',
      icon: '/assets/logo/cuckoo-icon.svg',
      badge: '/assets/logo/favicon.svg',
      tag: `collaboration-${event.resourceType}-${event.resourceId}`,
      data: {
        type: 'collaboration',
        event,
        url: this.getResourceUrl(event.resourceType, event.resourceId)
      },
      actions: [
        {
          action: 'view',
          title: '查看详情',
          icon: '/assets/icons/view.svg'
        },
        {
          action: 'dismiss',
          title: '忽略',
          icon: '/assets/icons/dismiss.svg'
        }
      ]
    };
  }

  private getResourceUrl(resourceType: string, resourceId: string): string {
    const urlMap = {
      'case': `/cases/${resourceId}`,
      'claim': `/claims/${resourceId}`,
      'document': `/documents/${resourceId}`,
      'message': `/messages/${resourceId}`
    };

    return urlMap[resourceType as keyof typeof urlMap] || '/';
  }

  private async recordCollaborationActivity(event: CollaborationEvent): Promise<void> {
    try {
      // 记录协作活动到本地数据库
      // 这里可以使用现有的数据缓存管理器
      console.log('PWACollaborationEnhancer: Recording collaboration activity:', event);
    } catch (error) {
      console.error('PWACollaborationEnhancer: Error recording collaboration activity:', error);
    }
  }

  private startBackgroundSync(): void {
    if (this.backgroundSyncTimer) {
      return; // 已经在运行
    }

    console.log('PWACollaborationEnhancer: Starting background sync');

    this.backgroundSyncTimer = setInterval(() => {
      this.performBackgroundSync();
    }, this.config.visibilityConfig.backgroundSyncInterval) as unknown as number;
  }

  private stopBackgroundSync(): void {
    if (this.backgroundSyncTimer) {
      clearInterval(this.backgroundSyncTimer);
      this.backgroundSyncTimer = null;
      console.log('PWACollaborationEnhancer: Stopped background sync');
    }
  }

  private async performBackgroundSync(): Promise<void> {
    console.log('PWACollaborationEnhancer: Performing background sync');

    try {
      // 执行轻量级的同步检查
      // 这里可以检查是否有新的协作更新
      await this.checkForCollaborationUpdates();
    } catch (error) {
      console.error('PWACollaborationEnhancer: Error during background sync:', error);
    }
  }

  private async checkForCollaborationUpdates(): Promise<void> {
    console.log('PWACollaborationEnhancer: Checking for collaboration updates');
    
    try {
      // 检查是否有新的协作事件
      // 这里可以发送轻量级请求到服务器检查更新
      
      // 发送检查请求到主线程
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'check_collaboration_updates',
            payload: { timestamp: Date.now() }
          });
        });
      });
      
    } catch (error) {
      console.error('PWACollaborationEnhancer: Error checking for updates:', error);
    }
  }

  private pauseCollaborationUpdates(): void {
    console.log('PWACollaborationEnhancer: Pausing collaboration updates');
    
    // 通知客户端暂停实时更新
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'pause_collaboration_updates',
          payload: { reason: 'connection_lost' }
        });
      });
    });
  }

  private resumeCollaborationUpdates(): void {
    console.log('PWACollaborationEnhancer: Resuming collaboration updates');
    
    // 通知客户端恢复实时更新
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'resume_collaboration_updates',
          payload: { reason: 'connection_restored' }
        });
      });
    });
  }

  private async syncOfflineChanges(): Promise<void> {
    console.log('PWACollaborationEnhancer: Syncing offline changes');
    
    try {
      // 获取离线期间缓存的协作事件
      const cache = await caches.open('collaboration-cache');
      const offlineEventsRequest = new Request('internal://offline-collaboration-events');
      const response = await cache.match(offlineEventsRequest);
      
      if (response) {
        const offlineEvents = await response.json();
        
        // 发送离线事件到主线程进行同步
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'sync_offline_collaboration_events',
              payload: { events: offlineEvents }
            });
          });
        });
        
        // 清理离线事件缓存
        await cache.delete(offlineEventsRequest);
      }
      
    } catch (error) {
      console.error('PWACollaborationEnhancer: Error syncing offline changes:', error);
    }
  }

  private async syncMissedUpdates(): Promise<void> {
    console.log('PWACollaborationEnhancer: Syncing missed updates');
    
    try {
      // 获取最后同步的时间戳
      const cache = await caches.open('collaboration-cache');
      const lastSyncRequest = new Request('internal://last-sync-timestamp');
      const response = await cache.match(lastSyncRequest);
      
      let lastSyncTimestamp = 0;
      if (response) {
        const data = await response.json();
        lastSyncTimestamp = data.timestamp;
      }
      
      // 请求主线程获取错过的更新
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'fetch_missed_collaboration_updates',
            payload: { since: lastSyncTimestamp }
          });
        });
      });
      
      // 更新最后同步时间戳
      const currentTimestamp = Date.now();
      const timestampResponse = new Response(JSON.stringify({ timestamp: currentTimestamp }), {
        headers: { 'Content-Type': 'application/json' }
      });
      await cache.put(lastSyncRequest, timestampResponse);
      
    } catch (error) {
      console.error('PWACollaborationEnhancer: Error syncing missed updates:', error);
    }
  }

  private notifyEventListeners(event: CollaborationEvent): void {
    this.collaborationEventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('PWACollaborationEnhancer: Error in event listener:', error);
      }
    });
  }
}

// 协作工具函数
export const CollaborationUtils = {
  /**
   * 创建协作事件
   */
  createCollaborationEvent(
    type: CollaborationEvent['type'],
    userId: string,
    userName: string,
    resourceId: string,
    resourceType: CollaborationEvent['resourceType'],
    data: Record<string, unknown>
  ): CollaborationEvent {
    return {
      type,
      userId,
      userName,
      resourceId,
      resourceType,
      data,
      timestamp: Date.now()
    };
  },

  /**
   * 判断是否为重要的协作事件
   */
  isImportantEvent(event: CollaborationEvent): boolean {
    const importantEvents = ['document_change', 'comment_added', 'status_changed'];
    return importantEvents.includes(event.type);
  },

  /**
   * 格式化协作事件为用户友好的文本
   */
  formatEventMessage(event: CollaborationEvent): string {
    const messages = {
      'document_change': `${event.userName} 修改了文档`,
      'user_joined': `${event.userName} 加入了协作`,
      'user_left': `${event.userName} 离开了协作`,
      'comment_added': `${event.userName} 添加了评论`,
      'status_changed': `${event.userName} 更改了状态`
    };

    return messages[event.type] || `${event.userName} 执行了操作`;
  }
};