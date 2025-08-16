import { RecordId } from 'surrealdb';

export const idToStr = (id: RecordId | string): string =>
  typeof id === 'string' ? id : String(id); // SurrealDB RecordId stringifies as table:id

export const strToId = (id: string): RecordId | null => {
  const parts = id.split(':');
  if (parts.length !== 2) {
    return null;
  }
  return new RecordId(parts[0], parts[1]);
}