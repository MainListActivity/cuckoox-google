import type Surreal from 'surrealdb';
import type { Remote } from 'comlink';
import type { SurrealWorkerAPI } from '@/src/workers/surrealWorker';

export type SurrealLike = Surreal | Remote<SurrealWorkerAPI>;