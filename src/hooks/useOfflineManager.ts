import { useState, useEffect, useCallback } from 'react';

/**
 * 离线状态接口
 */
export interface OfflineStatus {
  isOffline: boolean;
  networkStatus: {
    isOnline: boolean;
    connectionType?: string;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  };
  pendingOperations: number;
  operationStats: {
    total: number;
    pending: number;
    syncing: number;
    completed: number;
    failed: number;
  };
}

/**
 * 离线操作接口
 */
export interface OfflineOperation {
  type: 'create' | 'update' | 'merge' | 'delete' | 'query';
  table: string;
  recordId?: string;
  data?: any;
  sql?: string;
  params?: any;
  userId?: string;
  caseId?: string;
  maxRetries: number;
}

/**
 * 同步状态接口
 */
export interface SyncStatus {
  status: 'started' | 'completed' | 'failed';
  totalOperations: number;
  successCount?: number;
  failureCount?: number;
  error?: string;
  timestamp: number;
}

/**
 * 离线管理器 Hook
 * 提供离线状态监控、离线操作管理和同步功能
 */
export function useOfflineManager() {
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 获取离线状态
   */
  const getOfflineStatus = useCallback(async (): Promise<OfflineStatus | null> => {
    try {
      setIsLoading(true);
      
      if (!navigator.serviceWorker?.controller) {
        console.warn('useOfflineManager: Service Worker not available');
        return null;
      }

      const response = await new Promise<any>((resolve, reject) => {
        const messageId = crypto.randomUUID();
        
        const handleMessage = (event: MessageEvent) => {
          if (event.data.messageId === messageId) {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
            if (event.data.type === 'get_offline_status_response') {
              resolve(event.data.payload);
            } else if (event.data.type === 'get_offline_status_error') {
              reject(new Error(event.data.payload.message));
            }
          }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);
        
        navigator.serviceWorker.controller!.postMessage({
          type: 'get_offline_status',
          messageId,
          payload: {}
        });

        // 超时处理
        setTimeout(() => {
          navigator.serviceWorker.removeEventListener('message', handleMessage);
          reject(new Error('Request timeout'));
        }, 5000);
      });

      setOfflineStatus(response);
      return response;
      
    } catch (error) {
      console.error('useOfflineManager: Failed to get offline status:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 添加离线操作到队列
   */
  const queueOfflineOperation = useCallback(async (operation: OfflineOperation): Promise<string | null> => {
    try {
      if (!navigator.serviceWorker?.controller) {
        throw new Error('Service Worker not available');
      }

      const response = await new Promise<any>((resolve, reject) => {
        const messageId = crypto.randomUUID();
        
        const handleMessage = (event: MessageEvent) => {
          if (event.data.messageId === messageId) {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
            if (event.data.type === 'queue_offline_operation_response') {
              resolve(event.data.payload);
            } else if (event.data.type === 'queue_offline_operation_error') {
              reject(new Error(event.data.payload.message));
            }
          }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);
        
        navigator.serviceWorker.controller!.postMessage({
          type: 'queue_offline_operation',
          messageId,
          payload: { operation }
        });

        setTimeout(() => {
          navigator.serviceWorker.removeEventListener('message', handleMessage);
          reject(new Error('Request timeout'));
        }, 5000);
      });

      // 刷新离线状态
      await getOfflineStatus();
      
      return response.operationId;
      
    } catch (error) {
      console.error('useOfflineManager: Failed to queue offline operation:', error);
      return null;
    }
  }, [getOfflineStatus]);

  /**
   * 执行离线查询
   */
  const executeOfflineQuery = useCallback(async (sql: string, params?: any): Promise<any[] | null> => {
    try {
      if (!navigator.serviceWorker?.controller) {
        throw new Error('Service Worker not available');
      }

      const response = await new Promise<any>((resolve, reject) => {
        const messageId = crypto.randomUUID();
        
        const handleMessage = (event: MessageEvent) => {
          if (event.data.messageId === messageId) {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
            if (event.data.type === 'execute_offline_query_response') {
              resolve(event.data.payload);
            } else if (event.data.type === 'execute_offline_query_error') {
              reject(new Error(event.data.payload.message));
            }
          }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);
        
        navigator.serviceWorker.controller!.postMessage({
          type: 'execute_offline_query',
          messageId,
          payload: { sql, params }
        });

        setTimeout(() => {
          navigator.serviceWorker.removeEventListener('message', handleMessage);
          reject(new Error('Request timeout'));
        }, 10000);
      });

      return response;
      
    } catch (error) {
      console.error('useOfflineManager: Failed to execute offline query:', error);
      return null;
    }
  }, []);

  /**
   * 启动离线同步
   */
  const startOfflineSync = useCallback(async (): Promise<boolean> => {
    try {
      if (!navigator.serviceWorker?.controller) {
        throw new Error('Service Worker not available');
      }

      await new Promise<void>((resolve, reject) => {
        const messageId = crypto.randomUUID();
        
        const handleMessage = (event: MessageEvent) => {
          if (event.data.messageId === messageId) {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
            if (event.data.type === 'start_offline_sync_response') {
              resolve();
            } else if (event.data.type === 'start_offline_sync_error') {
              reject(new Error(event.data.payload.message));
            }
          }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);
        
        navigator.serviceWorker.controller!.postMessage({
          type: 'start_offline_sync',
          messageId,
          payload: {}
        });

        setTimeout(() => {
          navigator.serviceWorker.removeEventListener('message', handleMessage);
          reject(new Error('Request timeout'));
        }, 30000); // 同步可能需要更长时间
      });

      // 刷新离线状态
      await getOfflineStatus();
      
      return true;
      
    } catch (error) {
      console.error('useOfflineManager: Failed to start offline sync:', error);
      return false;
    }
  }, [getOfflineStatus]);

  /**
   * 清除已完成的操作
   */
  const clearCompletedOperations = useCallback(async (): Promise<boolean> => {
    try {
      if (!navigator.serviceWorker?.controller) {
        throw new Error('Service Worker not available');
      }

      await new Promise<void>((resolve, reject) => {
        const messageId = crypto.randomUUID();
        
        const handleMessage = (event: MessageEvent) => {
          if (event.data.messageId === messageId) {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
            if (event.data.type === 'clear_completed_operations_response') {
              resolve();
            } else if (event.data.type === 'clear_completed_operations_error') {
              reject(new Error(event.data.payload.message));
            }
          }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);
        
        navigator.serviceWorker.controller!.postMessage({
          type: 'clear_completed_operations',
          messageId,
          payload: {}
        });

        setTimeout(() => {
          navigator.serviceWorker.removeEventListener('message', handleMessage);
          reject(new Error('Request timeout'));
        }, 5000);
      });

      // 刷新离线状态
      await getOfflineStatus();
      
      return true;
      
    } catch (error) {
      console.error('useOfflineManager: Failed to clear completed operations:', error);
      return false;
    }
  }, [getOfflineStatus]);

  /**
   * 重试失败的操作
   */
  const retryFailedOperations = useCallback(async (): Promise<boolean> => {
    try {
      if (!navigator.serviceWorker?.controller) {
        throw new Error('Service Worker not available');
      }

      await new Promise<void>((resolve, reject) => {
        const messageId = crypto.randomUUID();
        
        const handleMessage = (event: MessageEvent) => {
          if (event.data.messageId === messageId) {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
            if (event.data.type === 'retry_failed_operations_response') {
              resolve();
            } else if (event.data.type === 'retry_failed_operations_error') {
              reject(new Error(event.data.payload.message));
            }
          }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);
        
        navigator.serviceWorker.controller!.postMessage({
          type: 'retry_failed_operations',
          messageId,
          payload: {}
        });

        setTimeout(() => {
          navigator.serviceWorker.removeEventListener('message', handleMessage);
          reject(new Error('Request timeout'));
        }, 5000);
      });

      // 刷新离线状态
      await getOfflineStatus();
      
      return true;
      
    } catch (error) {
      console.error('useOfflineManager: Failed to retry failed operations:', error);
      return false;
    }
  }, [getOfflineStatus]);

  /**
   * 监听 Service Worker 消息
   */
  useEffect(() => {
    if (!navigator.serviceWorker) return;

    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data;
      
      switch (type) {
        case 'network_status_change':
          // 网络状态变化时刷新离线状态
          getOfflineStatus();
          break;
          
        case 'offline_sync_status':
          // 同步状态更新
          setSyncStatus(payload);
          break;
          
        case 'offline_queue_status':
          // 队列状态更新时刷新离线状态
          getOfflineStatus();
          break;
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [getOfflineStatus]);

  /**
   * 初始化时获取离线状态
   */
  useEffect(() => {
    getOfflineStatus();
  }, [getOfflineStatus]);

  return {
    // 状态
    offlineStatus,
    syncStatus,
    isLoading,
    
    // 方法
    getOfflineStatus,
    queueOfflineOperation,
    executeOfflineQuery,
    startOfflineSync,
    clearCompletedOperations,
    retryFailedOperations,
    
    // 便捷属性
    isOffline: offlineStatus?.isOffline ?? false,
    pendingOperations: offlineStatus?.pendingOperations ?? 0,
    hasFailedOperations: (offlineStatus?.operationStats.failed ?? 0) > 0
  };
}