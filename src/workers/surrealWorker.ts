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

  async close(): Promise<void> {
    await this.db.close();
  }
}

expose(new SurrealWorkerImpl());