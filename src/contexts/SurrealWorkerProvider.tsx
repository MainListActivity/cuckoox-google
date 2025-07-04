import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { wrap, Remote } from 'comlink';
import type { SurrealWorkerAPI } from '@/src/workers/surrealWorker';

interface SurrealWorkerProviderProps {
  children: React.ReactNode;
  endpoint: string;
  namespace: string;
  database: string;
}

interface SurrealWorkerContextValue {
  api: Remote<SurrealWorkerAPI> | null;
  isReady: boolean;
  error: Error | null;
}

const SurrealWorkerContext = createContext<SurrealWorkerContextValue | undefined>(undefined);

export const SurrealWorkerProvider: React.FC<SurrealWorkerProviderProps> = ({ children, ...conn }) => {
  const [api, setApi] = useState<Remote<SurrealWorkerAPI> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isReady, setReady] = useState(false);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/surrealWorker.ts', import.meta.url), { type: 'module' });
    const proxy = wrap<SurrealWorkerAPI>(worker);

    (async () => {
      try {
        await proxy.connect(conn);
        setApi(proxy);
        setReady(true);
      } catch (e) {
        setError(e as Error);
      }
    })();

    return () => {
      proxy.close?.();
      worker.terminate();
    };
  }, []);

  const value = useMemo(() => ({ api, isReady, error }), [api, isReady, error]);

  return <SurrealWorkerContext.Provider value={value}>{children}</SurrealWorkerContext.Provider>;
};

export const useSurrealWorker = () => {
  const ctx = useContext(SurrealWorkerContext);
  if (!ctx) throw new Error('useSurrealWorker must be used within SurrealWorkerProvider');
  return ctx;
};