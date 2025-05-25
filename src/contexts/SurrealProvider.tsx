import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import Surreal from 'surrealdb';
import {
    QueryClient,
    QueryClientProvider,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';

// Define the shape of the authentication object for SurrealDB
interface SurrealAuth {
    NS?: string;
    DB?: string;
    SC?: string;
    user?: string;
    pass?: string;
    jwt?: string;
    token?: string;
}

// Define the props for the SurrealProvider component
interface SurrealProviderProps {
    children: React.ReactNode;
    client?: QueryClient; // Optional custom QueryClient
    endpoint: string; // SurrealDB endpoint URL
    namespace: string; // SurrealDB namespace
    database: string; // SurrealDB database
    auth?: SurrealAuth; // Optional authentication details
    params?: ConstructorParameters<typeof Surreal>[1]; // Other connection params for Surreal.connect
    token?: string; // Optional token for JWT authentication
    onConnect?: () => void;
    onDisconnect?: (code: number, reason: string) => void;
    onError?: (error: Error) => void;
}

// Create the Surreal instance (singleton)
const surrealInstance = new Surreal();

// Create the SurrealContext
interface SurrealContextValue {
    surreal: Surreal;
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    error: Error | null;
    connect: () => Promise<boolean>;
    disconnect: () => Promise<void>;
    // Re-add signin and signout to the context value if needed for direct use
    signin: (auth: SurrealAuth) => Promise<any>; 
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
    onConnect,
    onDisconnect,
    onError,
}: SurrealProviderProps) {
    const queryClient = useMemo(() => client || new QueryClient(), [client]);
    const [error, setError] = useState<Error | null>(null);
    const [internalStatus, setInternalStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

    const { mutateAsync: connectMutation, status: connectStatus } = useMutation<boolean, Error, void>({
        mutationFn: async () => {
            try {
                if (surrealInstance.status === 'connected') {
                    return true;
                }
                await surrealInstance.connect(endpoint, params);
                await surrealInstance.use({ ns: namespace, db: database });
                if (auth) { // Apply auth if provided during initial connect
                    await surrealInstance.signin(auth);
                } else if (token) { // Or authenticate with token
                    await surrealInstance.authenticate(token);
                }
                return true;
            } catch (e: any) {
                setError(e);
                if (onError) onError(e);
                throw e; // Re-throw to be caught by useMutation's error state
            }
        },
        onSuccess: () => {
            setInternalStatus('connected');
            setError(null);
            if (onConnect) onConnect();
        },
        onError: (e: Error) => {
            setInternalStatus('error');
            setError(e);
            if (onError) onError(e);
        },
    });
    
    useEffect(() => {
        if (connectStatus === 'pending') {
            setInternalStatus('connecting');
        } else if (connectStatus === 'error') {
            setInternalStatus('error');
        } else if (connectStatus === 'success') {
            setInternalStatus('connected');
        }
    }, [connectStatus]);


    const connect = useCallback(async () => {
        if (internalStatus === 'connected' || internalStatus === 'connecting') {
            return internalStatus === 'connected';
        }
        return connectMutation();
    }, [connectMutation, internalStatus]);

    const disconnect = useCallback(async () => {
        await surrealInstance.close();
        setInternalStatus('disconnected');
    }, []);

    // Signin function
    const { mutateAsync: signinMutation } = useMutation<any, Error, SurrealAuth>({
        mutationFn: async (vars: SurrealAuth) => {
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
    const { mutateAsync: signoutMutation } = useMutation<void, Error, void>({
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


    // Handle disconnect events from the Surreal instance
    useEffect(() => {
        const handleSurrealDisconnect = (event: { code: number; reason: string }) => {
            setInternalStatus('disconnected');
            if (onDisconnect) onDisconnect(event.code, event.reason);
        };
        surrealInstance.emitter.on("disconnected", handleSurrealDisconnect);
        return () => {
            surrealInstance.emitter.off("disconnected", handleSurrealDisconnect);
        };
    }, [onDisconnect]);

    const value = useMemo(
        () => ({
            surreal: surrealInstance,
            status: internalStatus,
            error,
            connect,
            disconnect,
            signin: signinMutation,
            signout: signoutMutation,
        }),
        [internalStatus, error, connect, disconnect, signinMutation, signoutMutation]
    );

    return (
        <QueryClientProvider client={queryClient}>
            <SurrealContext.Provider value={value}>
                {children}
            </SurrealContext.Provider>
        </QueryClientProvider>
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
    const context = useContext(SurrealContext);
    if (!context) {
        throw new Error('useSurrealClient must be used within a SurrealProvider');
    }
    return context.surreal;
}

// Re-export common TanStack Query hooks for convenience, typed for SurrealDB
export function useSurrealQuery<TData = unknown, TError = Error>(
    queryKey: string | readonly unknown[],
    queryFn: (client: Surreal) => Promise<TData>,
    options?: Omit<Parameters<typeof useQuery<TData, TError>>[0], 'queryKey' | 'queryFn'>
) {
    const { surreal, status } = useSurreal();
    const queryClientHook = useQueryClient(); // Hook to get the query client instance

    return useQuery<TData, TError>({
        queryKey,
        queryFn: () => queryFn(surreal),
        enabled: status === 'connected' && (options?.enabled ?? true),
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
    const { surreal } = useSurreal();
    const queryClientHook = useQueryClient();

    return useMutation<TData, TError, TVariables>({
        mutationFn: (variables: TVariables) => mutationFn(surreal, variables),
        ...options,
    }, queryClientHook);
}

export { SurrealContext as Context }; // Exporting context for advanced use cases if needed
