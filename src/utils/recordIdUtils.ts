import { RecordId } from 'surrealdb';

/**
 * 将 RecordId 转换为字符串，用作 React key
 */
export function recordIdToKey(id: RecordId | string | undefined): string {
  if (!id) return '';
  return String(id);
}

/**
 * 从字符串创建 RecordId
 */
export function stringToRecordId(str: string): RecordId {
  if (str.includes(':')) {
    const [table, id] = str.split(':', 2);
    return new RecordId(table, id);
  }
  throw new Error(`Invalid RecordId format: ${str}`);
}

/**
 * 安全地将字符串转换为 RecordId，如果已经是 RecordId 则直接返回
 */
export function ensureRecordId(value: string | RecordId): RecordId {
  if (typeof value === 'string') {
    return stringToRecordId(value);
  }
  return value;
}

/**
 * 将 RecordId 或字符串转换为标准字符串格式
 */
export function normalizeRecordId(value: string | RecordId | undefined | null): string | null {
  if (!value) return null;
  return String(value);
}
