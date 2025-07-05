import { wrap, Remote } from 'comlink';
import type { SurrealWorkerAPI } from '@/src/workers/surrealWorker';

// 租户代码检查错误类型
export class TenantCodeMissingError extends Error {
  constructor(message: string = 'Tenant code is missing') {
    super(message);
    this.name = 'TenantCodeMissingError';
  }
}

// Singleton variables
let clientPromise: Promise<Remote<SurrealWorkerAPI>> | null = null;
let workerRef: Worker | null = null;

/**
 * 检查租户代码是否存在，如果不存在则清除认证状态并重定向到登录页面
 */
export function checkTenantCodeAndRedirect(): boolean {
  const tenantCode = localStorage.getItem('tenant_code');
  
  if (!tenantCode) {
    // 清除认证状态
    localStorage.removeItem('cuckoox-isLoggedIn');
    localStorage.removeItem('cuckoox-user');
    localStorage.removeItem('cuckoox-selectedCaseId');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token_expires_at');
    
    // 重定向到登录页面
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    
    return false;
  }
  
  return true;
}

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
    // 从localStorage获取租户代码，如果存在则使用租户代码作为database
    const tenantCode = localStorage.getItem('tenant_code');
    const database = tenantCode || import.meta.env.VITE_SURREALDB_DB || 'test';
    
    await proxy.connect({
      endpoint: import.meta.env.VITE_SURREALDB_WS_URL || 'http://localhost:8000/rpc',
      namespace: import.meta.env.VITE_SURREALDB_NS || 'test',
      database: database,
    });
    return proxy;
  })();

  return clientPromise;
}

/**
 * 安全的 SurrealDB 客户端获取函数，在非登录页面时检查租户代码
 */
export async function surrealClientSafe(): Promise<Remote<SurrealWorkerAPI>> {
  // 在非登录页面时检查租户代码
  if (window.location.pathname !== '/login' && !checkTenantCodeAndRedirect()) {
    throw new TenantCodeMissingError('Tenant code is missing, redirecting to login');
  }
  
  return surrealClient();
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