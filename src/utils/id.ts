import { RecordId } from 'surrealdb';

export const idToStr = (id: RecordId | string): string =>
  typeof id === 'string' ? id : String(id); // SurrealDB RecordId stringifies as table:id