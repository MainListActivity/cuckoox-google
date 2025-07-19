import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { pageDataCacheService, PageCacheConfig } from '../services/pageDataCacheService';

export interface UsePageCacheManagerOptions {
  enabled?: boolean; // 是否启用页面缓存
  customConfig?: Partial<PageCacheConfig>; // 自定义缓存配置
  autoActivate?: boolean; // 是否自动激活缓存
  preloadTables?: string[]; // 需要预加载的表
}

export interface UsePageCacheManagerResult {
  isActive: boolean;
  activate: () => Promise<void>;
  deactivate: () => Promise<void>;
  clearCache: () => Promise<void>;
  currentPath: string;
}

/**
 * 页面缓存管理器 Hook
 * 
 * 自动管理页面级别的数据缓存，包括：
 * - 页面进入时自动激活相关数据表的缓存
 * - 页面离开时自动停用缓存
 * - 提供手动控制缓存的接口
 * 
 * @param options 配置选项
 * @returns 缓存管理结果
 */
export function usePageCacheManager(options: UsePageCacheManagerOptions = {}): UsePageCacheManagerResult {
  const { enabled = true, customConfig, autoActivate = true, preloadTables = [] } = options;
  const { user, selectedCaseId } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;
  
  const isActiveRef = useRef(false);
  const previousPathRef = useRef<string | undefined>(undefined);
  
  // 激活页面缓存
  const activate = useCallback(async () => {
    if (!user || !enabled) return;
    
    try {
      console.log('usePageCacheManager: Activating cache for path:', currentPath);
      
      // 构建缓存配置
      const config: Partial<PageCacheConfig> = {
        ...customConfig,
        ...(preloadTables.length > 0 && {
          requiredTables: [
            ...(customConfig?.requiredTables || []),
            ...preloadTables
          ]
        })
      };
      
      await pageDataCacheService.activatePageCache(
        currentPath,
        user.id.toString(),
        selectedCaseId?.toString(),
        config
      );
      
      isActiveRef.current = true;
      
    } catch (error) {
      console.error('usePageCacheManager: Error activating cache:', error);
    }
  }, [user, selectedCaseId, currentPath, enabled, customConfig, preloadTables]);
  
  // 停用页面缓存
  const deactivate = useCallback(async () => {
    if (!user || !isActiveRef.current) return;
    
    try {
      const pathToDeactivate = previousPathRef.current || currentPath;
      console.log('usePageCacheManager: Deactivating cache for path:', pathToDeactivate);
      
      await pageDataCacheService.deactivatePageCache(
        pathToDeactivate,
        user.id.toString(),
        selectedCaseId?.toString()
      );
      
      isActiveRef.current = false;
      
    } catch (error) {
      console.error('usePageCacheManager: Error deactivating cache:', error);
    }
  }, [user, selectedCaseId, currentPath]);
  
  // 清除页面缓存
  const clearCache = useCallback(async () => {
    if (!user) return;
    
    try {
      console.log('usePageCacheManager: Clearing cache for path:', currentPath);
      
      await pageDataCacheService.clearPageCache(
        currentPath,
        user.id.toString(),
        selectedCaseId?.toString()
      );
      
    } catch (error) {
      console.error('usePageCacheManager: Error clearing cache:', error);
    }
  }, [user, selectedCaseId, currentPath]);
  
  // 路径变化时的缓存管理
  useEffect(() => {
    if (!autoActivate) return;
    
    const handlePathChange = async () => {
      // 如果路径变化，先停用之前的缓存
      if (previousPathRef.current && previousPathRef.current !== currentPath && isActiveRef.current) {
        await deactivate();
      }
      
      // 激活新路径的缓存
      if (enabled && user) {
        await activate();
      }
      
      previousPathRef.current = currentPath;
    };
    
    handlePathChange();
    
    // 组件卸载时清理
    return () => {
      if (isActiveRef.current) {
        deactivate();
      }
    };
  }, [currentPath, user, enabled, autoActivate, activate, deactivate]);
  
  // 用户或案件变化时重新激活缓存
  useEffect(() => {
    if (!autoActivate || !enabled) return;
    
    const handleContextChange = async () => {
      if (isActiveRef.current) {
        await deactivate();
      }
      
      if (user) {
        await activate();
      }
    };
    
    handleContextChange();
  }, [user, selectedCaseId, autoActivate, enabled, activate, deactivate]);
  
  return {
    isActive: isActiveRef.current,
    activate,
    deactivate,
    clearCache,
    currentPath
  };
}

/**
 * 简化的页面缓存 Hook
 * 
 * 用于快速为页面添加缓存功能
 * 
 * @param tables 需要缓存的数据表
 * @param options 配置选项
 * @returns 缓存管理结果
 */
export function usePageCache(
  tables: string[],
  options: Omit<UsePageCacheManagerOptions, 'preloadTables'> = {}
): UsePageCacheManagerResult {
  return usePageCacheManager({
    ...options,
    preloadTables: tables
  });
}

/**
 * 条件页面缓存 Hook
 * 
 * 根据条件动态启用/禁用页面缓存
 * 
 * @param condition 启用条件
 * @param tables 需要缓存的数据表
 * @param options 配置选项
 * @returns 缓存管理结果
 */
export function useConditionalPageCache(
  condition: boolean,
  tables: string[],
  options: Omit<UsePageCacheManagerOptions, 'enabled' | 'preloadTables'> = {}
): UsePageCacheManagerResult {
  return usePageCacheManager({
    ...options,
    enabled: condition,
    preloadTables: tables
  });
}

/**
 * 获取页面缓存状态的Hook
 * 
 * 用于监控和调试页面缓存状态
 * 
 * @returns 缓存状态信息
 */
export function usePageCacheStatus() {
  const location = useLocation();
  const currentPath = location.pathname;
  
  const getCacheStatus = useCallback(() => {
    const activeCaches = pageDataCacheService.getActiveCacheStatus();
    const currentCache = activeCaches.find(cache => cache.pagePath === currentPath);
    
    return {
      currentPath,
      isActive: pageDataCacheService.isPageCacheActive(currentPath),
      currentCache,
      allActiveCaches: activeCaches,
      totalActiveCaches: activeCaches.length
    };
  }, [currentPath]);
  
  return getCacheStatus();
}