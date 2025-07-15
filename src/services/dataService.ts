import { RecordId } from 'surrealdb';
import { SurrealWorkerAPI } from '@/src/lib/surrealServiceWorkerClient';

// Custom error for authentication required
export class AuthenticationRequiredError extends Error {
  constructor(message: string = '用户未登录，请先登录') {
    super(message);
    this.name = 'AuthenticationRequiredError';
  }
}

// Generic query result interface
interface QueryResult<T = unknown> {
  result?: T;
}

// Error handling for session expired
const isSessionExpiredError = (error: any): boolean => {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('session') && msg.includes('expired')) ||
    msg.includes('token expired') ||
    msg.includes('jwt') ||
    msg.includes('unauthorized') ||
    msg.includes('401');
};

// Data Service for database operations
class DataService {
  private client: SurrealWorkerAPI | null = null;
  private onSessionExpired?: () => void;

  /**
   * Set session expired callback
   */
  setSessionExpiredCallback(callback: () => void) {
    this.onSessionExpired = callback;
  }

  /**
   * Allow external injection of a pre-initialised client (e.g. via SurrealProvider).
   */
  setClient(client: SurrealWorkerAPI | null) {
    this.client = client;
  }

  /**
   * Ensure we have a usable Surreal client with a `query` method.
   * Client must be injected via setClient() method.
   */
  private async ensureClient(): Promise<SurrealWorkerAPI> {
    if (this.client && typeof this.client.query === 'function') {
      return this.client;
    }

    throw new Error('SurrealDB client not available. Make sure SurrealProvider is properly initialized.');
  }

  /**
   * Execute a query with error handling and result extraction
   */
  async query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    const client = await this.ensureClient();
    
