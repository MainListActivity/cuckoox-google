import type Surreal from 'surrealdb';
import type { SurrealWorkerAPI } from '@/src/lib/surrealServiceWorkerClient';

export type SurrealLike = Surreal | SurrealWorkerAPI;