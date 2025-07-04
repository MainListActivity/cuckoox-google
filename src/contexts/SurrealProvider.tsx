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

// Re-exported constants for token storage (kept for backwards compatibility)
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TOKEN_EXPIRES_AT_KEY = 'token_expires_at';

// Helper functions for token management
const getStoredTokens = () => {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const expiresAtStr = localStorage.getItem(TOKEN_EXPIRES_AT_KEY);
  const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : null;
  return { accessToken, refreshToken, expiresAt } as const;
};

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
  setTokens: (accessToken: string, refreshToken?: string, expiresIn?: number) => void;
  clearTokens: () => void;
  getStoredAccessToken: () => string | null;
  handleSessionError: (error: any) => Promise<boolean>;
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

      // If the worker is not yet connected (e.g. singleton initialised elsewhere with default env vars)
      // we perform an explicit connect with the provided props to ensure correct NS/DB.
      try {
        await proxy.connect({ endpoint, namespace, database, params, auth });
      } catch (e) {
        // ignore duplicate connect errors
      }

      // Restore stored access token (if not passed via props)
      const { accessToken, expiresAt } = getStoredTokens();
      if (accessToken && !isTokenExpired(expiresAt)) {
        try {
          await proxy.authenticate(accessToken);
        } catch (_) {
          // token invalid – clear and optionally notify
          clearTokens();
          onSessionExpired?.();
        }
      }

      setClient(proxy);
      setSuccess(true);
      setConnecting(false);
      return true;
    } catch (e) {
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

  const setTokens = useCallback((accessToken: string, refreshToken?: string, expiresIn?: number) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    if (expiresIn) {
      const expiresAt = Date.now() + expiresIn * 1000;
      localStorage.setItem(TOKEN_EXPIRES_AT_KEY, String(expiresAt));
    }
  }, []);

  const clearTokens = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRES_AT_KEY);
  }, []);

  const getStoredAccessToken = useCallback(() => localStorage.getItem(ACCESS_TOKEN_KEY), []);

  const handleSessionError = useCallback<SurrealContextValue['handleSessionError']>(async (e) => {
    if (isSessionExpiredError(e)) {
      clearTokens();
      onSessionExpired?.();
      return true;
    }
    return false;
  }, [onSessionExpired, clearTokens]);

  // Auto-connect once on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<SurrealContextValue>(() => ({
    surreal: (client ?? ({} as Remote<SurrealWorkerAPI>)),
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
  }), [client, isConnecting, isSuccess, isError, error, connect, disconnect, signin, signout, setTokens, clearTokens, getStoredAccessToken, handleSessionError]);

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
