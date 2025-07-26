import { useState, useEffect, useCallback } from 'react';
import { PushNotificationUtils, type NotificationPayload, type PushSubscriptionData } from '../workers/pwa-push-manager';

interface UsePushNotificationOptions {
  vapidPublicKey: string;
  serverEndpoint?: string;
  userId?: string;
  autoSubscribe?: boolean;
}

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  subscription: PushSubscription | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * PWA推送通知Hook
 * 
 * 提供推送通知的完整管理功能
 */
export const usePushNotification = (options: UsePushNotificationOptions) => {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: PushNotificationUtils.isSupported(),
    permission: 'default',
    isSubscribed: false,
    subscription: null,
    isLoading: false,
    error: null
  });

  useEffect(() => {
    if (state.isSupported) {
      setState(prev => ({
        ...prev,
        permission: Notification.permission
      }));
      
      checkSubscriptionStatus();
      
      // 如果有权限且设置了自动订阅
      if (options.autoSubscribe && Notification.permission === 'granted') {
        checkSubscriptionStatus().then(hasSubscription => {
          if (!hasSubscription) {
            subscribe();
          }
        });
      }
    }
  }, [options.autoSubscribe]);

  const checkSubscriptionStatus = async (): Promise<boolean> => {
    if (!state.isSupported) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      setState(prev => ({
        ...prev,
        subscription,
        isSubscribed: !!subscription
      }));

      return !!subscription;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setState(prev => ({
        ...prev,
        error: '检查订阅状态失败'
      }));
      return false;
    }
  };

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!state.isSupported) {
      throw new Error('浏览器不支持推送通知');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const permission = await Notification.requestPermission();
      
      setState(prev => ({
        ...prev,
        permission,
        isLoading: false
      }));

      return permission;
    } catch (error) {
      const errorMessage = '请求通知权限失败';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));
      throw new Error(errorMessage);
    }
  }, [state.isSupported]);

  const subscribe = useCallback(async (): Promise<PushSubscriptionData | null> => {
    if (!state.isSupported) {
      throw new Error('浏览器不支持推送通知');
    }

    if (state.permission !== 'granted') {
      throw new Error('需要先获得通知权限');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(options.vapidPublicKey)
      });

      const subscriptionData: PushSubscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: arrayBufferToBase64(subscription.getKey('auth')!)
        },
        userId: options.userId,
        deviceId: generateDeviceId(),
        subscriptionTime: Date.now()
      };

      // 发送到服务器
      if (options.serverEndpoint) {
        await sendSubscriptionToServer(subscriptionData);
      }

      setState(prev => ({
        ...prev,
        subscription,
        isSubscribed: true,
        isLoading: false
      }));

      return subscriptionData;
    } catch (error) {
      const errorMessage = '订阅推送通知失败';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));
      throw new Error(errorMessage);
    }
  }, [state.isSupported, state.permission, options.vapidPublicKey, options.serverEndpoint, options.userId]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!state.subscription) {
      return true;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const success = await state.subscription.unsubscribe();
      
      if (success) {
        // 通知服务器
        if (options.serverEndpoint) {
          await removeSubscriptionFromServer(state.subscription.endpoint);
        }

        setState(prev => ({
          ...prev,
          subscription: null,
          isSubscribed: false,
          isLoading: false
        }));
      }

      return success;
    } catch (error) {
      const errorMessage = '取消订阅失败';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));
      throw new Error(errorMessage);
    }
  }, [state.subscription, options.serverEndpoint]);

  const showNotification = useCallback(async (payload: NotificationPayload): Promise<void> => {
    if (!state.isSupported) {
      throw new Error('浏览器不支持推送通知');
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      if (registration.active) {
        registration.active.postMessage({
          type: 'show_notification',
          payload
        });
      }
    } catch (error) {
      console.error('Error showing notification:', error);
      throw new Error('显示通知失败');
    }
  }, [state.isSupported]);

  const testNotification = useCallback(async (): Promise<void> => {
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

    await showNotification(testPayload);
  }, [showNotification]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // 工具函数
  const sendSubscriptionToServer = async (subscriptionData: PushSubscriptionData): Promise<void> => {
    if (!options.serverEndpoint) return;

    const response = await fetch(`${options.serverEndpoint}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscriptionData)
    });

    if (!response.ok) {
      throw new Error(`服务器响应错误: ${response.status}`);
    }
  };

  const removeSubscriptionFromServer = async (endpoint: string): Promise<void> => {
    if (!options.serverEndpoint) return;

    const response = await fetch(`${options.serverEndpoint}/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint })
    });

    if (!response.ok) {
      throw new Error(`服务器响应错误: ${response.status}`);
    }
  };

  return {
    // 状态
    ...state,
    
    // 操作方法
    requestPermission,
    subscribe,
    unsubscribe,
    showNotification,
    testNotification,
    clearError,
    
    // 便捷状态
    canRequestPermission: state.isSupported && state.permission === 'default',
    canSubscribe: state.isSupported && state.permission === 'granted' && !state.isSubscribed,
    canUnsubscribe: state.isSupported && state.isSubscribed,
    hasPermission: state.permission === 'granted',
    isReady: state.isSupported && state.permission === 'granted' && state.isSubscribed
  };
};

/**
 * 推送通知事件监听Hook
 * 
 * 监听推送通知相关的事件
 */
export const usePushNotificationEvents = () => {
  const [lastNotificationClick, setLastNotificationClick] = useState<any>(null);
  const [lastNotificationClose, setLastNotificationClose] = useState<any>(null);

  useEffect(() => {
    const handleNotificationClick = (event: CustomEvent) => {
      setLastNotificationClick(event.detail);
    };

    const handleNotificationClose = (event: CustomEvent) => {
      setLastNotificationClose(event.detail);
    };

    const handleNavigate = (event: MessageEvent) => {
      if (event.data.type === 'navigate') {
        // 处理导航请求
        const { url } = event.data.payload;
        if (url && window.location.pathname !== url) {
          window.history.pushState(null, '', url);
          // 触发路由变化（如果使用React Router）
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }
    };

    // 监听自定义事件
    window.addEventListener('pwa-notification-click', handleNotificationClick as EventListener);
    window.addEventListener('pwa-notification-close', handleNotificationClose as EventListener);
    
    // 监听Service Worker消息
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleNavigate);
    }

    return () => {
      window.removeEventListener('pwa-notification-click', handleNotificationClick as EventListener);
      window.removeEventListener('pwa-notification-close', handleNotificationClose as EventListener);
      
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleNavigate);
      }
    };
  }, []);

  return {
    lastNotificationClick,
    lastNotificationClose
  };
};

// 工具函数
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(byte => binary += String.fromCharCode(byte));
  return window.btoa(binary);
}

function generateDeviceId(): string {
  const userAgent = navigator.userAgent;
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  
  return btoa(`${userAgent}-${timestamp}-${random}`).substring(0, 32);
}