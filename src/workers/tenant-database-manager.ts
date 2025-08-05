/**
 * 租户数据库管理器
 * 负责管理多租户环境下的数据库连接和切换
 */

import type { DataCacheManager } from './data-cache-manager';

export class TenantDatabaseManager {
  private dataCacheManager: DataCacheManager;
  private currentTenantCode: string | null = null;

  constructor(dataCacheManager: DataCacheManager) {
    this.dataCacheManager = dataCacheManager;
  }

  /**
   * 设置租户数据库
   * @param tenantCode 租户代码
   */
  async setTenantDatabase(tenantCode: string): Promise<void> {
    const namespace = 'ck_go';
    const database = tenantCode;

    // 设置本地数据库
    if (this.dataCacheManager.localDb) {
      await this.dataCacheManager.localDb.use({
        namespace,
        database
      });
    }

    // 设置远程数据库
    if (this.dataCacheManager.remoteDb) {
      await this.dataCacheManager.remoteDb.use({
        namespace,
        database
      });
    }

    this.currentTenantCode = tenantCode;
  }

  /**
   * 获取当前租户代码
   */
  getCurrentTenantCode(): string | null {
    return this.currentTenantCode;
  }

  /**
   * 清除租户数据库连接
   */
  async clearTenantDatabase(): Promise<void> {
    this.currentTenantCode = null;
  }

  /**
   * 检查是否已设置租户数据库
   */
  hasTenantDatabase(): boolean {
    return this.currentTenantCode !== null;
  }
}