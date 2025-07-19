import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useServiceWorkerComm } from '../contexts/SurrealProvider';
// 移除不再存在的 CacheConfig 导入

export interface PageDataCacheConfig {
  // 页面特定的配置
  autoRefresh?: boolean; // 是否自动刷新
  refreshInterval?: number; // 刷新间隔（毫秒）
  preloadData?: boolean; // 是否预加载数据
}

export interface UsePageDataCacheOptions {
  tables: string[]; // 需要缓存的数据表
  config?: PageDataCacheConfig; // 缓存配置
  enabled?: boolean; // 是否启用缓存
}

export interface UsePageDataCacheResult {
  // 缓存状态
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  
  // 数据操作
  queryData: (table: string, query?: string, params?: Record<string, any>) => Promise<any[]>;
  updateData: (table: string, recordId: string, data: any) => Promise<any>;
  refreshData: (table?: string) => Promise<void>;
  
  // 订阅管理
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  
  // 缓存控制
  clearCache: (table?: string) => Promise<void>;
}

/**
 * 页面数据缓存管理 Hook
 * 
 * 用于管理页面级别的数据缓存，支持动态订阅和取消订阅
 * 
 * @param options 配置选项
 * @returns 缓存管理结果
 */
export function usePageDataCache(options: UsePageDataCacheOptions): UsePageDataCacheResult {
  const { user, selectedCaseId } = useAuth();
  const serviceWorkerComm = useServiceWorkerComm();
  const { tables, config = {}, enabled = true } = options;
  
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 使用ref来避免重复订阅
  const subscriptionRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  
  // 生成订阅标识
  const subscriptionId = `${tables.join('_')}_${user?.id}_${selectedCaseId || 'global'}`;
  
  // 默认配置
  const defaultConfig: PageDataCacheConfig = {
    autoRefresh: false,
    refreshInterval: 5 * 60 * 1000, // 5分钟
    preloadData: true,
    ...config
  };

  // 发送消息到Service Worker
  const sendMessageToServiceWorker = useCallback(async (type: string, payload: any): Promise<any> => {
    if (!serviceWorkerComm.isAvailable()) {
      console.warn('usePageDataCache: Service Worker not available');
      return Promise.resolve({ success: true });
    }
    
    try {
      await serviceWorkerComm.waitForReady();
      return await serviceWorkerComm.sendMessage(type, payload);
    } catch (error) {
      console.error('usePageDataCache: Service Worker communication error:', error);
      throw error;
    }
  }, [serviceWorkerComm]);

  // 订阅页面数据
  const subscribe = useCallback(async () => {
    if (!user || !enabled || tables.length === 0) return;
    
    // 避免重复订阅
    if (subscriptionRef.current === subscriptionId) {
      console.log('usePageDataCache: Already subscribed to:', subscriptionId);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('usePageDataCache: Subscribing to tables:', tables);
      
      // 使用页面感知订阅系统
      const result = await sendMessageToServiceWorker('subscribe_page_data', {
        tables,
        userId: user.id.toString(),
        caseId: selectedCaseId?.toString() || null,
        pagePath: window.location.pathname // 获取当前页面路径
      });
      
      if (result.success) {
        subscriptionRef.current = result.pageId || subscriptionId;
        setIsSubscribed(true);
        
        // 如果启用了预加载，预加载数据
        if (defaultConfig.preloadData) {
          await Promise.all(
            tables.map(table => queryData(table, `SELECT * FROM ${table} LIMIT 50`))
          );
        }
        
        console.log('usePageDataCache: Successfully subscribed to:', subscriptionRef.current);
      } else {
        throw new Error(result.error || 'Failed to subscribe');
      }
      
    } catch (err) {
      console.error('usePageDataCache: Error subscribing:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedCaseId, tables, enabled, subscriptionId, defaultConfig, sendMessageToServiceWorker]);

  // 取消订阅页面数据
  const unsubscribe = useCallback(async () => {
    if (!user || !subscriptionRef.current) return;
    
    try {
      console.log('usePageDataCache: Unsubscribing from:', subscriptionRef.current);
      
      // 使用页面感知取消订阅系统
      await sendMessageToServiceWorker('unsubscribe_page_data', {
        tables,
        pageId: subscriptionRef.current
      });
      
      subscriptionRef.current = null;
      setIsSubscribed(false);
      
      console.log('usePageDataCache: Successfully unsubscribed');
      
    } catch (err) {
      console.error('usePageDataCache: Error unsubscribing:', err);
    }
  }, [user, selectedCaseId, tables, sendMessageToServiceWorker]);

  // 查询缓存数据
  const queryData = useCallback(async (
    table: string,
    query?: string,
    params?: Record<string, any>
  ): Promise<any[]> => {
    if (!user) return [];
    
    try {
      const queryString = query || `SELECT * FROM ${table}`;
      
      const result = await sendMessageToServiceWorker('query_cached_data', {
        query: queryString,
        params
      });
      
      return result.data || [];
    } catch (err) {
      console.error('usePageDataCache: Error querying data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return [];
    }
  }, [user, selectedCaseId, sendMessageToServiceWorker]);

  // 更新缓存数据
  const updateData = useCallback(async (
    table: string,
    recordId: string,
    data: any
  ): Promise<any> => {
    if (!user) return null;
    
    try {
      const result = await sendMessageToServiceWorker('update_cached_data', {
        table,
        recordId,
        data,
        userId: user.id.toString(),
        caseId: selectedCaseId?.toString() || null
      });
      
      return result.result;
    } catch (err) {
      console.error('usePageDataCache: Error updating data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  }, [user, selectedCaseId, sendMessageToServiceWorker]);

  // 刷新数据
  const refreshData = useCallback(async (table?: string) => {
    if (!user || !isSubscribed) return;
    
    try {
      console.log('usePageDataCache: Refreshing data for table:', table || 'all tables');
      
      if (table) {
        // 刷新特定表
        await sendMessageToServiceWorker('clear_table_cache', {
          table,
          userId: user.id.toString(),
          caseId: selectedCaseId?.toString() || null
        });
      } else {
        // 刷新所有表
        await Promise.all(
          tables.map(t => sendMessageToServiceWorker('clear_table_cache', {
            table: t,
            userId: user.id.toString(),
            caseId: selectedCaseId?.toString() || null
          }))
        );
      }
      
      // 重新预加载数据
      if (defaultConfig.preloadData) {
        const tablesToRefresh = table ? [table] : tables;
        await Promise.all(
          tablesToRefresh.map(t => queryData(t, `SELECT * FROM ${t} LIMIT 50`))
        );
      }
      
    } catch (err) {
      console.error('usePageDataCache: Error refreshing data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [user, selectedCaseId, isSubscribed, tables, queryData, defaultConfig, sendMessageToServiceWorker]);

  // 清除缓存
  const clearCache = useCallback(async (table?: string) => {
    if (!user) return;
    
    try {
      if (table) {
        await sendMessageToServiceWorker('clear_table_cache', {
          table,
          userId: user.id.toString(),
          caseId: selectedCaseId?.toString() || null
        });
      } else {
        await Promise.all(
          tables.map(t => sendMessageToServiceWorker('clear_table_cache', {
            table: t,
            userId: user.id.toString(),
            caseId: selectedCaseId?.toString() || null
          }))
        );
      }
    } catch (err) {
      console.error('usePageDataCache: Error clearing cache:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [user, selectedCaseId, tables, sendMessageToServiceWorker]);

  // 自动订阅/取消订阅
  useEffect(() => {
    if (!mountedRef.current) return;
    
    if (enabled && user && tables.length > 0) {
      subscribe();
    }
    
    // 组件卸载时取消订阅
    return () => {
      if (subscriptionRef.current) {
        unsubscribe();
      }
    };
  }, [user, selectedCaseId, tables, enabled, subscribe, unsubscribe]);

  // 自动刷新
  useEffect(() => {
    if (!defaultConfig.autoRefresh || !isSubscribed || !defaultConfig.refreshInterval) return;
    
    const interval = setInterval(() => {
      refreshData();
    }, defaultConfig.refreshInterval);
    
    return () => clearInterval(interval);
  }, [defaultConfig.autoRefresh, defaultConfig.refreshInterval, isSubscribed, refreshData]);

  // 清理标记
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    isSubscribed,
    isLoading,
    error,
    queryData,
    updateData,
    refreshData,
    subscribe,
    unsubscribe,
    clearCache
  };
}

/**
 * 简化的页面数据缓存Hook
 * 
 * 用于简单的单表数据缓存场景
 * 
 * @param table 数据表名
 * @param config 缓存配置
 * @returns 缓存管理结果
 */
export function useTableDataCache(
  table: string,
  config?: PageDataCacheConfig
): UsePageDataCacheResult & {
  data: any[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const cacheResult = usePageDataCache({
    tables: [table],
    config,
    enabled: !!table
  });
  
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 加载数据
  const loadData = useCallback(async () => {
    if (!cacheResult.isSubscribed) return;
    
    try {
      setLoading(true);
      const result = await cacheResult.queryData(table);
      setData(result);
    } catch (error) {
      console.error(`useTableDataCache: Error loading data for table ${table}:`, error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [table, cacheResult]);
  
  // 刷新数据
  const refresh = useCallback(async () => {
    await cacheResult.refreshData(table);
    await loadData();
  }, [table, cacheResult, loadData]);
  
  // 当订阅状态改变时加载数据
  useEffect(() => {
    if (cacheResult.isSubscribed) {
      loadData();
    }
  }, [cacheResult.isSubscribed, loadData]);
  
  return {
    ...cacheResult,
    data,
    loading,
    refresh
  };
}

/**
 * 批量数据缓存Hook
 * 
 * 用于需要同时缓存多个表数据的场景
 * 
 * @param tables 数据表配置
 * @param config 全局缓存配置
 * @returns 缓存管理结果
 */
export function useBatchDataCache(
  tables: Array<{ name: string; query?: string; params?: Record<string, any> }>,
  config?: PageDataCacheConfig
): UsePageDataCacheResult & {
  data: Record<string, any[]>;
  loading: boolean;
  refresh: (table?: string) => Promise<void>;
} {
  const tableNames = tables.map(t => t.name);
  const cacheResult = usePageDataCache({
    tables: tableNames,
    config,
    enabled: tables.length > 0
  });
  
  const [data, setData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  
  // 加载所有数据
  const loadAllData = useCallback(async () => {
    if (!cacheResult.isSubscribed) return;
    
    try {
      setLoading(true);
      
      const results = await Promise.all(
        tables.map(async ({ name, query, params }) => {
          const result = await cacheResult.queryData(name, query, params);
          return { name, data: result };
        })
      );
      
      const dataMap = results.reduce((acc, { name, data }) => {
        acc[name] = data;
        return acc;
      }, {} as Record<string, any[]>);
      
      setData(dataMap);
    } catch (error) {
      console.error('useBatchDataCache: Error loading batch data:', error);
      setData({});
    } finally {
      setLoading(false);
    }
  }, [tables, cacheResult]);
  
  // 刷新数据
  const refresh = useCallback(async (table?: string) => {
    await cacheResult.refreshData(table);
    await loadAllData();
  }, [cacheResult, loadAllData]);
  
  // 当订阅状态改变时加载数据
  useEffect(() => {
    if (cacheResult.isSubscribed) {
      loadAllData();
    }
  }, [cacheResult.isSubscribed, loadAllData]);
  
  return {
    ...cacheResult,
    data,
    loading,
    refresh
  };
}