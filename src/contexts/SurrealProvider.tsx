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
  handleSessionError?: (error: any) => void;
  
  // Connection management (internal use)
  reconnect: () => Promise<void>;
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
    client: client ?? dummyClient,
    surreal: client ?? dummyClient, // Backward compatibility alias
    isConnected,
    isConnecting,
    error,
    isSuccess: isConnected, // Backward compatibility
    handleSessionError: (error: any) => {
      console.error('Session error:', error);
      setConnected(false);
      setError(error);
    },
    reconnect,
  }), [client, dummyClient, isConnected, isConnecting, error, reconnect]);

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

export { SurrealContext as Context };