import { AuthenticationRequiredError } from '@/src/contexts/SurrealProvider';
import type { SurrealWorkerAPI } from '@/src/contexts/SurrealProvider';

/**
 * Execute a query with authentication check
 * Automatically prepends 'return $auth;' to the SQL query
 * Returns the query result (starting from index 1) if authenticated
 * Throws AuthenticationRequiredError if not authenticated
 */
export async function queryWithAuth<T = unknown>(
  client: SurrealWorkerAPI, 
  sql: string, 
  vars?: Record<string, unknown>
): Promise<T> {
  const authQuery = `return $auth;${sql}`;
  
  const raw = await client.query(authQuery, vars);
  
  // The service worker now returns the complete results array from SurrealDB
  let results: any[];
  if (Array.isArray(raw)) {
    results = raw;
  } else {
    throw new Error('Unexpected query result format: expected array from service worker');
  }
  
  // Check if we have at least 2 results (auth + actual data)
  if (results.length < 2) {
    throw new Error('Authentication check failed: insufficient results');
  }
  
  // Check authentication status from first result
  const authResult = results[0];
  const isAuthenticated = authResult && 
    typeof authResult === 'object';
  
  if (!isAuthenticated) {
    throw new AuthenticationRequiredError('用户未登录，请先登录');
  }
  
  // Return the actual query result (from index 1)
  const actualResult = results[1];
  if (actualResult && typeof actualResult === 'object') {
    return actualResult as T;
  }
  
  return actualResult as T;
}

/**
 * Execute a mutation with authentication check
 */
export async function mutateWithAuth<T = unknown>(
  client: SurrealWorkerAPI,
  sql: string, 
  vars?: Record<string, unknown>
): Promise<T> {
  const authQuery = `return $auth;${sql}`;
  
  const raw = await client.mutate(authQuery, vars);
  
  // The service worker now returns the complete results array from SurrealDB
  let results: any[];
  if (Array.isArray(raw)) {
    results = raw;
  } else {
    throw new Error('Unexpected mutation result format: expected array from service worker');
  }
  
  // Check if we have at least 2 results (auth + actual data)
  if (results.length < 2) {
    throw new Error('Authentication check failed: insufficient results');
  }
  
  // Check authentication status from first result
  const authResult = results[0];
  const isAuthenticated = authResult && 
    typeof authResult === 'object' && 
    'result' in authResult && 
    authResult.result !== null && 
    authResult.result !== undefined;
  
  if (!isAuthenticated) {
    throw new AuthenticationRequiredError('用户未登录，请先登录');
  }
  
  // Return the actual mutation result (from index 1)
  const actualResult = results[1];
  if (actualResult && typeof actualResult === 'object' && 'result' in actualResult) {
    return actualResult.result as T;
  }
  
  return actualResult as T;
}