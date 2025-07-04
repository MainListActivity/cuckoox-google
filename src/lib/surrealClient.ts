import { wrap, Remote } from 'comlink';
import type { SurrealWorkerAPI } from '@/src/workers/surrealWorker';

// Singleton variables
let clientPromise: Promise<Remote<SurrealWorkerAPI>> | null = null;
let workerRef: Worker | null = null;

/**
 * Obtain a proxy to the SurrealDB worker. The worker will be created lazily on the
 * first invocation and reused for subsequent calls.
 */
export async function surrealClient(): Promise<Remote<SurrealWorkerAPI>> {
  if (clientPromise) return clientPromise;

  workerRef = new Worker(new URL('../workers/surrealWorker.ts', import.meta.url), {
    type: 'module',
  });
  const proxy = wrap<SurrealWorkerAPI>(workerRef);

  clientPromise = (async () => {
    await proxy.connect({
      endpoint: import.meta.env.VITE_SURREALDB_URL || 'http://localhost:8000/rpc',
      namespace: import.meta.env.VITE_SURREALDB_NS || 'test',
      database: import.meta.env.VITE_SURREALDB_DB || 'test',
    });
    return proxy;
  })();

  return clientPromise;
}

/**
 * Clean up the worker and reset the cached client. Call this when you need to fully
 * terminate the SurrealDB connection, e.g. on global logout.
 */
export async function disposeSurrealClient() {
  if (!clientPromise || !workerRef) return;
  try {
    const client = await clientPromise;
    await client.close();
  } catch {
    // ignore
  }
  workerRef.terminate();
  clientPromise = null;
  workerRef = null;
}