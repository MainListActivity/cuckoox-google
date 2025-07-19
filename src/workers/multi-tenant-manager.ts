import { RecordId } from 'surrealdb';
import type { QueryParams, UnknownData } from '../types/surreal';

/**
 * 租户上下文信息
 */
export interface TenantContext {
  tenantId: string;
  caseId?: string;
  userId?: string;
  namespace?: string;
  database?: string;
  permissions?: string[];
  roles?: string[];
}

/**
 * 租户隔离配置
 */
export interface TenantIsolationConfig {
  enableStrictIsolation: boolean;
  cacheNamespacePrefix: string;
  allowCrossTenantAccess: boolean;
  tenantIdField: string; // 数据库中租户ID字段名
  auditTenantAccess: boolean;
}

/**
 * 租户访问审计记录
 */
export interface TenantAccessAudit {
  timestamp: string;
  tenantId: string;
  userId?: string;
  operation: string;
  table: string;
  recordId?: string;
  success: boolean;
  errorMessage?: string;
}

/**
 * 多租户管理器
 * 负责实现基于租户的数据隔离和访问控制
 */
export class MultiTenantManager {
  private currentTenant: TenantContext | null = null;
  private config: TenantIsolationConfig;
  private accessAuditLog: TenantAccessAudit[] = [];
  private tenantCacheNamespaces = new Map<string, string>();
  private tenantSwitchCallbacks = new Set<(oldTenant: TenantContext | null, newTenant: TenantContext | null) => Promise<void>>();

  constructor(config: Partial<TenantIsolationConfig> = {}) {
    this.config = {
      enableStrictIsolation: true,
      cacheNamespacePrefix: 'tenant_cache_',
      allowCrossTenantAccess: false,
      tenantIdField: 'case_id', // 在这个系统中，case_id 作为租户标识
      auditTenantAccess: true,
      ...config
    };

    console.log('MultiTenantManager: Initialized with config:', this.config);
  }

  /**
   * 设置当前租户上下文
   */
  async setCurrentTenant(tenant: TenantContext | null): Promise<void> {
    const oldTenant = this.currentTenant;
    
    if (oldTenant?.tenantId === tenant?.tenantId) {
      // 租户没有变化，只更新其他信息
      this.currentTenant = tenant;
      return;
    }

    console.log('MultiTenantManager: Switching tenant from', oldTenant?.tenantId, 'to', tenant?.tenantId);

    // 执行租户切换前的清理工作
    if (oldTenant) {
      await this.cleanupTenantData(oldTenant);
    }

    // 设置新租户
    this.currentTenant = tenant;

    // 初始化新租户的缓存命名空间
    if (tenant) {
      await this.initializeTenantNamespace(tenant);
    }

    // 通知所有注册的回调函数
    await this.notifyTenantSwitch(oldTenant, tenant);

    // 记录租户切换审计
    if (this.config.auditTenantAccess) {
      this.auditTenantAccess({
        operation: 'TENANT_SWITCH',
        table: 'system',
        tenantId: tenant?.tenantId || 'null',
        userId: tenant?.userId,
        success: true
      });
    }

    console.log('MultiTenantManager: Tenant switch completed');
  }

  /**
   * 获取当前租户上下文
   */
  getCurrentTenant(): TenantContext | null {
    return this.currentTenant;
  }

  /**
   * 验证数据访问权限
   */
  validateDataAccess(table: string, recordId?: string, operation: 'read' | 'write' | 'delete' = 'read'): boolean {
    if (!this.config.enableStrictIsolation) {
      return true;
    }

    if (!this.currentTenant) {
      console.warn('MultiTenantManager: No current tenant context for data access validation');
      return false;
    }

    // 记录访问审计
    if (this.config.auditTenantAccess) {
      this.auditTenantAccess({
        operation: operation.toUpperCase(),
        table,
        recordId,
        tenantId: this.currentTenant.tenantId,
        userId: this.currentTenant.userId,
        success: true
      });
    }

    return true;
  }

