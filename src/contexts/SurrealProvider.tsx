import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AnyAuth } from 'surrealdb';
import { surrealClient, disposeSurrealClient } from '@/src/lib/surrealClient';
import type { SurrealWorkerAPI } from '@/src/workers/surrealWorker';
import type { Remote } from 'comlink';

// Token keys kept in worker; provider should not touch localStorage

// No localStorage helpers in provider – worker is single source of truth
// Helper to evaluate if expiry is reached
const isTokenExpired = (expiresAt: number | null) => {
  if (!expiresAt) return true;
  return Date.now() >= expiresAt - 60_000; // 1 min leeway
};

const isSessionExpiredError = (err: any): boolean => {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('session') && msg.includes('expired')) ||
    msg.includes('token expired') ||
    msg.includes('jwt') ||
    msg.includes('unauthorized') ||
    msg.includes('401');
};

interface SurrealProviderProps {
  children: React.ReactNode;
  /** Provide a pre-initialised Surreal-like client (used in unit tests) */
  client?: Remote<SurrealWorkerAPI> | any;
  endpoint: string;
  namespace: string;
  database: string;
  params?: Parameters<SurrealWorkerAPI['connect']>[0]['params'];
  auth?: AnyAuth;
  autoConnect?: boolean;
  onSessionExpired?: () => void;
}

export interface SurrealContextValue {
  surreal: Remote<SurrealWorkerAPI>;
  isConnecting: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  signin: (auth: AnyAuth) => Promise<void>;
  signout: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken?: string, expiresIn?: number) => any;
  clearTokens: () => any;
  getStoredAccessToken: () => string | null;
  handleSessionError: (error: any) => Promise<boolean>;
  setTenantCode: (tenantCode: string) => Promise<void>;
  getTenantCode: () => Promise<string | null>;
}

const SurrealContext = createContext<SurrealContextValue | undefined>(undefined);

