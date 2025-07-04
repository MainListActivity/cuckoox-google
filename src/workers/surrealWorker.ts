import { expose } from 'comlink';
import Surreal, { AnyAuth, RecordId } from 'surrealdb';

export interface SurrealWorkerAPI {
  connect(options: {
    endpoint: string;
    namespace: string;
    database: string;
    params?: Parameters<Surreal['connect']>[1];
    auth?: AnyAuth;
  }): Promise<boolean>;
  query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T>;
  mutate<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T>;
  /** Wrapper around Surreal.create */
  create(thing: string, data: unknown): Promise<any>;
  /** Wrapper around Surreal.select */
  select(thing: string | RecordId): Promise<any>;
  /** Wrapper around Surreal.update */
  update(thing: string | RecordId, data: unknown): Promise<any>;
  /** Wrapper around Surreal.merge */
  merge(thing: string | RecordId, data: unknown): Promise<any>;
  /** Wrapper around Surreal.delete */
  delete(thing: string | RecordId): Promise<any>;
  /** Wrapper around Surreal.live */
  live(query: string, callback: (action: string, result: any) => void, vars?: Record<string, unknown>): Promise<string>;
  /** Wrapper around Surreal.subscribeLive */
  subscribeLive(uuid: string, callback: (action: string, result: any) => void): Promise<void>;
  /** Kill a live query */
  kill(uuid: string): Promise<void>;
  /** Authenticate with JWT */
  authenticate(token: string): Promise<void>;
  /** Close the underlying SurrealDB connection */
  close(): Promise<void>;
}

class SurrealWorkerImpl implements SurrealWorkerAPI {
  private db = new Surreal();

  async connect({ endpoint, namespace, database, params, auth }: SurrealWorkerAPI['connect'] extends (arg: infer P) => any ? P : never): Promise<boolean> {
    if (this.db.status === 'connected') return true;
    await this.db.connect(endpoint, params);
    await this.db.use({ namespace, database });
    if (auth) {
      await this.db.signin(auth);
    }
    return true;
  }

  async query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    const res = await this.db.query<T[]>(sql, vars);
    // Surreal returns array of result sets; return first for convenience
    return (res as any)[0] as T;
  }

  async mutate<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    const res = await this.db.query<T[]>(sql, vars);
    return (res as any)[0] as T;
  }

  async create(thing: string, data: unknown): Promise<any> {
    return this.db.create(thing as any, data as any);
  }

  async select(thing: string | RecordId): Promise<any> {
    return this.db.select(thing as any);
  }

  async update(thing: string | RecordId, data: unknown): Promise<any> {
    return this.db.update(thing as any, data as any);
  }

  async merge(thing: string | RecordId, data: unknown): Promise<any> {
    return this.db.merge(thing as any, data as any);
  }

  async delete(thing: string | RecordId): Promise<any> {
    return this.db.delete(thing as any);
  }

  async live(query: string, callback: (action: string, result: any) => void, vars?: Record<string, unknown>): Promise<string> {
    // SurrealDB returns a Uuid object; convert to string for easier serialization
    const uuid = await (this.db.live as any)(query, callback as any, vars);
    return String(uuid);
  }

  async subscribeLive(uuid: string, callback: (action: string, result: any) => void): Promise<void> {
    await (this.db.subscribeLive as any)(uuid as any, callback as any);
  }

  async kill(uuid: string): Promise<void> {
    await this.db.kill(uuid as any);
  }

  async authenticate(token: string): Promise<void> {
    await this.db.authenticate(token);
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}

expose(new SurrealWorkerImpl());