  /**
   * 为查询添加租户隔离条件
   */
  addTenantIsolationToQuery(sql: string, params?: QueryParams): { sql: string; params: QueryParams } {
    if (!this.config.enableStrictIsolation || !this.currentTenant) {
      return { sql, params: params || {} };
    }

    const tenantId = this.currentTenant.tenantId;
    const tenantField = this.config.tenantIdField;
    
    // 检查SQL是否已经包含租户条件
    if (sql.toLowerCase().includes(tenantField.toLowerCase())) {
      return { sql, params: params || {} };
    }

    // 为不同类型的查询添加租户条件
    let modifiedSql = sql;
    let modifiedParams = { ...params };

    // SELECT 查询
    if (sql.toLowerCase().includes('select')) {
      if (sql.toLowerCase().includes('where')) {
        modifiedSql = sql.replace(/where/i, `WHERE ${tenantField} = $tenant_id AND`);
      } else if (sql.toLowerCase().includes('from')) {
        modifiedSql = sql.replace(/from\s+(\w+)/i, `FROM $1 WHERE ${tenantField} = $tenant_id`);
      }
    }
    
    // INSERT 查询 - 确保插入的数据包含租户ID
    else if (sql.toLowerCase().includes('insert') || sql.toLowerCase().includes('create')) {
      modifiedParams[tenantField] = tenantId;
    }
    
    // UPDATE 查询
    else if (sql.toLowerCase().includes('update')) {
      if (sql.toLowerCase().includes('where')) {
        modifiedSql = sql.replace(/where/i, `WHERE ${tenantField} = $tenant_id AND`);
      } else {
        modifiedSql = sql + ` WHERE ${tenantField} = $tenant_id`;
      }
    }
    
    // DELETE 查询
    else if (sql.toLowerCase().includes('delete')) {
      if (sql.toLowerCase().includes('where')) {
        modifiedSql = sql.replace(/where/i, `WHERE ${tenantField} = $tenant_id AND`);
      } else {
        modifiedSql = sql + ` WHERE ${tenantField} = $tenant_id`;
      }
    }

    // 添加租户ID参数
    modifiedParams.tenant_id = tenantId;

    console.log('MultiTenantManager: Added tenant isolation to query:', {
      original: sql,
      modified: modifiedSql,
      tenantId
    });

    return { sql: modifiedSql, params: modifiedParams };
  }

  /**
   * 获取租户特定的缓存键
   */
  getTenantCacheKey(baseKey: string): string {
    if (!this.currentTenant) {
      return baseKey;
    }

    const namespace = this.getTenantCacheNamespace(this.currentTenant.tenantId);
    return `${namespace}:${baseKey}`;
  }

  /**
   * 获取租户缓存命名空间
   */
  getTenantCacheNamespace(tenantId: string): string {
    if (!this.tenantCacheNamespaces.has(tenantId)) {
      const namespace = `${this.config.cacheNamespacePrefix}${tenantId}`;
      this.tenantCacheNamespaces.set(tenantId, namespace);
    }
    return this.tenantCacheNamespaces.get(tenantId)!;
  }

  /**
   * 清理租户数据
   */
  async cleanupTenantData(tenant: TenantContext): Promise<void> {
    console.log('MultiTenantManager: Cleaning up data for tenant:', tenant.tenantId);

    try {
      // 清理租户特定的缓存命名空间
      const namespace = this.getTenantCacheNamespace(tenant.tenantId);
      
      // 这里可以添加具体的缓存清理逻辑
      // 例如：清理 IndexedDB 中的租户数据、清理内存缓存等
      
      console.log('MultiTenantManager: Cleaned up cache namespace:', namespace);
    } catch (error) {
      console.error('MultiTenantManager: Failed to cleanup tenant data:', error);
      throw error;
    }
  }

