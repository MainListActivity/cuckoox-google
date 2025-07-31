/**
 * 债权追踪数据同步管理器
 * 专门处理债权操作追踪相关数据的实时同步和通知
 */

import type { Surreal } from 'surrealdb';
import { DataCacheManager } from './data-cache-manager';
import { CacheLogger, LogCategory } from './cache-logger';
import { businessNotificationService } from '../services/businessNotificationService';
import type { UnknownData } from '../types/surreal';

export interface ClaimTrackingEvent {
  type: 'operation' | 'status_change' | 'version_update' | 'access';
  claimId: string;
  data: UnknownData;
  timestamp: number;
  operatorId?: string;
}

/**
 * 债权追踪同步管理器
 */
export class ClaimTrackingSync {
  private localDb: Surreal;
  private remoteDb?: Surreal;  
  private dataCacheManager: DataCacheManager;
  private cacheLogger: CacheLogger;
  private broadcastToAllClients: (message: Record<string, unknown>) => Promise<void>;

  constructor(
    localDb: Surreal,
    dataCacheManager: DataCacheManager,
    broadcastToAllClients: (message: Record<string, unknown>) => Promise<void>,
    remoteDb?: Surreal
  ) {
    this.localDb = localDb;
    this.remoteDb = remoteDb;
    this.dataCacheManager = dataCacheManager;
    this.broadcastToAllClients = broadcastToAllClients;
    this.cacheLogger = new CacheLogger();
  }

  /**
   * 处理债权操作更新
   */
  async handleClaimOperationUpdate(data: UnknownData): Promise<void> {
    try {
      this.cacheLogger.info(LogCategory.SYNC, 'Processing claim operation update', {
        claimId: data.claim_id,
        operationType: data.operation_type
      }, 'ClaimTrackingSync');

      // 更新本地缓存
      await this.updateLocalCache('claim_operation_log', data);
      
      // 发送业务通知
      if (data.operation_type && data.operator_id) {
        await businessNotificationService.notifyClaimOperation(
          data.claim_id as string,
          String(data.operation_type),
          data.operator_id as string,
          data.operation_description ? String(data.operation_description) : undefined
        );
      }

      // 通知相关页面
      await this.broadcastToAllClients({
        type: 'claim_operation_updated',
        data: {
          claimId: data.claim_id,
          operationType: data.operation_type,
          timestamp: Date.now()
        }
      });
      
      // 触发相关统计更新
      await this.updateStatisticsCache(data.claim_id as string);

    } catch (error) {
      this.cacheLogger.error(LogCategory.SYNC, 'Failed to handle claim operation update', {
        error: error instanceof Error ? error.message : 'Unknown error',
        claimId: data.claim_id
      }, 'ClaimTrackingSync');
    }
  }

  /**
   * 处理状态流转更新
   */
  async handleStatusTransition(data: UnknownData): Promise<void> {
    try {
      this.cacheLogger.info(LogCategory.SYNC, 'Processing status transition', {
        claimId: data.claim_id,
        fromStatus: data.from_status,
        toStatus: data.to_status
      }, 'ClaimTrackingSync');

      // 更新状态流转缓存
      await this.updateLocalCache('claim_status_flow', data);
      
      // 发送通知
      await this.sendStatusChangeNotification(data);
      
      // 更新相关统计
      await this.updateStatusStatistics(data.claim_id as string);

      // 通知前端状态变更
      await this.broadcastToAllClients({
        type: 'claim_status_changed',
        data: {
          claimId: data.claim_id,
          fromStatus: data.from_status,
          toStatus: data.to_status,
          timestamp: Date.now()
        }
      });

    } catch (error) {
      this.cacheLogger.error(LogCategory.SYNC, 'Failed to handle status transition', {
        error: error instanceof Error ? error.message : 'Unknown error',
        claimId: data.claim_id
      }, 'ClaimTrackingSync');
    }
  }

  /**
   * 处理版本历史更新
   */
  async handleVersionUpdate(data: UnknownData): Promise<void> {
    try {
      this.cacheLogger.info(LogCategory.SYNC, 'Processing version update', {
        claimId: data.claim_id,
        versionNumber: data.version_number
      }, 'ClaimTrackingSync');

      // 更新版本历史缓存
      await this.updateLocalCache('claim_version_history', data);
      
      // 发送版本变更通知
      if (data.version_number) {
        await businessNotificationService.notifyClaimVersionUpdate(
          data.claim_id as string,
          Number(data.version_number),
          data.change_summary ? String(data.change_summary) : undefined,
          data.changed_by as string
        );
      }
      
      // 通知前端版本变更
      await this.broadcastToAllClients({
        type: 'claim_version_updated',
        data: {
          claimId: data.claim_id,
          versionNumber: data.version_number,
          timestamp: Date.now()
        }
      });

    } catch (error) {
      this.cacheLogger.error(LogCategory.SYNC, 'Failed to handle version update', {
        error: error instanceof Error ? error.message : 'Unknown error',
        claimId: data.claim_id
      }, 'ClaimTrackingSync');
    }
  }