    try {
      const raw = await client.query<T>(sql, vars);
      
      // Since service worker now returns complete results array, we need to handle accordingly
      // For single queries, extract the first result
      if (Array.isArray(raw) && raw.length > 0) {
        const firstResult = raw[0];
        if (firstResult && typeof firstResult === 'object') {
          return firstResult as T;
        }
        return firstResult as T;
      }
      
      return raw;
    } catch (error) {
      if (isSessionExpiredError(error)) {
        this.onSessionExpired?.();
      }
      throw error;
    }
  }

  /**
   * Execute a mutation with error handling
   */
  async mutate<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    const client = await this.ensureClient();
    
    try {
      const raw = await client.mutate<T>(sql, vars);
      
      // Since service worker now returns complete results array, we need to handle accordingly
      // For single mutations, extract the first result
      if (Array.isArray(raw) && raw.length > 0) {
        const firstResult = raw[0];
        if (firstResult && typeof firstResult === 'object' && 'result' in firstResult) {
          return firstResult.result as T;
        }
        return firstResult as T;
      }
      
      // Handle legacy result formats (for non-service worker clients)
      if (raw && typeof raw === 'object' && 'result' in raw) {
        return (raw as QueryResult<T>).result as T;
      }
      
      return raw;
    } catch (error) {
      if (isSessionExpiredError(error)) {
        this.onSessionExpired?.();
      }
      throw error;
    }
  }

  /**
   * Create a new record
   */
  async create<T = unknown>(thing: string, data: unknown): Promise<T> {
    const client = await this.ensureClient();
    
    try {
      return await client.create(thing, data);
    } catch (error) {
      if (isSessionExpiredError(error)) {
        this.onSessionExpired?.();
      }
      throw error;
    }
  }

  /**
   * Select records
   */
  async select<T = unknown>(thing: string | RecordId): Promise<T> {
    const client = await this.ensureClient();
    
    try {
      return await client.select(thing);
    } catch (error) {
      if (isSessionExpiredError(error)) {
        this.onSessionExpired?.();
      }
      throw error;
    }
  }

  /**
   * Update records
   */
  async update<T = unknown>(thing: string | RecordId, data: unknown): Promise<T> {
    const client = await this.ensureClient();
    
    try {
      return await client.update(thing, data);
    } catch (error) {
      if (isSessionExpiredError(error)) {
        this.onSessionExpired?.();
      }
      throw error;
    }
  }

  /**
   * Merge records
   */
  async merge<T = unknown>(thing: string | RecordId, data: unknown): Promise<T> {
    const client = await this.ensureClient();
    
    try {
      return await client.merge(thing, data);
    } catch (error) {
      if (isSessionExpiredError(error)) {
        this.onSessionExpired?.();
      }
      throw error;
    }
  }

  /**
   * Delete records
   */
  async delete<T = unknown>(thing: string | RecordId): Promise<T> {
    const client = await this.ensureClient();
    
    try {
      return await client.delete(thing);
    } catch (error) {
      if (isSessionExpiredError(error)) {
        this.onSessionExpired?.();
      }
      throw error;
    }
  }

  /**
   * Start a live query
   */
  async live(query: string, callback: (action: string, result: any) => void, vars?: Record<string, unknown>): Promise<string> {
    const client = await this.ensureClient();
    
    try {
      return await client.live(query, callback, vars);
    } catch (error) {
      if (isSessionExpiredError(error)) {
        this.onSessionExpired?.();
      }
      throw error;
    }
  }

  /**
   * Subscribe to live query
   */
  async subscribeLive(uuid: string, callback: (action: string, result: any) => void): Promise<void> {
    const client = await this.ensureClient();
    
    try {
      await client.subscribeLive(uuid, callback);
    } catch (error) {
      if (isSessionExpiredError(error)) {
        this.onSessionExpired?.();
      }
      throw error;
    }
  }

  /**
   * Kill a live query
   */
  async kill(uuid: string): Promise<void> {
    const client = await this.ensureClient();
    
    try {
      await client.kill(uuid);
    } catch (error) {
      if (isSessionExpiredError(error)) {
        this.onSessionExpired?.();
      }
      throw error;
    }
  }

  // High-level business operations

  /**
   * Get paginated results
   */
  async paginate<T = unknown>(
    table: string,
    options: {
      limit?: number;
      offset?: number;
      where?: string;
      orderBy?: string;
      vars?: Record<string, unknown>;
    } = {}
  ): Promise<{ data: T[]; total: number }> {
    const { limit = 10, offset = 0, where, orderBy, vars = {} } = options;
    
    let query = `SELECT * FROM ${table}`;
    if (where) query += ` WHERE ${where}`;
    if (orderBy) query += ` ORDER BY ${orderBy}`;
    query += ` LIMIT ${limit} START ${offset}`;
    
    const countQuery = `SELECT count() AS total FROM ${table}`;
    
    const [data, countResult] = await Promise.all([
      this.query<T[]>(query, vars),
      this.query<Array<{ total: number }>>(countQuery, vars)
    ]);
    
    const total = countResult && countResult.length > 0 ? countResult[0].total : 0;
    
    return {
      data: Array.isArray(data) ? data : [],
      total
    };
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction(queries: Array<{ sql: string; vars?: Record<string, unknown> }>): Promise<unknown[]> {
    const client = await this.ensureClient();
    
    try {
      const transactionSql = queries.map(q => q.sql).join(';');
      const mergedVars = queries.reduce((acc, q) => ({ ...acc, ...q.vars }), {});
      
      return await client.query(transactionSql, mergedVars);
    } catch (error) {
      if (isSessionExpiredError(error)) {
        this.onSessionExpired?.();
      }
      throw error;
    }
  }

  /**
   * Check if a record exists
   */
  async exists(thing: string | RecordId): Promise<boolean> {
    try {
      const result = await this.select(thing);
      return result !== null && result !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Get record count
   */
  async count(table: string, where?: string, vars?: Record<string, unknown>): Promise<number> {
    let query = `SELECT count() AS total FROM ${table}`;
    if (where) query += ` WHERE ${where}`;
    
    const result = await this.query<Array<{ total: number }>>(query, vars);
    return result && result.length > 0 ? result[0].total : 0;
  }

  /**
   * Batch operations
   */
  async batch(operations: Array<{
    type: 'create' | 'update' | 'merge' | 'delete';
    thing: string | RecordId;
    data?: unknown;
  }>): Promise<unknown[]> {
    const client = await this.ensureClient();
    
    try {
      const promises = operations.map(op => {
        switch (op.type) {
          case 'create':
            return client.create(op.thing, op.data);
          case 'update':
            return client.update(op.thing, op.data);
          case 'merge':
            return client.merge(op.thing, op.data);
          case 'delete':
            return client.delete(op.thing);
          default:
            throw new Error(`Unknown operation type: ${op.type}`);
        }
      });
      
      return await Promise.all(promises);
    } catch (error) {
      if (isSessionExpiredError(error)) {
        this.onSessionExpired?.();
      }
      throw error;
    }
  }

  /**
   * Execute a query with authentication check
   * Automatically prepends 'return $auth;' to the SQL query
   * Returns the query result (starting from index 1) if authenticated
   * Throws AuthenticationRequiredError if not authenticated
   */
  async queryWithAuth<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    const authQuery = `return $auth;${sql}`;
    const client = await this.ensureClient();
    
    try {
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
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        throw error; // Re-throw authentication errors as-is
      }
      if (isSessionExpiredError(error)) {
        this.onSessionExpired?.();
      }
      throw error;
    }
  }

  /**
   * Execute a mutation with authentication check
   */
  async mutateWithAuth<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    const authQuery = `return $auth;${sql}`;
    const client = await this.ensureClient();
    
    try {
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
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        throw error; // Re-throw authentication errors as-is
      }
      if (isSessionExpiredError(error)) {
        this.onSessionExpired?.();
      }
      throw error;
    }
  }
}

// Export singleton instance
export const dataService = new DataService();
export default dataService;