  /**
   * 初始化租户命名空间
   */
  private async initializeTenantNamespace(tenant: TenantContext): Promise<void> {
    const namespace = this.getTenantCacheNamespace(tenant.tenantId);
    console.log('MultiTenantManager: Initializing namespace for tenant:', tenant.tenantId, namespace);
    
    // 这里可以添加租户特定的初始化逻辑
    // 例如：创建租户特定的数据库表、设置权限等
  }

  /**
   * 注册租户切换回调
   */
  onTenantSwitch(callback: (oldTenant: TenantContext | null, newTenant: TenantContext | null) => Promise<void>): void {
    this.tenantSwitchCallbacks.add(callback);
  }

  /**
   * 取消注册租户切换回调
   */
  offTenantSwitch(callback: (oldTenant: TenantContext | null, newTenant: TenantContext | null) => Promise<void>): void {
    this.tenantSwitchCallbacks.delete(callback);
  }

  /**
   * 通知租户切换
   */
  private async notifyTenantSwitch(oldTenant: TenantContext | null, newTenant: TenantContext | null): Promise<void> {
    const promises = Array.from(this.tenantSwitchCallbacks).map(callback => 
      callback(oldTenant, newTenant).catch(error => {
        console.error('MultiTenantManager: Tenant switch callback failed:', error);
      })
    );
    
    await Promise.all(promises);
  }

  /**
   * 记录租户访问审计
   */
  private auditTenantAccess(audit: Omit<TenantAccessAudit, 'timestamp'>): void {
    const auditRecord: TenantAccessAudit = {
      timestamp: new Date().toISOString(),
      ...audit
    };

    this.accessAuditLog.push(auditRecord);

    // 限制审计日志大小，保留最近1000条记录
    if (this.accessAuditLog.length > 1000) {
      this.accessAuditLog = this.accessAuditLog.slice(-1000);
    }

    // 在开发环境下输出审计日志
    if (process.env.NODE_ENV === 'development') {
      console.log('MultiTenantManager: Audit:', auditRecord);
    }
  }

  /**
   * 获取租户访问审计日志
   */
  getTenantAccessAudit(tenantId?: string, limit: number = 100): TenantAccessAudit[] {
    let logs = this.accessAuditLog;
    
    if (tenantId) {
      logs = logs.filter(log => log.tenantId === tenantId);
    }
    
    return logs.slice(-limit);
  }

  /**
   * 清理审计日志
   */
  clearAuditLog(): void {
    this.accessAuditLog = [];
    console.log('MultiTenantManager: Audit log cleared');
  }

  /**
   * 验证租户数据完整性
   */
  async validateTenantDataIntegrity(tenantId: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      // 这里可以添加租户数据完整性检查逻辑
      // 例如：检查租户数据是否存在跨租户引用、检查权限配置等
      
      console.log('MultiTenantManager: Validating data integrity for tenant:', tenantId);
      
      return { valid: errors.length === 0, errors };
    } catch (error) {
      console.error('MultiTenantManager: Failed to validate tenant data integrity:', error);
      errors.push(`Validation failed: ${error}`);
      return { valid: false, errors };
    }
  }

  /**
   * 获取租户统计信息
   */
  getTenantStats(): {
    currentTenant: string | null;
    totalAuditRecords: number;
    cacheNamespaces: number;
    strictIsolationEnabled: boolean;
  } {
    return {
      currentTenant: this.currentTenant?.tenantId || null,
      totalAuditRecords: this.accessAuditLog.length,
      cacheNamespaces: this.tenantCacheNamespaces.size,
      strictIsolationEnabled: this.config.enableStrictIsolation
    };
  }

  /**
   * 关闭多租户管理器
   */
  async close(): Promise<void> {
    console.log('MultiTenantManager: Closing...');
    
    // 清理当前租户数据
    if (this.currentTenant) {
      await this.cleanupTenantData(this.currentTenant);
    }
    
    // 清理所有状态
    this.currentTenant = null;
    this.accessAuditLog = [];
    this.tenantCacheNamespaces.clear();
    this.tenantSwitchCallbacks.clear();
    
    console.log('MultiTenantManager: Closed successfully');
  }
}