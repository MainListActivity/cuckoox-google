/// <reference lib="WebWorker" />

/**
 * PWA 推送通知管理器
 * 
 * 负责管理PWA的推送通知功能，包括：
 * - 权限请求和管理
 * - 订阅管理
 * - 通知显示和处理
 * - 与Service Worker集成
 */

export interface PushNotificationConfig {
  vapidPublicKey: string;
  serviceWorkerPath: string;
  notificationOptions: NotificationOptions;
  serverEndpoint: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, unknown>;
  actions?: NotificationAction[];
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  timestamp?: number;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string;
  deviceId?: string;
  subscriptionTime: number;
}

export class PWAPushManager {
  private config: PushNotificationConfig;
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private permissionState: NotificationPermission = 'default';
  private isInitialized = false;

  constructor(config: PushNotificationConfig) {
    this.config = config;
  }

  /**
   * 初始化推送通知管理器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('PWAPushManager: Initializing...');

    // 检查浏览器支持
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Push notifications are not supported in this browser');
    }

    try {
      // 获取Service Worker注册
      this.registration = await navigator.serviceWorker.ready;
      
      // 检查当前权限状态
      this.permissionState = Notification.permission;
      
      // 如果已有权限，尝试获取现有订阅
      if (this.permissionState === 'granted') {
        this.subscription = await this.registration.pushManager.getSubscription();
      }

      // 设置消息监听器
      this.setupMessageListeners();

      this.isInitialized = true;
      console.log('PWAPushManager: Initialized successfully');
    } catch (error) {
      console.error('PWAPushManager: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * 请求通知权限
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isInitialized) {
      throw new Error('PWAPushManager not initialized');
    }

    console.log('PWAPushManager: Requesting notification permission...');

    try {
      // 请求权限
      this.permissionState = await Notification.requestPermission();
      
      console.log('PWAPushManager: Permission result:', this.permissionState);
      return this.permissionState;
    } catch (error) {
      console.error('PWAPushManager: Permission request failed:', error);
      throw error;
    }
  }

  /**
   * 订阅推送通知
   */
  async subscribe(userId?: string): Promise<PushSubscriptionData | null> {
    if (!this.isInitialized || !this.registration) {
      throw new Error('PWAPushManager not initialized');
    }

    if (this.permissionState !== 'granted') {
      console.warn('PWAPushManager: Cannot subscribe without permission');
      return null;
    }

    console.log('PWAPushManager: Subscribing to push notifications...');

    try {
      // 创建订阅
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.config.vapidPublicKey)
      });

      // 构造订阅数据
      const subscriptionData: PushSubscriptionData = {
        endpoint: this.subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(this.subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(this.subscription.getKey('auth')!)
        },
        userId,
        deviceId: this.generateDeviceId(),
        subscriptionTime: Date.now()
      };

      // 发送订阅信息到服务器
      await this.sendSubscriptionToServer(subscriptionData);

      console.log('PWAPushManager: Successfully subscribed to push notifications');
      return subscriptionData;
    } catch (error) {
      console.error('PWAPushManager: Subscription failed:', error);
      throw error;
    }
  }

  /**
   * 取消订阅推送通知
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      console.log('PWAPushManager: No active subscription to unsubscribe');
      return true;
    }

    console.log('PWAPushManager: Unsubscribing from push notifications...');

    try {
      // 取消订阅
      const success = await this.subscription.unsubscribe();
      
      if (success) {
        // 通知服务器
        await this.removeSubscriptionFromServer();
        this.subscription = null;
        console.log('PWAPushManager: Successfully unsubscribed');
      }
      
      return success;
    } catch (error) {
      console.error('PWAPushManager: Unsubscribe failed:', error);
      return false;
    }
  }

  /**
   * 获取当前订阅状态
   */
  getSubscriptionStatus(): {
    hasPermission: boolean;
    isSubscribed: boolean;
    canSubscribe: boolean;
    subscription: PushSubscriptionData | null;
  } {
    const hasPermission = this.permissionState === 'granted';
    const isSubscribed = !!this.subscription;
    const canSubscribe = hasPermission && !isSubscribed;
    
    let subscription: PushSubscriptionData | null = null;
    if (this.subscription) {
      subscription = {
        endpoint: this.subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(this.subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(this.subscription.getKey('auth')!)
        },
        subscriptionTime: Date.now()
      };
    }

    return {
      hasPermission,
      isSubscribed,
      canSubscribe,
      subscription
    };
  }

  /**
   * 发送通知到Service Worker进行显示
   */
  async sendNotificationToSW(payload: NotificationPayload): Promise<void> {
    if (!this.registration) {
      throw new Error('Service Worker not available');
    }

    console.log('PWAPushManager: Sending notification to Service Worker:', payload);

    try {
      // 发送消息到Service Worker
      if (this.registration.active) {
        this.registration.active.postMessage({
          type: 'show_notification',
          payload: {
            ...payload,
            timestamp: payload.timestamp || Date.now()
          }
        });
      }
    } catch (error) {
      console.error('PWAPushManager: Failed to send notification to SW:', error);
      throw error;
    }
  }

  /**
   * 测试通知显示
   */
  async testNotification(): Promise<void> {
    const testPayload: NotificationPayload = {
      title: 'CuckooX 测试通知',
      body: '这是一条测试通知，用于验证推送通知功能是否正常工作。',
      icon: '/assets/logo/cuckoo-icon.svg',
      badge: '/assets/logo/favicon.svg',
      tag: 'test-notification',
      data: {
        type: 'test',
        timestamp: Date.now()
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

    await this.sendNotificationToSW(testPayload);
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    console.log('PWAPushManager: Destroying...');
    
    // 移除消息监听器
    if (navigator.serviceWorker) {
      navigator.serviceWorker.removeEventListener('message', this.handleSWMessage);
    }

    this.subscription = null;
    this.registration = null;
    this.isInitialized = false;
    
    console.log('PWAPushManager: Destroyed');
  }

  // 私有方法

  private setupMessageListeners(): void {
    // 监听来自Service Worker的消息
    navigator.serviceWorker.addEventListener('message', this.handleSWMessage);
  }

  private handleSWMessage = (event: MessageEvent) => {
    const { type, payload } = event.data;

    switch (type) {
      case 'notification_clicked':
        this.handleNotificationClick(payload);
        break;
      case 'notification_closed':
        this.handleNotificationClose(payload);
        break;
      default:
        // 其他消息类型
        break;
    }
  };

  private handleNotificationClick(payload: { action?: string; data?: Record<string, unknown> }): void {
    console.log('PWAPushManager: Notification clicked:', payload);
    
    // 处理通知点击事件
    if (payload.data?.url) {
      // 发送消息给Service Worker处理导航
      self.postMessage({
        type: 'navigate_to_url',
        payload: { url: payload.data.url }
      });
    }
    
    // 发送消息给客户端
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'pwa-notification-click',
          payload
        });
      });
    });
  }

  private handleNotificationClose(payload: { data?: Record<string, unknown> }): void {
    console.log('PWAPushManager: Notification closed:', payload);
    
    // 发送消息给客户端
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'pwa-notification-close',
          payload
        });
      });
    });
  }

  private async sendSubscriptionToServer(subscriptionData: PushSubscriptionData): Promise<void> {
    if (!this.config.serverEndpoint) {
      console.warn('PWAPushManager: No server endpoint configured for subscription storage');
      return;
    }

    try {
      const response = await fetch(`${this.config.serverEndpoint}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscriptionData)
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      console.log('PWAPushManager: Subscription sent to server successfully');
    } catch (error) {
      console.error('PWAPushManager: Failed to send subscription to server:', error);
      // 不抛出错误，因为本地订阅仍然有效
    }
  }

  private async removeSubscriptionFromServer(): Promise<void> {
    if (!this.config.serverEndpoint || !this.subscription) {
      return;
    }

    try {
      const response = await fetch(`${this.config.serverEndpoint}/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: this.subscription.endpoint
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      console.log('PWAPushManager: Subscription removed from server successfully');
    } catch (error) {
      console.error('PWAPushManager: Failed to remove subscription from server:', error);
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return btoa(binary);
  }

  private generateDeviceId(): string {
    // 生成简单的设备ID（实际应用中可能需要更复杂的实现）
    const userAgent = navigator.userAgent;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    
    return btoa(`${userAgent}-${timestamp}-${random}`).substring(0, 32);
  }
}

// 推送通知工具函数
export const PushNotificationUtils = {
  /**
   * 检查浏览器是否支持推送通知
   */
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 
           'PushManager' in window && 
           'Notification' in window;
  },

  /**
   * 获取权限状态的用户友好文本
   */
  getPermissionText(permission: NotificationPermission): string {
    const texts = {
      'granted': '已授权',
      'denied': '已拒绝',
      'default': '未设置'
    };
    return texts[permission] || '未知';
  },

  /**
   * 创建标准的通知负载
   */
  createNotificationPayload(options: {
    title: string;
    body: string;
    type: 'case' | 'claim' | 'message' | 'system';
    data?: Record<string, unknown>;
    url?: string;
  }): NotificationPayload {
    const iconMap = {
      'case': '/assets/icons/case.svg',
      'claim': '/assets/icons/claim.svg',
      'message': '/assets/icons/message.svg',
      'system': '/assets/icons/system.svg'
    };

    return {
      title: options.title,
      body: options.body,
      icon: iconMap[options.type] || '/assets/logo/cuckoo-icon.svg',
      badge: '/assets/logo/favicon.svg',
      tag: `${options.type}-${Date.now()}`,
      data: {
        ...options.data,
        type: options.type,
        url: options.url,
        timestamp: Date.now()
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
      ],
      requireInteraction: options.type !== 'system'
    };
  }
};