import type Surreal from 'surrealdb';
import type { SurrealWorkerAPI } from '@/src/contexts/SurrealProvider';

export type SurrealLike = Surreal | SurrealWorkerAPI;