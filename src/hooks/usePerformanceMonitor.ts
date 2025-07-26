import { useState, useEffect, useCallback } from 'react';
import type { PerformanceMetrics, AppShellState } from '../workers/pwa-performance-manager';

interface UsePerformanceMonitorOptions {
  /**
   * 自动刷新间隔（毫秒）
   */
  refreshInterval?: number;
  
  /**
   * 是否启用自动刷新
   */
  autoRefresh?: boolean;
  
  /**
   * 性能阈值配置
   */
  thresholds?: {
    fcp: { good: number; fair: number };
    lcp: { good: number; fair: number };
    fid: { good: number; fair: number };
    memory: number; // MB
  };
}

interface PerformanceState {
  metrics: PerformanceMetrics;
  appShellState: AppShellState;
  isLoading: boolean;
  lastUpdate: Date | null;
  error: string | null;
}

/**
 * PWA性能监控Hook
 * 
 * 提供应用性能指标监控和管理功能
 */
export const usePerformanceMonitor = (options: UsePerformanceMonitorOptions = {}) => {
  const {
    refreshInterval = 30000,
    autoRefresh = true,
    thresholds = {
      fcp: { good: 1800, fair: 3000 },
      lcp: { good: 2500, fair: 4000 },
      fid: { good: 100, fair: 300 },
      memory: 150
    }
  } = options;

  const [state, setState] = useState<PerformanceState>({
    metrics: {
      fcp: 0,
      lcp: 0,
      fid: 0,
      cls: 0,
      ttfb: 0,
      memoryUsage: 0,
      cacheHitRate: 0
    },
    appShellState: {
      isLoaded: false,
      coreResourcesCount: 0,
      loadedResourcesCount: 0,
      loadingProgress: 0,
      lastUpdated: new Date()
    },
    isLoading: false,
    lastUpdate: null,
    error: null
  });

  // 监听浏览器性能指标
  useEffect(() => {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return;
    }

    // 收集已有的性能指标
    collectBrowserMetrics();

    // 设置性能观察器
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        processBrowserPerformanceEntries(list.getEntries());
      });

      try {
        observer.observe({ 
          entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift', 'navigation'] 
        });
      } catch (error) {
        console.warn('usePerformanceMonitor: Failed to setup PerformanceObserver:', error);
      }

      return () => observer.disconnect();
    }
  }, []);

  // 自动刷新Service Worker数据
  useEffect(() => {
    // 初始加载
    loadServiceWorkerData();

    if (autoRefresh) {
      const interval = setInterval(loadServiceWorkerData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const collectBrowserMetrics = useCallback(() => {
    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');

      const fcp = paint.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0;
      const ttfb = navigation?.responseStart - navigation?.requestStart || 0;

      setState(prev => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          fcp,
          ttfb
        }
      }));
    } catch (error) {
      console.error('usePerformanceMonitor: Error collecting browser metrics:', error);
    }
  }, []);

  const processBrowserPerformanceEntries = useCallback((entries: PerformanceEntry[]) => {
    const updates: Partial<PerformanceMetrics> = {};

    entries.forEach((entry) => {
      switch (entry.entryType) {
        case 'paint':
          if (entry.name === 'first-contentful-paint') {
            updates.fcp = entry.startTime;
          }
          break;

        case 'largest-contentful-paint':
          updates.lcp = (entry as PerformancePaintTiming).startTime;
          break;

        case 'first-input':
          updates.fid = (entry as PerformanceEventTiming).processingStart - entry.startTime;
          break;

        case 'layout-shift':
          // CLS 需要累积计算
          updates.cls = (state.metrics.cls || 0) + (entry as PerformanceEntry & { value: number }).value;
          break;

        case 'navigation':
          const navEntry = entry as PerformanceNavigationTiming;
          updates.ttfb = navEntry.responseStart - navEntry.requestStart;
          break;
      }
    });

    if (Object.keys(updates).length > 0) {
      setState(prev => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          ...updates
        }
      }));
    }
  }, [state.metrics.cls]);

  const loadServiceWorkerData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await Promise.all([
        loadPerformanceMetrics(),
        loadAppShellState()
      ]);

      setState(prev => ({
        ...prev,
        isLoading: false,
        lastUpdate: new Date()
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '加载性能数据失败'
      }));
    }
  }, []);

  const loadPerformanceMetrics = async (): Promise<void> => {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      
      if (registration.active) {
        const messageId = `perf_metrics_${Date.now()}`;
        
        return new Promise((resolve) => {
          const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'get_performance_metrics_response' && 
                event.data.messageId === messageId) {
              navigator.serviceWorker.removeEventListener('message', handleMessage);
              
              setState(prev => ({
                ...prev,
                metrics: {
                  ...prev.metrics,
                  ...event.data.payload.metrics
                }
              }));
              
              resolve();
            }
          };

          navigator.serviceWorker.addEventListener('message', handleMessage);
          
          registration.active!.postMessage({
            type: 'get_performance_metrics',
            messageId
          });

          // 超时处理
          setTimeout(() => {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
            resolve();
          }, 5000);
        });
      }
    } catch (error) {
      console.error('usePerformanceMonitor: Error loading performance metrics:', error);
    }
  };

  const loadAppShellState = async (): Promise<void> => {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      
      if (registration.active) {
        const messageId = `app_shell_${Date.now()}`;
        
        return new Promise((resolve) => {
          const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'get_app_shell_state_response' && 
                event.data.messageId === messageId) {
              navigator.serviceWorker.removeEventListener('message', handleMessage);
              
              setState(prev => ({
                ...prev,
                appShellState: event.data.payload.state
              }));
              
              resolve();
            }
          };

          navigator.serviceWorker.addEventListener('message', handleMessage);
          
          registration.active!.postMessage({
            type: 'get_app_shell_state',
            messageId
          });

          // 超时处理
          setTimeout(() => {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
            resolve();
          }, 5000);
        });
      }
    } catch (error) {
      console.error('usePerformanceMonitor: Error loading App Shell state:', error);
    }
  };

  const preloadResources = useCallback(async (urls: string[]): Promise<void> => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker not supported');
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      if (registration.active) {
        registration.active.postMessage({
          type: 'preload_resources',
          payload: { urls }
        });
      }
    } catch (error) {
      console.error('usePerformanceMonitor: Error preloading resources:', error);
      throw error;
    }
  }, []);

  const forceMemoryCleanup = useCallback(async (): Promise<void> => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker not supported');
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      
      if (registration.active) {
        registration.active.postMessage({
          type: 'force_memory_cleanup'
        });

        // 等待清理完成后刷新数据
        setTimeout(() => {
          loadServiceWorkerData();
        }, 2000);
      }
    } catch (error) {
      console.error('usePerformanceMonitor: Error during memory cleanup:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, [loadServiceWorkerData]);

  const refresh = useCallback(async (): Promise<void> => {
    await loadServiceWorkerData();
  }, [loadServiceWorkerData]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // 性能评级
  const getPerformanceGrade = useCallback((
    metric: number, 
    threshold: { good: number; fair: number }
  ): 'good' | 'fair' | 'poor' => {
    if (metric <= threshold.good) return 'good';
    if (metric <= threshold.fair) return 'fair';
    return 'poor';
  }, []);

  const performanceGrades = {
    fcp: getPerformanceGrade(state.metrics.fcp, thresholds.fcp),
    lcp: getPerformanceGrade(state.metrics.lcp, thresholds.lcp),
    fid: getPerformanceGrade(state.metrics.fid, thresholds.fid),
    overall: (() => {
      const grades = [
        getPerformanceGrade(state.metrics.fcp, thresholds.fcp),
        getPerformanceGrade(state.metrics.lcp, thresholds.lcp),
        getPerformanceGrade(state.metrics.fid, thresholds.fid)
      ];
      
      if (grades.every(grade => grade === 'good')) return 'good';
      if (grades.some(grade => grade === 'poor')) return 'poor';
      return 'fair';
    })()
  };

  return {
    // 状态
    ...state,
    
    // 性能评级
    performanceGrades,
    
    // 操作方法
    refresh,
    preloadResources,
    forceMemoryCleanup,
    clearError,
    
    // 便捷状态
    isAppShellReady: state.appShellState.isLoaded,
    memoryPressure: state.metrics.memoryUsage > thresholds.memory,
    needsOptimization: performanceGrades.overall !== 'good',
    
    // 格式化工具
    formatTime: (ms: number) => {
      if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
      return `${Math.round(ms)}ms`;
    },
    
    formatMemory: (mb: number) => {
      if (mb >= 1024) return `${(mb / 1024).toFixed(2)}GB`;
      return `${Math.round(mb)}MB`;
    }
  };
};

export default usePerformanceMonitor;