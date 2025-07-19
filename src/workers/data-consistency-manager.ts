import type { UnknownData } from '../types/surreal';
import { RecordId } from 'surrealdb';

/**
 * 数据冲突类型
 */
export interface DataConflict {
  id: string;
  table: string;
  recordId: string | RecordId;
  localData: UnknownData;
  remoteData: UnknownData;
  conflictFields: string[];
  timestamp: number;
  resolutionStrategy?: ConflictResolutionStrategy;
  resolved?: boolean;
  resolvedData?: UnknownData;
}

/**
 * 冲突解决策略
 */
export type ConflictResolutionStrategy = 
  | 'local_wins'      // 本地数据优先
  | 'remote_wins'     // 远程数据优先
  | 'merge'           // 智能合并
  | 'timestamp_wins'  // 时间戳较新的优先
  | 'manual'          // 手动解决
  | 'field_level';    // 字段级别解决

/**
 * 数据版本信息
 */
export interface DataVersion {
  recordId: string | RecordId;
  version: number;
  timestamp: number;
  checksum: string;
  userId?: string;
}

/**
 * 事务操作
 */
export interface TransactionOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  recordId?: string | RecordId;
  data?: UnknownData;
  previousData?: UnknownData;
  timestamp: number;
  userId?: string;
  status: 'pending' | 'committed' | 'rolled_back';
}

/**
 * 数据一致性管理器
 * 负责数据完整性检查、版本管理和冲突解决
 */
export class DataConsistencyManager {
  private conflicts = new Map<string, DataConflict>();
  private dataVersions = new Map<string, DataVersion>();
  private transactions = new Map<string, TransactionOperation[]>();
  private broadcastToAllClients: (message: Record<string, unknown>) => Promise<void>;
  private localDb: any;
  private remoteDb?: any;

  // 字段类型定义
  private fieldTypes = new Map<string, Record<string, string>>();
  private requiredFields = new Map<string, string[]>();

  constructor(config: {
    localDb: any;
    remoteDb?: any;
    broadcastToAllClients: (message: Record<string, unknown>) => Promise<void>;
  }) {
    this.localDb = config.localDb;
    this.remoteDb = config.remoteDb;
    this.broadcastToAllClients = config.broadcastToAllClients;
    
    this.initializeSchemaDefinitions();
    console.log('DataConsistencyManager: Initialized');
  }

  /**
   * 初始化数据库模式定义
   */
  private initializeSchemaDefinitions(): void {
    // 定义常见表的必需字段
    this.requiredFields.set('user', ['id', 'username']);
    this.requiredFields.set('case', ['id', 'name', 'status']);
    this.requiredFields.set('claim', ['id', 'case_id', 'amount']);
    this.requiredFields.set('creditor', ['id', 'name']);
    
    // 定义字段类型
    this.fieldTypes.set('user', {
      id: 'string',
      username: 'string',
      email: 'string',
      created_at: 'datetime',
      updated_at: 'datetime'
    });
    
    this.fieldTypes.set('case', {
      id: 'string',
      name: 'string',
      status: 'string',
      created_at: 'datetime',
      updated_at: 'datetime'
    });
    
    console.log('DataConsistencyManager: Schema definitions initialized');
  }

  /**
   * 验证数据完整性
   */
  async validateDataIntegrity(table: string, data: UnknownData[]): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      const requiredFields = this.requiredFields.get(table) || [];
      const fieldTypes = this.fieldTypes.get(table) || {};
      
      for (let i = 0; i < data.length; i++) {
        const record = data[i];
        const recordPrefix = `Record ${i + 1}`;
        
        // 检查必需字段
        for (const field of requiredFields) {
          if (!(field in record) || record[field] === null || record[field] === undefined) {
            errors.push(`${recordPrefix}: Missing required field '${field}'`);
          }
        }
        
        // 检查字段类型
        for (const [field, expectedType] of Object.entries(fieldTypes)) {
          if (field in record && record[field] !== null && record[field] !== undefined) {
            const isValidType = this.validateFieldType(record[field], expectedType);
            if (!isValidType) {
              errors.push(`${recordPrefix}: Invalid type for field '${field}', expected ${expectedType}`);
            }
          }
        }
        
        // 检查记录ID格式
        if ('id' in record && record.id) {
          if (typeof record.id === 'string') {
            if (!record.id.includes(':')) {
              warnings.push(`${recordPrefix}: ID '${record.id}' may not be in correct format (table:id)`);
            }
          } else if (!(record.id instanceof RecordId)) {
            errors.push(`${recordPrefix}: ID must be string or RecordId`);
          }
        }
      }
      
