import { RecordId } from 'surrealdb';
import { UnifiedSurrealAPI, surrealUnifiedClient } from '@/src/lib/surrealUnifiedClient';

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
  private client: UnifiedSurrealAPI | null = null;
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
  setClient(client: UnifiedSurrealAPI | null) {
    this.client = client;
  }

  /**
   * Ensure we have a usable Surreal client with a `query` method. Falls back to creating
   * (or reusing) the global unified client if the injected client is
   * missing or invalid.
   */
  private async ensureClient(): Promise<UnifiedSurrealAPI> {
    if (this.client && typeof (this.client as any).query === 'function') {
      return this.client;
    }

    // Create / reuse the global unified client
    this.client = await surrealUnifiedClient();
    return this.client;
  }

  /**
   * Execute a query with error handling and result extraction
   */
  async query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    const client = await this.ensureClient();
    
    try {
      const raw = await client.query<T>(sql, vars);
      
      // Handle different result formats
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
   * Execute a mutation with error handling
   */
  async mutate<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    const client = await this.ensureClient();
    
    try {
      const raw = await client.mutate<T>(sql, vars);
      
      // Handle different result formats
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
}

// Export singleton instance
export const dataService = new DataService();
export default dataService;