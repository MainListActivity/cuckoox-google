import { useState, useEffect, useCallback, useRef } from 'react';
import type { NetworkState, NetworkStateChangeListener } from '../workers/network-state-manager';

/**
 * 网络状态 Hook
 * 
 * 提供网络状态监听和管理功能
 */
export const useNetworkState = () => {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isOnline: navigator.onLine,
    connectionType: 'unknown',
    effectiveType: '4g',
    downlink: 10,
    rtt: 100,
    saveData: false,
    timestamp: Date.now()
  });

  const [isChecking, setIsChecking] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const listenerIdRef = useRef<string | null>(null);

  // 初始化 Service Worker 通信
  useEffect(() => {
    const initializeWorkerCommunication = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          workerRef.current = registration.active;

          // 请求当前网络状态
          const messageId = `network_state_${Date.now()}`;
          listenerIdRef.current = messageId;

          // 监听来自 Service Worker 的消息
          navigator.serviceWorker.addEventListener('message', handleWorkerMessage);

          // 请求网络状态
          if (registration.active) {
            registration.active.postMessage({
              type: 'get_network_state',
              messageId
            });
          }
        } catch (error) {
          console.warn('useNetworkState: Failed to initialize worker communication:', error);
          // 使用浏览器原生 API 作为备选方案
          initializeBrowserAPI();
        }
      } else {
        initializeBrowserAPI();
      }
    };

    initializeWorkerCommunication();

    return () => {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', handleWorkerMessage);
      }
      cleanup();
    };
  }, []);

  // 处理来自 Service Worker 的消息
  const handleWorkerMessage = useCallback((event: MessageEvent) => {
    const { type, payload, messageId } = event.data;

    if (type === 'network_state_change' || 
        (type === 'get_network_state_response' && messageId === listenerIdRef.current)) {
      setNetworkState(payload.state);
    }
  }, []);

  // 使用浏览器原生 API 的备选方案
  const initializeBrowserAPI = useCallback(() => {
    const updateState = () => {
      const connection = (navigator as any)?.connection;
      const newState: NetworkState = {
        isOnline: navigator.onLine,
        connectionType: getConnectionType(connection?.type || connection?.effectiveType),
        effectiveType: connection?.effectiveType || '4g',
        downlink: connection?.downlink || 10,
        rtt: connection?.rtt || 100,
        saveData: connection?.saveData || false,
        timestamp: Date.now()
      };
      setNetworkState(newState);
    };

    // 初始状态
    updateState();

    // 事件监听
    window.addEventListener('online', updateState);
    window.addEventListener('offline', updateState);

    const connection = (navigator as any)?.connection;
    if (connection) {
      connection.addEventListener('change', updateState);
    }

    return () => {
      window.removeEventListener('online', updateState);
      window.removeEventListener('offline', updateState);
      if (connection) {
        connection.removeEventListener('change', updateState);
      }
    };
  }, []);

  // 手动检查网络状态
  const checkNetworkState = useCallback(async (): Promise<NetworkState> => {
    if (isChecking) return networkState;

    setIsChecking(true);

    try {
      if (workerRef.current) {
        // 通过 Service Worker 检查
        const messageId = `check_network_${Date.now()}`;
        
        return new Promise((resolve) => {
          const handleResponse = (event: MessageEvent) => {
            if (event.data.type === 'check_network_state_response' && 
                event.data.messageId === messageId) {
              navigator.serviceWorker.removeEventListener('message', handleResponse);
              const newState = event.data.payload.state;
              setNetworkState(newState);
              resolve(newState);
            }
          };

          navigator.serviceWorker.addEventListener('message', handleResponse);
          
          workerRef.current!.postMessage({
            type: 'check_network_state',
            messageId
          });

          // 超时处理
          setTimeout(() => {
            navigator.serviceWorker.removeEventListener('message', handleResponse);
            resolve(networkState);
          }, 5000);
        });
      } else {
        // 使用浏览器 API 检查
        const quality = await testConnectionQuality();
        const connection = (navigator as any)?.connection;
        
        const newState: NetworkState = {
          isOnline: navigator.onLine && quality.isStable,
          connectionType: getConnectionType(connection?.type || connection?.effectiveType),
          effectiveType: connection?.effectiveType || '4g',
          downlink: connection?.downlink || quality.downloadSpeed,
          rtt: connection?.rtt || quality.latency,
          saveData: connection?.saveData || false,
          timestamp: Date.now()
        };

        setNetworkState(newState);
        return newState;
      }
    } catch (error) {
      console.error('useNetworkState: Error checking network state:', error);
      return networkState;
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, networkState]);

  // 测试连接质量
  const testConnectionQuality = async (): Promise<{
    latency: number;
    downloadSpeed: number;
    isStable: boolean;
  }> => {
    const startTime = performance.now();
    
    try {
      const testUrl = '/favicon.ico?' + Date.now();
      const response = await fetch(testUrl, { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      const latency = performance.now() - startTime;
      const downloadSpeed = response.ok ? Math.max(0.1, 1000 / latency) : 0;
      
      return {
        latency,
        downloadSpeed,
        isStable: latency < 1000 && response.ok
      };
    } catch (error) {
      return {
        latency: 9999,
        downloadSpeed: 0,
        isStable: false
      };
    }
  };

  // 清理函数
  const cleanup = useCallback(() => {
    workerRef.current = null;
    listenerIdRef.current = null;
  }, []);

  return {
    networkState,
    isChecking,
    checkNetworkState,
    
    // 便捷方法
    isOnline: networkState.isOnline,
    isOffline: !networkState.isOnline,
    connectionType: networkState.connectionType,
    isSlowNetwork: networkState.effectiveType === 'slow-2g' || 
                    networkState.effectiveType === '2g' ||
                    networkState.downlink < 1.5,
    shouldSaveData: networkState.saveData || 
                    networkState.effectiveType === 'slow-2g' || 
                    networkState.effectiveType === '2g',
    networkQuality: getNetworkQuality(networkState)
  };
};

/**
 * 网络操作保护 Hook
 * 
 * 提供网络依赖操作的保护功能
 */
export const useNetworkProtection = () => {
  const { networkState, isOnline } = useNetworkState();

  /**
   * 包装需要网络的操作
   */
  const withNetworkCheck = useCallback(<T extends any[], R>(
    operation: (...args: T) => Promise<R>,
    options: {
      fallback?: () => R | Promise<R>;
      errorMessage?: string;
      requireStableConnection?: boolean;
    } = {}
  ) => {
    return async (...args: T): Promise<R> => {
      if (!isOnline) {
        if (options.fallback) {
          return await options.fallback();
        }
        throw new Error(options.errorMessage || '网络连接不可用，请检查网络设置');
      }

      if (options.requireStableConnection && networkState.rtt > 2000) {
        throw new Error('网络连接不稳定，请稍后重试');
      }

      return await operation(...args);
    };
  }, [isOnline, networkState]);

  /**
   * 检查是否应该禁用某个操作
   */
  const shouldDisableAction = useCallback((actionType: 'write' | 'read' | 'sync' = 'write'): boolean => {
    if (actionType === 'write') {
      return !isOnline;
    }
    
    if (actionType === 'sync') {
      return !isOnline || networkState.rtt > 5000;
    }
    
    // read 操作在离线时如果有缓存可能仍然可用
    return false;
  }, [isOnline, networkState]);

  return {
    withNetworkCheck,
    shouldDisableAction,
    networkState,
    isOnline
  };
};

// 工具函数

function getConnectionType(type?: string): NetworkState['connectionType'] {
  if (!type) return 'unknown';
  
  const typeMap: { [key: string]: NetworkState['connectionType'] } = {
    'cellular': '4g',
    'wifi': 'wifi',
    'ethernet': 'wifi',
    'bluetooth': '3g',
    'wimax': '4g',
    'other': 'unknown',
    'none': 'unknown',
    'unknown': 'unknown'
  };

  return typeMap[type.toLowerCase()] || 'unknown';
}

function getNetworkQuality(state: NetworkState): number {
  if (!state.isOnline) return 0;

  let score = 100;

  // 根据有效类型调整分数
  const typeScores = {
    'slow-2g': 20,
    '2g': 40,
    '3g': 70,
    '4g': 100
  };
  score = typeScores[state.effectiveType] || 100;

  // 根据延迟调整
  if (state.rtt > 1000) score *= 0.5;
  else if (state.rtt > 500) score *= 0.7;
  else if (state.rtt > 200) score *= 0.9;

  // 根据带宽调整
  if (state.downlink < 0.5) score *= 0.5;
  else if (state.downlink < 1.5) score *= 0.7;
  else if (state.downlink < 5) score *= 0.9;

  return Math.round(Math.max(0, Math.min(100, score)));
}