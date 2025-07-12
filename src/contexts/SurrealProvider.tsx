import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { surrealServiceWorkerClient } from '@/src/lib/surrealServiceWorkerClient';
import type { SurrealWorkerAPI } from '@/src/lib/surrealServiceWorkerClient';
import { dataService } from '@/src/services/dataService';
import { authService } from '@/src/services/authService';
import { userPersonalDataService } from '@/src/services/userPersonalDataService';

interface SurrealProviderProps {
  children: React.ReactNode;
  /** Provide a pre-initialised Surreal-like client (used in unit tests) */
  client?: SurrealWorkerAPI | any;
  autoConnect?: boolean;
}

export interface SurrealContextValue {
  // Data operations (via DataService)
  dataService: typeof dataService;
  
  // Direct service worker client access for raw operations
  client: SurrealWorkerAPI | null;
  
  // Backward compatibility alias
  surreal: SurrealWorkerAPI | null;
  
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  
  // Additional compatibility properties
  isSuccess?: boolean;
  
  // Connection management (internal use)
  reconnect: () => Promise<void>;
  
  // Service Worker communication interface
  sendServiceWorkerMessage: (type: string, payload?: any) => Promise<any>;
  isServiceWorkerAvailable: () => boolean;
  waitForServiceWorkerReady: () => Promise<void>;
  
  // Authentication status from SurrealDB
  getAuthStatus: () => Promise<boolean>;
}

const SurrealContext = createContext<SurrealContextValue | undefined>(undefined);

