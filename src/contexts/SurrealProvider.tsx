import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import Surreal, {AnyAuth} from 'surrealdb';
import {
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { access } from 'node:fs';

// Token storage keys
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TOKEN_EXPIRES_AT_KEY = 'token_expires_at';

// Define the props for the SurrealProvider component
interface SurrealProviderProps {
    children: React.ReactNode;
    client?: Surreal;
    endpoint: string; // SurrealDB endpoint URL
    namespace: string; // SurrealDB namespace
    database: string; // SurrealDB database
    auth?: AnyAuth; // Optional authentication details
    params?: Parameters<Surreal["connect"]>[1]; // Other connection params for Surreal.connect
    onConnect?: () => void;
    onDisconnect?: (code: number, reason: string) => void;
    onError?: (error: Error) => void;
    /** Auto connect on component mount, defaults to true */
    autoConnect?: boolean;
    /** Callback when session expires */
    onSessionExpired?: () => void;
}

// Create the SurrealContext
export interface SurrealContextValue {
    surreal: Surreal;
    /** Whether the connection is pending */
    isConnecting: boolean;
    /** Whether the connection was successfully established */
    isSuccess: boolean;
    /** Whether the connection rejected in an error */
    isError: boolean;
    error: Error | null;
    connect: () => Promise<boolean>;
    disconnect: () => Promise<void>;
    // Re-add signin and signout to the context value if needed for direct use
    signin: (auth: AnyAuth) => Promise<any>;
    signout: () => Promise<void>;
    // Token management methods
    setTokens: (accessToken: string, refreshToken?: string, expiresIn?: number) => void;
    clearTokens: () => void;
    getStoredAccessToken: () => string | null;
    // Session error handling
    handleSessionError: SessionErrorHandler;
}

const SurrealContext = createContext<SurrealContextValue | undefined>(undefined);

// Helper functions for token management
const getStoredTokens = () => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const expiresAtStr = localStorage.getItem(TOKEN_EXPIRES_AT_KEY);
    const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : null;
    
    return { accessToken, refreshToken, expiresAt };
};

const isTokenExpired = (expiresAt: number | null): boolean => {
    if (!expiresAt) return true;
    // Consider token expired if it expires within the next minute
    return Date.now() >= (expiresAt - 60000);
};

// Session and token error checker
const isSessionExpiredError = (error: any): boolean => {
    if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        return errorMessage.includes('session has expired') || 
               errorMessage.includes('session expired') ||
               errorMessage.includes('the session has expired') ||
               errorMessage.includes('token expired') ||
               errorMessage.includes('token has expired') ||
               errorMessage.includes('jwt expired') ||
               errorMessage.includes('jwt has expired') ||
               errorMessage.includes('invalid token') ||
               errorMessage.includes('authentication failed') ||
               errorMessage.includes('unauthorized') ||
               errorMessage.includes('401');
    }
    return false;
};

// Session error handler function type
type SessionErrorHandler = (error: any) => Promise<boolean>;

