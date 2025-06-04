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


// Define the props for the SurrealProvider component
interface SurrealProviderProps {
    children: React.ReactNode;
    client?: Surreal;
    endpoint: string; // SurrealDB endpoint URL
    namespace: string; // SurrealDB namespace
    database: string; // SurrealDB database
    auth?: AnyAuth; // Optional authentication details
    params?: Parameters<Surreal["connect"]>[1]; // Other connection params for Surreal.connect
    token?: string; // Optional token for JWT authentication
    onConnect?: () => void;
    onDisconnect?: (code: number, reason: string) => void;
    onError?: (error: Error) => void;
    /** Auto connect on component mount, defaults to true */
    autoConnect?: boolean;
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
}

const SurrealContext = createContext<SurrealContextValue | undefined>(undefined);

// Create the SurrealProvider component
export function SurrealProvider({
                                    children,
                                    client,
                                    endpoint,
                                    namespace,
                                    database,
                                    auth,
                                    params,
                                    token,
                                    onError,
                                    autoConnect = true,
                                }: SurrealProviderProps) {
    const [error, setError] = useState<Error | null>(null);

    const [surrealInstance] = useState(() => client ?? new Surreal());

    const {
        mutateAsync: connectMutation, isPending,
        isSuccess,
        isError,
        reset,
    } = useMutation<boolean, Error, void>({
        mutationFn: async () => {
            try {
                if (surrealInstance.status === 'connected') {
                    return true;
                }
                const conn = await surrealInstance.connect(endpoint, params);
                const useRlt = await surrealInstance.use({namespace: namespace, database: database});
                if (auth) { // Apply auth if provided during initial connect
                    await surrealInstance.signin(auth);
                } else if (token) { // Or authenticate with token
                    await surrealInstance.authenticate(token);
                }
                return conn && useRlt;
            } catch (e: any) {
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
    }, [connectMutation]);

    const disconnect = useCallback(async () => {
        await surrealInstance.close();
    }, []);

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
        if (autoConnect) {
            connect();
        }

        return () => {
            reset();
            surrealInstance.close();
        };
    }, [autoConnect, connect, reset, surrealInstance]);

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
        }),
        [error, connect, disconnect, signinMutation, signoutMutation, isPending, isSuccess, isError]
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