export const SurrealProvider: React.FC<SurrealProviderProps> = ({
  children,
  client: externalClient,
  autoConnect = true,
}) => {
  const [client, setClient] = useState<SurrealWorkerAPI | null>(externalClient ?? null);
  const [isConnecting, setConnecting] = useState(false);
  const [isConnected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const connect = async () => {
    if (externalClient) {
      setClient(externalClient);
      setConnected(true);
      return;
    }

    if (isConnected && client) return;

    setConnecting(true);
    setError(null);

    try {
      // Use service worker client directly
      const tenantCode = localStorage.getItem('tenant_code');
      const database = tenantCode || 'test';
      
      const syncTokens = {
        access_token: localStorage.getItem('access_token'),
        refresh_token: localStorage.getItem('refresh_token'),
        token_expires_at: localStorage.getItem('token_expires_at'),
        tenant_code: tenantCode,
      };

      const connected = await surrealServiceWorkerClient.connect({
        endpoint: import.meta.env.VITE_SURREALDB_WS_URL || 'ws://localhost:8000/rpc',
        namespace: import.meta.env.VITE_SURREALDB_NS || 'ck_go',
        database: database,
        sync_tokens: syncTokens,
      });

      if (connected) {
        setClient(surrealServiceWorkerClient);
        setConnected(true);
        
        // Inject client into dataService for dependency injection
        dataService.setClient(surrealServiceWorkerClient);
        
        // Inject client into authService for dependency injection
        authService.setSurrealClient(surrealServiceWorkerClient);
        
        // Setup Service Worker communication interfaces
        const serviceWorkerComm = {
          sendMessage: (type: string, payload?: any) => surrealServiceWorkerClient.sendGenericMessage(type, payload),
          isAvailable: () => surrealServiceWorkerClient.isServiceWorkerAvailable(),
          waitForReady: () => surrealServiceWorkerClient.waitForReady(),
        };
        
        userPersonalDataService.setServiceWorkerComm(serviceWorkerComm);
        
        // Setup session expired callback
        dataService.setSessionExpiredCallback(() => {
          setConnected(false);
          setError(new Error('Session expired'));
        });
      } else {
        throw new Error('Failed to connect to database');
      }
      
    } catch (e) {
      setError(e as Error);
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  };

  const reconnect = async () => {
    setConnected(false);
    setClient(null);
    await connect();
  };

  // Service Worker communication methods
  const sendServiceWorkerMessage = async (type: string, payload?: any): Promise<any> => {
    if (externalClient) {
      // For test environments, return mock response
      console.log('SurrealProvider: Mock Service Worker message:', type, payload);
      return Promise.resolve({ success: true });
    }

    if (!client) {
      throw new Error('SurrealDB client not available');
    }

    try {
      return await surrealServiceWorkerClient.sendGenericMessage(type, payload);
    } catch (error) {
      console.error('SurrealProvider: Service Worker communication error:', error);
      throw error;
    }
  };

  const isServiceWorkerAvailable = (): boolean => {
    if (externalClient) {
      // Always return true for test environments
      return true;
    }
    
    return surrealServiceWorkerClient.isServiceWorkerAvailable();
  };

  const waitForServiceWorkerReady = async (): Promise<void> => {
    if (externalClient) {
      // No-op for test environments
      return Promise.resolve();
    }
    
    try {
      await surrealServiceWorkerClient.waitForReady();
    } catch (error) {
      console.error('SurrealProvider: Failed to wait for Service Worker:', error);
      throw error;
    }
  };

  // 从SurrealDB获取认证状态
  const getAuthStatus = async (): Promise<boolean> => {
    if (externalClient) {
      // 测试环境返回mock状态
      return true;
    }

    try {
      return await authService.getAuthStatusFromSurreal();
    } catch (error) {
      console.error('SurrealProvider: 获取认证状态失败:', error);
      return false;
    }
  };

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
  }, [autoConnect]);

  // Provide a dummy proxy that has async no-op methods to prevent "x is not a function" runtime errors
  // before the real Surreal worker is ready.
  const dummyClient = useMemo(() => {
    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_, prop) {
        if (prop === 'query' || prop === 'mutate' || prop === 'create' || prop === 'select' || 
            prop === 'update' || prop === 'merge' || prop === 'delete' || prop === 'live' || 
            prop === 'subscribeLive' || prop === 'kill') {
          // Return a function that indicates the client is not ready
          return () => {
            console.log(`Surreal client not ready – attempted to call "${String(prop)}" before connection established`);
            return Promise.reject(new Error(`Surreal client not ready – attempted to call "${String(prop)}" before connection established`));
          };
        }
        // For other properties, return undefined to indicate they don't exist
        return undefined;
      },
    };
    return new Proxy({}, handler) as unknown as SurrealWorkerAPI;
  }, []);

  const value = useMemo<SurrealContextValue>(() => ({
    dataService,
    // 只有在测试环境中使用 externalClient 时才使用 dummyClient，否则使用真实的 client 或 null
    client: externalClient ? (client ?? dummyClient) : client,
    surreal: externalClient ? (client ?? dummyClient) : client, // Backward compatibility alias
    isConnected,
    isConnecting,
    error,
    isSuccess: isConnected, // Backward compatibility
    reconnect,
    // Service Worker communication interface
    sendServiceWorkerMessage,
    isServiceWorkerAvailable,
    waitForServiceWorkerReady,
    // Authentication status
    getAuthStatus,
  }), [client, dummyClient, isConnected, isConnecting, error, reconnect, sendServiceWorkerMessage, getAuthStatus, externalClient]);

  return <SurrealContext.Provider value={value}>{children}</SurrealContext.Provider>;
};

// Hook exports
export const useSurreal = () => {
  const ctx = useContext(SurrealContext);
  if (!ctx) throw new Error('useSurreal must be used within a SurrealProvider');
  return ctx;
};

export const useSurrealClient = () => useSurreal().client;
export const useDataService = () => useSurreal().dataService;
export const useSurrealContext = useSurreal; // Alias for backward compatibility

// Service Worker communication hooks
export const useServiceWorkerComm = () => {
  const ctx = useSurreal();
  return {
    sendMessage: ctx.sendServiceWorkerMessage,
    isAvailable: ctx.isServiceWorkerAvailable,
    waitForReady: ctx.waitForServiceWorkerReady,
  };
};

export { SurrealContext as Context };