export const SurrealProvider: React.FC<SurrealProviderProps> = ({
  children,
  client: externalClient,
  endpoint,
  namespace,
  database,
  params,
  auth,
  autoConnect = true,
  onSessionExpired,
}) => {
  const [client, setClient] = useState<Remote<SurrealWorkerAPI> | any>(externalClient ?? null);
  const [isConnecting, setConnecting] = useState(false);
  const [isSuccess, setSuccess] = useState(false);
  const [isError, setErrorFlag] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const connect = useCallback(async () => {
    if (externalClient) {
      setSuccess(true);
      return true;
    }
    if (isSuccess && client) return true;
    setConnecting(true);
    try {
      const proxy = await surrealClient();

      // 获取存储的租户代码，如果存在则使用租户代码作为database
      const storedTenantCode = await proxy.getTenantCode();
      const effectiveDatabase = storedTenantCode || database;
      
      // 执行完整的连接流程：connect -> use -> authenticate
      await proxy.connect({ 
        endpoint, 
        namespace, 
        database: effectiveDatabase, 
        params, 
        auth 
      });

      // 恢复存储的访问令牌
      const { accessToken } = await proxy.getStoredTokens();
      if (accessToken) {
        try {
          await proxy.authenticate(accessToken);
        } catch (_) {
          // token invalid – clear and optionally notify
          await clearTokens();
          onSessionExpired?.();
        }
      }

      setClient(proxy);
      setSuccess(true);
      setConnecting(false);
      return true;
    } catch (e) {
      // if(e === 'needLogin' || (e instanceof Error && e.message === 'TENANT_CODE_MISSING')){
      //   await clearTokens();
      //   onSessionExpired?.();
      // }
      setError(e as Error);
      setErrorFlag(true);
      setConnecting(false);
      return false;
    }
  }, [isSuccess, client, endpoint, namespace, database, params, auth, onSessionExpired]);

  const disconnect = useCallback(async () => {
    try {
      await disposeSurrealClient();
    } finally {
      setSuccess(false);
      setClient(null);
    }
  }, []);

  const signin = useCallback(async (authInfo: AnyAuth) => {
    if (!client) throw new Error('Surreal client not ready');
    await client.signin(authInfo);
  }, [client]);

  const signout = useCallback(async () => {
    if (!client) return;
    await client.invalidate();
    clearTokens();
  }, [client]);

  const setTokens = useCallback(async (accessToken: string, refreshToken?: string, expiresIn?: number) => {
    let proxy = client;

    // Ensure we have a connected client first
    if (!proxy || typeof proxy.setTokens !== 'function') {
      await connect();
      proxy = client;
    }

    // Fallback – obtain proxy directly if still unavailable
    if (!proxy || typeof proxy.setTokens !== 'function') {
      try {
        proxy = await surrealClient();
        setClient(proxy);
      } catch (e) {
        console.error('SurrealProvider.setTokens: failed to obtain SurrealDB proxy', e);
        return;
      }
    }

    try {
      await proxy.setTokens(accessToken, refreshToken, expiresIn);
    } catch (e) {
      console.error('SurrealProvider.setTokens: error while setting tokens', e);
    }
  }, [client, connect]);

  const clearTokens = useCallback(async () => {
    let proxy = client;

    if (!proxy || typeof proxy.clearTokens !== 'function') {
      await connect();
      proxy = client;
    }

    if (!proxy || typeof proxy.clearTokens !== 'function') {
      try {
        proxy = await surrealClient();
        setClient(proxy);
      } catch (e) {
        console.error('SurrealProvider.clearTokens: failed to obtain SurrealDB proxy', e);
        return;
      }
    }

    try {
      await proxy.clearTokens();
    } catch (e) {
      console.error('SurrealProvider.clearTokens: error while clearing tokens', e);
    }
  }, [client, connect]);

  const getStoredAccessToken = useCallback((): string | null => {
    // Worker is source of truth; direct read unavailable synchronously
    return null;
  }, []);

  const handleSessionError = useCallback<SurrealContextValue['handleSessionError']>(async (e) => {
    if (isSessionExpiredError(e)) {
      await clearTokens();
      onSessionExpired?.();
      return true;
    }
    return false;
  }, [onSessionExpired, clearTokens]);

  const setTenantCode = useCallback(async (tenantCode: string) => {
    let proxy = client;
    
    if (!proxy || typeof proxy.setTenantCode !== 'function') {
      await connect();
      proxy = client;
    }
    
    if (!proxy || typeof proxy.setTenantCode !== 'function') {
      try {
        proxy = await surrealClient();
        setClient(proxy);
      } catch (e) {
        console.error('SurrealProvider.setTenantCode: failed to obtain SurrealDB proxy', e);
        return;
      }
    }
    
    try {
      await proxy.setTenantCode(tenantCode);
      // 重置连接状态以便下次connect时使用新的租户代码
      setSuccess(false);
      await disposeSurrealClient();
    } catch (e) {
      console.error('SurrealProvider.setTenantCode: error while setting tenant code', e);
    }
  }, [client, connect]);

  const getTenantCode = useCallback(async () => {
    let proxy = client;
    
    if (!proxy || typeof proxy.getTenantCode !== 'function') {
      try {
        proxy = await surrealClient();
        setClient(proxy);
      } catch (e) {
        console.error('SurrealProvider.getTenantCode: failed to obtain SurrealDB proxy', e);
        return null;
      }
    }
    
    try {
      return await proxy.getTenantCode();
    } catch (e) {
      console.error('SurrealProvider.getTenantCode: error while getting tenant code', e);
      return null;
    }
  }, [client]);

  // Auto-connect once on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Provide a dummy proxy that has async no-op methods to prevent "x is not a function" runtime errors
  // before the real Surreal worker is ready. Each method simply throws a descriptive error so callers
  // can handle it gracefully (and their existing try / catch will surface a meaningful message).
  const dummySurreal = useMemo(() => {
    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_, prop) {
        return async () => {
          throw new Error(`Surreal client not ready – attempted to call \"${String(prop)}\" before connection established`);
        };
      },
    };
    return new Proxy({}, handler) as unknown as Remote<SurrealWorkerAPI>;
  }, []);

  const value = useMemo<SurrealContextValue>(() => ({
    surreal: (client ?? dummySurreal),
    isConnecting,
    isSuccess,
    isError,
    error,
    connect,
    disconnect,
    signin,
    signout,
    setTokens,
    clearTokens,
    getStoredAccessToken,
    handleSessionError,
    setTenantCode,
    getTenantCode,
  }), [client, dummySurreal, isConnecting, isSuccess, isError, error, connect, disconnect, signin, signout, setTokens, clearTokens, getStoredAccessToken, handleSessionError, setTenantCode, getTenantCode]);

  return <SurrealContext.Provider value={value}>{children}</SurrealContext.Provider>;
};

// Hook re-exports keep original API intact
export const useSurreal = () => {
  const ctx = useContext(SurrealContext);
  if (!ctx) throw new Error('useSurreal must be used within a SurrealProvider');
  return ctx;
};

export const useSurrealClient = () => useSurreal().surreal;

export { SurrealContext as Context };