  /**
   * 处理访问日志更新
   */
  async handleAccessLog(data: UnknownData): Promise<void> {
    try {
      // 访问日志通常不需要实时通知，直接更新缓存即可
      await this.updateLocalCache('claim_access_log', data);
      
      this.cacheLogger.debug(LogCategory.SYNC, 'Updated access log', {
        claimId: data.claim_id,
        accessType: data.access_type,
        accessorId: data.accessor_id
      }, 'ClaimTrackingSync');

    } catch (error) {
      this.cacheLogger.error(LogCategory.SYNC, 'Failed to handle access log', {
        error: error instanceof Error ? error.message : 'Unknown error',
        claimId: data.claim_id
      }, 'ClaimTrackingSync');
    }
  }

  /**
   * 更新本地缓存
   */
  private async updateLocalCache(table: string, data: UnknownData): Promise<void> {
    try {
      // 使用DataCacheManager的本地数据库连接
      const query = `CREATE ${table} CONTENT $data`;
      await this.localDb.query(query, { data });
      
      this.cacheLogger.debug(LogCategory.CACHE, 'Updated local cache', {
        table,
        dataId: data.id
      }, 'ClaimTrackingSync');

    } catch (error) {
      this.cacheLogger.error(LogCategory.CACHE, 'Failed to update local cache', {
        table,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'ClaimTrackingSync');
      throw error;
    }
  }

  /**
   * 发送状态变更通知
   */
  private async sendStatusChangeNotification(data: UnknownData): Promise<void> {
    try {
      // 使用业务通知服务发送状态变更通知
      await businessNotificationService.notifyClaimStatusChange(
        data.claim_id as string,
        data.from_status ? String(data.from_status) : '未知',
        String(data.to_status),
        data.operator_id as string,
        data.transition_notes ? String(data.transition_notes) : undefined
      );

      this.cacheLogger.info(LogCategory.NOTIFICATION, 'Sent status change notification', {
        claimId: data.claim_id,
        fromStatus: data.from_status,
        toStatus: data.to_status,
        operatorId: data.operator_id
      }, 'ClaimTrackingSync');

    } catch (error) {
      this.cacheLogger.error(LogCategory.NOTIFICATION, 'Failed to send status change notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        claimId: data.claim_id
      }, 'ClaimTrackingSync');
    }
  }

  /**
   * 更新统计缓存
   */
  private async updateStatisticsCache(claimId: string): Promise<void> {
    try {
      // 这里可以触发统计数据的重新计算
      // 例如更新债权处理效率、质量指标等
      this.cacheLogger.debug(LogCategory.STATS, 'Updating statistics cache', {
        claimId
      }, 'ClaimTrackingSync');

    } catch (error) {
      this.cacheLogger.error(LogCategory.STATS, 'Failed to update statistics cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
        claimId
      }, 'ClaimTrackingSync');
    }
  }

  /**
   * 更新状态统计
   */
  private async updateStatusStatistics(claimId: string): Promise<void> {
    try {
      // 更新状态流转相关的统计数据
      this.cacheLogger.debug(LogCategory.STATS, 'Updating status statistics', {
        claimId
      }, 'ClaimTrackingSync');

    } catch (error) {
      this.cacheLogger.error(LogCategory.STATS, 'Failed to update status statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        claimId
      }, 'ClaimTrackingSync');
    }
  }

  /**
   * 清理过期的追踪数据
   */
  async cleanupExpiredData(): Promise<void> {
    try {
      const tables = ['claim_operation_log', 'claim_version_history', 'claim_status_flow', 'claim_access_log'];
      
      for (const table of tables) {
        // 清理超过一年的数据（根据业务需求调整）
        const cutoffDate = new Date();
        cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
        
        const query = `DELETE FROM ${table} WHERE operation_time < $cutoff OR created_at < $cutoff`;
        await this.localDb.query(query, { cutoff: cutoffDate.toISOString() });
      }

      this.cacheLogger.info(LogCategory.MAINTENANCE, 'Cleaned up expired tracking data', {
        cutoffDate: cutoffDate.toISOString()
      }, 'ClaimTrackingSync');

    } catch (error) {
      this.cacheLogger.error(LogCategory.MAINTENANCE, 'Failed to cleanup expired data', {
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'ClaimTrackingSync');
    }
  }
}