      const isValid = errors.length === 0;
      
      if (!isValid) {
        console.error(`DataConsistencyManager: Data integrity validation failed for table ${table}:`, errors);
      } else if (warnings.length > 0) {
        console.warn(`DataConsistencyManager: Data integrity warnings for table ${table}:`, warnings);
      }
      
      return { isValid, errors, warnings };
      
    } catch (error) {
      console.error('DataConsistencyManager: Error during data integrity validation:', error);
      return {
        isValid: false,
        errors: [`Validation error: ${error}`],
        warnings: []
      };
    }
  }

  /**
   * 验证字段类型
   */
  private validateFieldType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'datetime':
        return value instanceof Date || 
               (typeof value === 'string' && !isNaN(Date.parse(value)));
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true; // 未知类型，跳过验证
    }
  }

  /**
   * 检测数据冲突
   */
  async detectConflict(
    table: string,
    recordId: string | RecordId,
    localData: UnknownData,
    remoteData: UnknownData
  ): Promise<DataConflict | null> {
    try {
      const conflictFields: string[] = [];
      
      // 比较所有字段
      const allFields = new Set([
        ...Object.keys(localData),
        ...Object.keys(remoteData)
      ]);
      
      for (const field of allFields) {
        const localValue = localData[field];
        const remoteValue = remoteData[field];
        
        // 跳过时间戳字段的比较（通常会不同）
        if (field === 'updated_at' || field === 'modified_at') {
          continue;
        }
        
        if (!this.isEqual(localValue, remoteValue)) {
          conflictFields.push(field);
        }
      }
      
      if (conflictFields.length === 0) {
        return null; // 没有冲突
      }
      
      const conflict: DataConflict = {
        id: crypto.randomUUID(),
        table,
        recordId,
        localData,
        remoteData,
        conflictFields,
        timestamp: Date.now(),
        resolved: false
      };
      
      this.conflicts.set(conflict.id, conflict);
      
      console.log(`DataConsistencyManager: Conflict detected for ${table}:${recordId}`, conflictFields);
      
      // 广播冲突检测
      await this.broadcastConflictDetected(conflict);
      
      return conflict;
      
    } catch (error) {
      console.error('DataConsistencyManager: Error detecting conflict:', error);
      return null;
    }
  }

  /**
   * 深度比较两个值是否相等
   */
  private isEqual(a: any, b: any): boolean {
    if (a === b) return true;
    
    if (a == null || b == null) return a === b;
    
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false;
      
      if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (!this.isEqual(a[i], b[i])) return false;
        }
        return true;
      }
      
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      if (keysA.length !== keysB.length) return false;
      
      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.isEqual(a[key], b[key])) return false;
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * 解决数据冲突
   */
  async resolveConflict(
    conflictId: string,
    strategy: ConflictResolutionStrategy,
    manualData?: UnknownData
  ): Promise<UnknownData> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }
    
    let resolvedData: UnknownData;
    
    try {
      switch (strategy) {
        case 'local_wins':
          resolvedData = { ...conflict.localData };
          break;
          
        case 'remote_wins':
          resolvedData = { ...conflict.remoteData };
          break;
          
        case 'merge':
          resolvedData = this.mergeData(conflict.localData, conflict.remoteData);
          break;
          
        case 'timestamp_wins':
          resolvedData = this.resolveByTimestamp(conflict.localData, conflict.remoteData);
          break;
          
        case 'manual':
          if (!manualData) {
            throw new Error('Manual resolution requires resolved data');
          }
          resolvedData = { ...manualData };
          break;
          
        case 'field_level':
          resolvedData = this.resolveFieldLevel(conflict);
          break;
          
        default:
          throw new Error(`Unknown resolution strategy: ${strategy}`);
      }
      
      // 更新冲突状态
      conflict.resolutionStrategy = strategy;
      conflict.resolved = true;
      conflict.resolvedData = resolvedData;
      
      console.log(`DataConsistencyManager: Conflict ${conflictId} resolved using ${strategy} strategy`);
      
      // 广播冲突解决
      await this.broadcastConflictResolved(conflict);
      
      return resolvedData;
      
    } catch (error) {
      console.error(`DataConsistencyManager: Failed to resolve conflict ${conflictId}:`, error);
      throw error;
    }
  }

  /**
   * 智能合并数据
   */
  private mergeData(localData: UnknownData, remoteData: UnknownData): UnknownData {
    const merged = { ...remoteData }; // 以远程数据为基础
    
    // 合并本地的非空值
    for (const [key, value] of Object.entries(localData)) {
      if (value !== null && value !== undefined && value !== '') {
        // 如果远程数据中该字段为空，使用本地值
        if (merged[key] === null || merged[key] === undefined || merged[key] === '') {
          merged[key] = value;
        }
        // 对于数组，合并去重
        else if (Array.isArray(value) && Array.isArray(merged[key])) {
          merged[key] = [...new Set([...merged[key], ...value])];
        }
      }
    }
    
    return merged;
  }

  /**
   * 根据时间戳解决冲突
   */
  private resolveByTimestamp(localData: UnknownData, remoteData: UnknownData): UnknownData {
    const localTimestamp = this.extractTimestamp(localData);
    const remoteTimestamp = this.extractTimestamp(remoteData);
    
    if (localTimestamp && remoteTimestamp) {
      return localTimestamp > remoteTimestamp ? localData : remoteData;
    }
    
    // 如果无法确定时间戳，默认使用远程数据
    return remoteData;
  }

  /**
   * 提取时间戳
   */
  private extractTimestamp(data: UnknownData): number | null {
    const timestampFields = ['updated_at', 'modified_at', 'timestamp', 'last_modified'];
    
    for (const field of timestampFields) {
      if (field in data) {
        const value = data[field];
        if (value instanceof Date) {
          return value.getTime();
        }
        if (typeof value === 'string') {
          const parsed = Date.parse(value);
          if (!isNaN(parsed)) {
            return parsed;
          }
        }
        if (typeof value === 'number') {
          return value;
        }
      }
    }
    
    return null;
  }

  /**
   * 字段级别冲突解决
   */
  private resolveFieldLevel(conflict: DataConflict): UnknownData {
    const resolved = { ...conflict.remoteData };
    
    // 对于特定字段，应用特定的解决策略
    for (const field of conflict.conflictFields) {
      const localValue = conflict.localData[field];
      const remoteValue = conflict.remoteData[field];
      
      // 根据字段类型和业务逻辑决定
      if (field === 'status' || field === 'state') {
        // 状态字段通常使用远程值
        resolved[field] = remoteValue;
      } else if (field === 'name' || field === 'title' || field === 'description') {
        // 文本字段使用非空且更长的值
        if (!remoteValue && localValue) {
          resolved[field] = localValue;
        } else if (typeof localValue === 'string' && typeof remoteValue === 'string') {
          resolved[field] = localValue.length > remoteValue.length ? localValue : remoteValue;
        }
      } else if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
        // 数组字段合并去重
        resolved[field] = [...new Set([...remoteValue, ...localValue])];
      } else {
        // 默认使用远程值
        resolved[field] = remoteValue;
      }
    }
    
    return resolved;
  }

  /**
   * 开始事务
   */
  async beginTransaction(transactionId: string): Promise<void> {
    if (this.transactions.has(transactionId)) {
      throw new Error(`Transaction ${transactionId} already exists`);
    }
    
    this.transactions.set(transactionId, []);
    console.log(`DataConsistencyManager: Transaction ${transactionId} started`);
  }

  /**
   * 添加事务操作
   */
  async addTransactionOperation(
    transactionId: string,
    operation: Omit<TransactionOperation, 'id' | 'timestamp' | 'status'>
  ): Promise<void> {
    const operations = this.transactions.get(transactionId);
    if (!operations) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    const transactionOp: TransactionOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      status: 'pending'
    };
    
    operations.push(transactionOp);
    console.log(`DataConsistencyManager: Added operation to transaction ${transactionId}: ${operation.type} on ${operation.table}`);
  }

  /**
   * 提交事务
   */
  async commitTransaction(transactionId: string): Promise<void> {
    const operations = this.transactions.get(transactionId);
    if (!operations) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    try {
      // 标记所有操作为已提交
      for (const operation of operations) {
        operation.status = 'committed';
      }
      
      console.log(`DataConsistencyManager: Transaction ${transactionId} committed with ${operations.length} operations`);
      
      // 清理事务
      this.transactions.delete(transactionId);
      
    } catch (error) {
      console.error(`DataConsistencyManager: Failed to commit transaction ${transactionId}:`, error);
      await this.rollbackTransaction(transactionId);
      throw error;
    }
  }

  /**
   * 回滚事务
   */
  async rollbackTransaction(transactionId: string): Promise<void> {
    const operations = this.transactions.get(transactionId);
    if (!operations) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    try {
      // 按相反顺序回滚操作
      const reversedOps = [...operations].reverse();
      
      for (const operation of reversedOps) {
        if (operation.status === 'committed') {
          await this.rollbackOperation(operation);
        }
        operation.status = 'rolled_back';
      }
      
      console.log(`DataConsistencyManager: Transaction ${transactionId} rolled back`);
      
      // 清理事务
      this.transactions.delete(transactionId);
      
    } catch (error) {
      console.error(`DataConsistencyManager: Failed to rollback transaction ${transactionId}:`, error);
      throw error;
    }
  }

  /**
   * 回滚单个操作
   */
  private async rollbackOperation(operation: TransactionOperation): Promise<void> {
    if (!this.localDb) return;
    
    try {
      switch (operation.type) {
        case 'create':
          // 删除创建的记录
          if (operation.recordId) {
            await this.localDb.delete(operation.recordId);
          }
          break;
          
        case 'update':
          // 恢复之前的数据
          if (operation.recordId && operation.previousData) {
            await this.localDb.update(operation.recordId, operation.previousData);
          }
          break;
          
        case 'delete':
          // 恢复删除的记录
          if (operation.recordId && operation.previousData) {
            await this.localDb.create(operation.recordId, operation.previousData);
          }
          break;
      }
      
      console.log(`DataConsistencyManager: Rolled back operation ${operation.id}: ${operation.type} on ${operation.table}`);
      
    } catch (error) {
      console.error(`DataConsistencyManager: Failed to rollback operation ${operation.id}:`, error);
      throw error;
    }
  }

  /**
   * 广播冲突检测
   */
  private async broadcastConflictDetected(conflict: DataConflict): Promise<void> {
    await this.broadcastToAllClients({
      type: 'data_conflict_detected',
      payload: {
        conflictId: conflict.id,
        table: conflict.table,
        recordId: conflict.recordId,
        conflictFields: conflict.conflictFields,
        timestamp: conflict.timestamp
      }
    });
  }

  /**
   * 广播冲突解决
   */
  private async broadcastConflictResolved(conflict: DataConflict): Promise<void> {
    await this.broadcastToAllClients({
      type: 'data_conflict_resolved',
      payload: {
        conflictId: conflict.id,
        table: conflict.table,
        recordId: conflict.recordId,
        resolutionStrategy: conflict.resolutionStrategy,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 获取所有冲突
   */
  getConflicts(): DataConflict[] {
    return Array.from(this.conflicts.values());
  }

  /**
   * 获取未解决的冲突
   */
  getUnresolvedConflicts(): DataConflict[] {
    return Array.from(this.conflicts.values()).filter(c => !c.resolved);
  }

  /**
   * 清除已解决的冲突
   */
  clearResolvedConflicts(): void {
    const resolvedConflicts = Array.from(this.conflicts.entries())
      .filter(([_, conflict]) => conflict.resolved);
    
    for (const [id, _] of resolvedConflicts) {
      this.conflicts.delete(id);
    }
    
    console.log(`DataConsistencyManager: Cleared ${resolvedConflicts.length} resolved conflicts`);
  }

  /**
   * 关闭数据一致性管理器
   */
  async close(): Promise<void> {
    console.log('DataConsistencyManager: Closing...');
    
    // 清理所有数据
    this.conflicts.clear();
    this.dataVersions.clear();
    this.transactions.clear();
    
    console.log('DataConsistencyManager: Closed successfully');
  }
}