// Create the SurrealProvider component
export function SurrealProvider({
                                    children,
                                    client,
                                    endpoint,
                                    namespace,
                                    database,
                                    auth,
                                    params,
                                    onError,
                                    autoConnect = true,
                                    onSessionExpired,
                                }: SurrealProviderProps) {
    const [error, setError] = useState<Error | null>(null);

    const [surrealInstance] = useState(() => client ?? new Surreal());

    const {
        mutateAsync: connectMutation, isPending,
        isSuccess,
        isError,
    } = useMutation<boolean, Error, void>({
        mutationFn: async () => {
            try {
                if (surrealInstance.status === 'connected') {
                    return true;
                }
                
                const conn = await surrealInstance.connect(endpoint, params);
                const useRlt = await surrealInstance.use({namespace: namespace, database: database});
                
                // 尝试从localStorage恢复token认证
                const { accessToken, expiresAt } = getStoredTokens();
                
                if (accessToken && !isTokenExpired(expiresAt)) {
                    console.log('Restoring authentication from stored access token');
                    await surrealInstance.authenticate(accessToken);
                } else if (auth) { 
                    // Apply auth if provided during initial connect
                    await surrealInstance.signin(auth);
                } else if (accessToken) { 
                    // Or authenticate with token
                    if (onSessionExpired) {
                        onSessionExpired();
                        // 不设置错误状态，直接返回false，避免显示错误页面
                        return false;
                    }
                }
                
                return conn && useRlt;
            } catch (e: any) {
                // 检查是否为token/session过期错误
                if (isSessionExpiredError(e)) {
                    console.warn('Authentication error during connection, triggering session expired handler');
                    if (onSessionExpired) {
                        onSessionExpired();
                        // 不设置错误状态，直接返回false，避免显示错误页面
                        return false;
                    }
                }
                
                setError(e);
                if (onError) onError(e);
                throw e; // Re-throw to be caught by useMutation's error state
            }
        },
    });

    const connect = useCallback(async () => {
        if (isSuccess) {
            return true;
        }
        return connectMutation();
    }, [connectMutation, isSuccess]);

    const disconnect = useCallback(async () => {
        await surrealInstance.close();
    }, [surrealInstance]);

    // Token management functions
    const setTokens = useCallback((accessToken: string, refreshToken?: string, expiresIn?: number) => {
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        
        if (refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        }
        
        if (expiresIn) {
            const expiresAt = Date.now() + (expiresIn * 1000);
            localStorage.setItem(TOKEN_EXPIRES_AT_KEY, expiresAt.toString());
        }
        
        console.log('Tokens stored in localStorage');
    }, []);

    const clearTokens = useCallback(() => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(TOKEN_EXPIRES_AT_KEY);
        console.log('Tokens cleared from localStorage');
    }, []);

    const getStoredAccessToken = useCallback(() => {
        return localStorage.getItem(ACCESS_TOKEN_KEY);
    }, []);

    const handleSessionError: SessionErrorHandler = useCallback(async (error: any) => {
        if (isSessionExpiredError(error)) {
            console.warn('Authentication error detected in SurrealProvider (session/token expired):', error.message || error);
            if (onSessionExpired) {
                onSessionExpired();
                return true;
            } else {
                console.warn('No authentication error handler registered, clearing tokens as fallback');
                clearTokens();
                return true;
            }
        }
        return false;
    }, [onSessionExpired, clearTokens]);

    // Signin function
    const {mutateAsync: signinMutation} = useMutation<any, Error, AnyAuth>({
        mutationFn: async (vars: AnyAuth) => {
            const result = await surrealInstance.signin(vars);
            // After signin, we might need to re-verify the connection status or re-apply .use if signin scopes to different NS/DB
            // For now, assume signin doesn't change NS/DB from initial setup or handles it internally.
            // If using a general token after signin, that should be handled by the app logic.
            return result;
        },
        onSuccess: () => {
            // Potentially update user state in a higher-level context (e.g. AuthContext)
        },
        onError: (e: Error) => {
            if (onError) onError(e);
        }
    });

    // Signout function
    const {mutateAsync: signoutMutation} = useMutation<void, Error, void>({
        mutationFn: async () => {
            await surrealInstance.invalidate(); // Invalidate session on signout
            clearTokens(); // Clear stored tokens
            // Or use surrealInstance.signout() if it's a specific scope signout and you want to keep connection
        },
        onSuccess: () => {
            // Potentially update user state in a higher-level context
        },
        onError: (e: Error) => {
            if (onError) onError(e);
        }
    });

    // Auto-connect on mount (if enabled) and cleanup on unmount
    useEffect(() => {
        let mounted = true;
        
        const tryConnect = async () => {
            if (mounted && autoConnect && !isSuccess && !isPending && !isError) {
                try {
                    await connectMutation();
                } catch (error) {
                    console.error('Initial connection failed:', error);
                }
            }
        };
        
        tryConnect();

        return () => {
            mounted = false;
            // Don't call reset() here as it might cause issues
            surrealInstance.close();
        };
    }, []); // Empty dependency array - only run once on mount

    // Handle reconnection when connection is lost
    useEffect(() => {
        if (!autoConnect || !isSuccess) {
            return; // Don't set up reconnection if not connected yet
        }
        
        const connectionCheckInterval = setInterval(() => {
            if (surrealInstance.status !== 'connected') {
                console.warn('SurrealDB connection lost, attempting to reconnect...');
                connectMutation().catch(error => {
                    console.error('Reconnection failed:', error);
                });
            }
        }, 10000); // Check every 10 seconds

        return () => {
            clearInterval(connectionCheckInterval);
        };
    }, [isSuccess]); // Only depend on isSuccess to set up monitoring after successful connection

    const value: SurrealContextValue = useMemo(
        () => ({
            surreal: surrealInstance,
            /** Whether the connection is pending */
            isConnecting: isPending,
            /** Whether the connection was successfully established */
            isSuccess,
            /** Whether the connection rejected in an error */
            isError,
            error,
            connect,
            disconnect,
            signin: signinMutation,
            signout: signoutMutation,
            setTokens,
            clearTokens,
            getStoredAccessToken,
            handleSessionError,
        }),
        [surrealInstance, isPending, isSuccess, isError, error, connect, disconnect, signinMutation, signoutMutation, setTokens, clearTokens, getStoredAccessToken, handleSessionError]
    );

    return (
        <SurrealContext.Provider value={value}>
            {children}
        </SurrealContext.Provider>
    );
}

// Custom hook to access the SurrealContext
export function useSurreal() {
    const context = useContext(SurrealContext);
    if (!context) {
        throw new Error('useSurreal must be used within a SurrealProvider');
    }
    return context;
}

// Custom hook to get the Surreal client instance directly
export function useSurrealClient() {
    const {surreal} = useSurreal();
    return surreal;
}

// Re-export common TanStack Query hooks for convenience, typed for SurrealDB
export function useSurrealQuery<TData = unknown, TError = Error>(
    queryKey: readonly unknown[],
    queryFn: (client: Surreal) => Promise<TData>,
    options?: Omit<Parameters<typeof useQuery<TData, TError>>[0], 'queryKey' | 'queryFn'>
) {
    const {surreal, isSuccess} = useSurreal();
    const queryClientHook = useQueryClient(); // Hook to get the query client instance

    return useQuery<TData, TError>({
        queryKey,
        queryFn: () => queryFn(surreal),
        enabled: isSuccess && (options?.enabled ?? true),
        ...options,
    }, queryClientHook); // Pass the query client instance
}

export function useSurrealMutation<
    TData = unknown,
    TError = Error,
    TVariables = void
>(
    mutationFn: (client: Surreal, variables: TVariables) => Promise<TData>,
    options?: Omit<Parameters<typeof useMutation<TData, TError, TVariables>>[0], 'mutationFn'>
) {
    const {surreal} = useSurreal();
    const queryClientHook = useQueryClient();

    return useMutation<TData, TError, TVariables>({
        mutationFn: (variables: TVariables) => mutationFn(surreal, variables),
        ...options,
    }, queryClientHook);
}

export {SurrealContext as Context}; // Exporting context for advanced use cases if needed
