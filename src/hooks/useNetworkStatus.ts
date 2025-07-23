import { useState, useEffect, useCallback } from 'react';

// 网络状态接口
interface NetworkStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  connectionType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

// 连接质量评估
type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

interface NetworkStatusHook extends NetworkStatus {
  quality: ConnectionQuality;
  retryCount: number;
  lastRetryTime: Date | null;
  testConnection: () => Promise<boolean>;
  retry: () => void;
  resetRetryCount: () => void;
}

// 获取网络信息（如果支持）
const getNetworkInfo = (): Partial<NetworkStatus> => {
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    return {
      connectionType: connection.effectiveType || 'unknown',
      downlink: connection.downlink || 0,
      rtt: connection.rtt || 0,
      saveData: connection.saveData || false,
    };
  }
  return {
    connectionType: 'unknown',
    downlink: 0,
    rtt: 0,
    saveData: false,
  };
};

// 评估连接质量
const assessConnectionQuality = (networkStatus: NetworkStatus): ConnectionQuality => {
  if (!networkStatus.isOnline) {
    return 'offline';
  }

  if (networkStatus.isSlowConnection) {
    return 'poor';
  }

  const { downlink, rtt } = networkStatus;
  
  if (downlink >= 10 && rtt <= 100) {
    return 'excellent';
  } else if (downlink >= 5 && rtt <= 200) {
    return 'good';
  } else if (downlink >= 1 && rtt <= 500) {
    return 'fair';
  } else {
    return 'poor';
  }
};

// 测试网络连接
const testNetworkConnection = async (): Promise<boolean> => {
  try {
    // 使用当前域名进行连接测试，避免CORS问题
    const response = await fetch(`${window.location.origin}/api/health`, {
      method: 'HEAD',
      cache: 'no-cache',
      signal: AbortSignal.timeout(5000), // 5秒超时
    });
    return response.ok;
  } catch (error) {
    console.warn('Network connection test failed:', error);
    return false;
  }
};

// 检测慢连接
const detectSlowConnection = (networkInfo: Partial<NetworkStatus>): boolean => {
  const { downlink, rtt, connectionType } = networkInfo;
  
  // 基于网络类型判断
  if (connectionType === '2g' || connectionType === 'slow-2g') {
    return true;
  }
  
  // 基于速度和延迟判断
  if (downlink && downlink < 0.5) {
    return true;
  }
  
  if (rtt && rtt > 1000) {
    return true;
  }
  
  return false;
};

export const useNetworkStatus = (): NetworkStatusHook => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [networkInfo, setNetworkInfo] = useState<Partial<NetworkStatus>>(getNetworkInfo());
  const [retryCount, setRetryCount] = useState(0);
  const [lastRetryTime, setLastRetryTime] = useState<Date | null>(null);

  const isSlowConnection = detectSlowConnection(networkInfo);

  const networkStatus: NetworkStatus = {
    isOnline,
    isSlowConnection,
    connectionType: networkInfo.connectionType || 'unknown',
    downlink: networkInfo.downlink || 0,
    rtt: networkInfo.rtt || 0,
    saveData: networkInfo.saveData || false,
  };

  const quality = assessConnectionQuality(networkStatus);

  // 测试连接
  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      const isConnected = await testNetworkConnection();
      setIsOnline(isConnected);
      return isConnected;
    } catch (error) {
      console.error('Connection test error:', error);
      setIsOnline(false);
      return false;
    }
  }, []);

  // 重试连接
  const retry = useCallback(async () => {
    setRetryCount(prev => prev + 1);
    setLastRetryTime(new Date());
    await testConnection();
  }, [testConnection]);

  // 重置重试计数
  const resetRetryCount = useCallback(() => {
    setRetryCount(0);
    setLastRetryTime(null);
  }, []);

  // 监听在线状态变化
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      resetRetryCount();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [resetRetryCount]);

  // 监听网络信息变化
  useEffect(() => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      const updateNetworkInfo = () => {
        setNetworkInfo(getNetworkInfo());
      };

      connection.addEventListener('change', updateNetworkInfo);
      
      return () => {
        connection.removeEventListener('change', updateNetworkInfo);
      };
    }
  }, []);

  // 定期测试连接（当离线时）
  useEffect(() => {
    if (!isOnline) {
      const interval = setInterval(async () => {
        const isConnected = await testConnection();
        if (isConnected) {
          resetRetryCount();
        }
      }, 30000); // 每30秒测试一次

      return () => clearInterval(interval);
    }
  }, [isOnline, testConnection, resetRetryCount]);

  return {
    ...networkStatus,
    quality,
    retryCount,
    lastRetryTime,
    testConnection,
    retry,
    resetRetryCount,
  };
};