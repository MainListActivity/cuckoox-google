/**
 * 债权版本控制服务
 * 负责债权数据版本快照创建、历史查询和对比功能
 */

import { queryWithAuth } from '@/src/utils/surrealAuth';
import {
  ClaimVersionHistory,
  VersionType,
  VersionDiff,
  FieldChange,
  CreateVersionSnapshotParams
} from '@/src/types/claimTracking';
import type { RecordId } from 'surrealdb';

export class ClaimVersionService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(surrealClient: any) {
    this.client = surrealClient;
  }

  /**
   * 创建版本快照
   */
  async createVersionSnapshot(params: CreateVersionSnapshotParams): Promise<ClaimVersionHistory> {
    try {
      // 获取当前债权数据
      const claimData = await this.getCurrentClaimData(params.claim_id);
      if (!claimData) {
        throw new Error('债权数据不存在');
      }

      // 获取下一个版本号
      const nextVersion = await this.getNextVersionNumber(params.claim_id);

      // 生成数据校验和
      const checksum = await this.generateChecksum(claimData);

      const query = `
        CREATE claim_version_history SET
          claim_id = $claim_id,
          version_number = $version_number,
          version_type = $version_type,
          snapshot_data = $snapshot_data,
          change_summary = $change_summary,
          change_reason = $change_reason,
          created_at = time::now(),
          related_operation_log_id = $related_operation_log_id,
          checksum = $checksum
      `;

      const queryParams = {
        claim_id: params.claim_id,
        version_number: nextVersion,
        version_type: params.version_type,
        snapshot_data: claimData,
        change_summary: params.change_summary,
        change_reason: params.change_reason,
        related_operation_log_id: params.related_operation_log_id,
        checksum
      };

      const results = await queryWithAuth(this.client, query, queryParams) as unknown[][];
      const versionHistory = results[0]?.[0] as ClaimVersionHistory;

      if (!versionHistory) {
        throw new Error('版本快照创建失败');
      }

      // 更新债权表的当前版本号
      await this.updateClaimCurrentVersion(params.claim_id, nextVersion);

      return versionHistory;
    } catch (error) {
      console.error('创建版本快照失败:', error);
      throw new Error('创建版本快照失败');
    }
  }

  /**
   * 获取版本历史
   */
  async getVersionHistory(claimId: string | RecordId): Promise<ClaimVersionHistory[]> {
    try {
      const query = `
        SELECT *
        FROM claim_version_history
        WHERE claim_id = $claim_id
        ORDER BY version_number DESC
      `;

      const results = await queryWithAuth(this.client, query, { claim_id: claimId }) as unknown[][];
      return results[0] as ClaimVersionHistory[] || [];
    } catch (error) {
      console.error('获取版本历史失败:', error);
      throw new Error('获取版本历史失败');
    }
  }

  /**
   * 获取指定版本的数据
   */
  async getVersionData(
    claimId: string | RecordId,
    versionNumber: number
  ): Promise<ClaimVersionHistory | null> {
    try {
      const query = `
        SELECT *
        FROM claim_version_history
        WHERE claim_id = $claim_id AND version_number = $version_number
        LIMIT 1
      `;

      const results = await queryWithAuth(this.client, query, {
        claim_id: claimId,
        version_number: versionNumber
      }) as unknown[][];

      return results[0]?.[0] as ClaimVersionHistory || null;
    } catch (error) {
      console.error('获取版本数据失败:', error);
      throw new Error('获取版本数据失败');
    }
  }

  /**
   * 版本对比
   */
  async compareVersions(params: {
    claimId: string | RecordId;
    fromVersion: number;
    toVersion: number;
  }): Promise<VersionDiff> {
    try {
      const { claimId, fromVersion, toVersion } = params;

      // 获取两个版本的数据
      const [fromVersionData, toVersionData] = await Promise.all([
        this.getVersionData(claimId, fromVersion),
        this.getVersionData(claimId, toVersion)
      ]);

      if (!fromVersionData || !toVersionData) {
        throw new Error('版本数据不存在');
      }

      // 计算差异
      const changes = this.calculateFieldChanges(
        fromVersionData.snapshot_data,
        toVersionData.snapshot_data
      );

      // 生成变更摘要
      const changeSummary = this.generateChangeSummary(changes);

      return {
        claim_id: claimId,
        from_version: fromVersion,
        to_version: toVersion,
        changes,
        change_summary: changeSummary
      };
    } catch (error) {
      console.error('版本对比失败:', error);
      throw new Error('版本对比失败');
    }
  }

  /**
   * 恢复到指定版本
   */
  async revertToVersion(params: {
    claimId: string | RecordId;
    targetVersion: number;
    reason: string;
  }): Promise<ClaimVersionHistory> {
    try {
      const { claimId, targetVersion, reason } = params;

      // 获取目标版本数据
      const targetVersionData = await this.getVersionData(claimId, targetVersion);
      if (!targetVersionData) {
        throw new Error('目标版本不存在');
      }

      // 更新债权数据
      await this.updateClaimData(claimId, targetVersionData.snapshot_data);

      // 创建新的版本快照记录恢复操作
      const newVersion = await this.createVersionSnapshot({
        claim_id: claimId,
        version_type: VersionType.REVIEW_UPDATE,
        change_summary: `恢复到版本 ${targetVersion}`,
        change_reason: reason
      });

      return newVersion;
    } catch (error) {
      console.error('版本恢复失败:', error);
      throw new Error('版本恢复失败');
    }
  }

  /**
   * 验证版本数据完整性
   */
  async validateVersionIntegrity(
    claimId: string | RecordId,
    versionNumber: number
  ): Promise<boolean> {
    try {
      const versionData = await this.getVersionData(claimId, versionNumber);
      if (!versionData) {
        return false;
      }

      // 重新计算校验和
      const calculatedChecksum = await this.generateChecksum(versionData.snapshot_data);
      
      // 比较校验和
      return calculatedChecksum === versionData.checksum;
    } catch (error) {
      console.error('版本完整性验证失败:', error);
      return false;
    }
  }

  /**
   * 清理旧版本
   */
  async cleanupOldVersions(
    claimId: string | RecordId,
    keepVersions: number = 10
  ): Promise<number> {
    try {
      // 获取版本列表
      const versions = await this.getVersionHistory(claimId);
      
      if (versions.length <= keepVersions) {
        return 0; // 不需要清理
      }

      // 保留最新的版本，删除旧版本
      const versionsToDelete = versions.slice(keepVersions);
      const versionIds = versionsToDelete.map(v => v.id).filter(Boolean);

      if (versionIds.length === 0) {
        return 0;
      }

      const query = `
        DELETE FROM claim_version_history
        WHERE id IN $version_ids
      `;

      const results = await queryWithAuth(this.client, query, {
        version_ids: versionIds
      }) as unknown[];

      return results.length;
    } catch (error) {
      console.error('清理旧版本失败:', error);
      throw new Error('清理旧版本失败');
    }
  }

  /**
   * 获取版本统计信息
   */
  async getVersionStatistics(claimId: string | RecordId): Promise<{
    total_versions: number;
    versions_by_type: Record<VersionType, number>;
    latest_version: number;
    first_created: string;
    last_updated: string;
  }> {
    try {
      const query = `
        SELECT 
          count() AS total_versions,
          math::max(version_number) AS latest_version,
          math::min(created_at) AS first_created,
          math::max(created_at) AS last_updated
        FROM claim_version_history
        WHERE claim_id = $claim_id
        GROUP ALL
      `;

      const typeQuery = `
        SELECT 
          version_type,
          count() AS count
        FROM claim_version_history
        WHERE claim_id = $claim_id
        GROUP BY version_type
      `;

      const [baseResults, typeResults] = await Promise.all([
        queryWithAuth(this.client, query, { claim_id: claimId }) as Promise<unknown[][]>,
        queryWithAuth(this.client, typeQuery, { claim_id: claimId }) as Promise<unknown[][]>
      ]);

      const baseStats = baseResults[0]?.[0] as any || {};
      const typeStats = typeResults[0] as any[] || [];

      const versionsByType: Record<VersionType, number> = {} as Record<VersionType, number>;
      typeStats.forEach((stat: any) => {
        versionsByType[stat.version_type as VersionType] = stat.count;
      });

      return {
        total_versions: baseStats.total_versions || 0,
        versions_by_type: versionsByType,
        latest_version: baseStats.latest_version || 0,
        first_created: baseStats.first_created || '',
        last_updated: baseStats.last_updated || ''
      };
    } catch (error) {
      console.error('获取版本统计失败:', error);
      throw new Error('获取版本统计失败');
    }
  }

  /**
   * 获取当前债权数据
   */
  private async getCurrentClaimData(claimId: string | RecordId): Promise<Record<string, unknown> | null> {
    try {
      const query = `
        SELECT *
        FROM claim
        WHERE id = $claim_id
        LIMIT 1
      `;

      const results = await queryWithAuth(this.client, query, { claim_id: claimId }) as unknown[][];
      return results[0]?.[0] as Record<string, unknown> || null;
    } catch (error) {
      console.error('获取当前债权数据失败:', error);
      return null;
    }
  }

  /**
   * 获取下一个版本号
   */
  private async getNextVersionNumber(claimId: string | RecordId): Promise<number> {
    try {
      const query = `
        SELECT math::max(version_number) AS max_version
        FROM claim_version_history
        WHERE claim_id = $claim_id
        GROUP ALL
      `;

      const results = await queryWithAuth(this.client, query, { claim_id: claimId }) as unknown[][];
      const maxVersion = (results[0]?.[0] as any)?.max_version || 0;
      
      return maxVersion + 1;
    } catch (error) {
      console.error('获取下一个版本号失败:', error);
      return 1; // 默认从版本1开始
    }
  }

  /**
   * 更新债权表的当前版本号
   */
  private async updateClaimCurrentVersion(
    claimId: string | RecordId,
    versionNumber: number
  ): Promise<void> {
    try {
      const query = `
        UPDATE $claim_id SET
          current_version = $version_number,
          updated_at = time::now()
      `;

      await queryWithAuth(this.client, query, {
        claim_id: claimId,
        version_number: versionNumber
      });
    } catch (error) {
      console.error('更新债权当前版本号失败:', error);
      // 这里不抛出错误，因为这不是关键操作
    }
  }

  /**
   * 更新债权数据
   */
  private async updateClaimData(
    claimId: string | RecordId,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      // 构建更新查询
      const updateFields = Object.keys(data)
        .filter(key => key !== 'id' && key !== 'created_at')
        .map(key => `${key} = $${key}`)
        .join(', ');

      const query = `
        UPDATE $claim_id SET
          ${updateFields},
          updated_at = time::now()
      `;

      const params = {
        claim_id: claimId,
        ...data
      };

      await queryWithAuth(this.client, query, params);
    } catch (error) {
      console.error('更新债权数据失败:', error);
      throw new Error('更新债权数据失败');
    }
  }

  /**
   * 生成数据校验和 - 使用浏览器兼容的Web Crypto API
   */
  private async generateChecksum(data: Record<string, unknown>): Promise<string> {
    try {
      // 创建数据的标准化字符串表示
      const normalizedData = this.normalizeDataForChecksum(data);
      const dataString = JSON.stringify(normalizedData);
      
      // 使用Web Crypto API生成SHA-256哈希
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(dataString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      
      // 将ArrayBuffer转换为十六进制字符串
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return hashHex;
    } catch (error) {
      console.error('生成校验和失败:', error);
      // 如果Web Crypto API失败，使用简单的字符串哈希作为备选
      return this.simpleStringHash(JSON.stringify(this.normalizeDataForChecksum(data)));
    }
  }

  /**
   * 简单字符串哈希函数 - 作为Web Crypto API的备选方案
   */
  private simpleStringHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    return Math.abs(hash).toString(16);
  }

  /**
   * 标准化数据用于校验和计算
   */
  private normalizeDataForChecksum(data: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};
    
    // 排序键名并过滤掉时间戳字段
    const sortedKeys = Object.keys(data)
      .filter(key => !['created_at', 'updated_at', 'id'].includes(key))
      .sort();

    for (const key of sortedKeys) {
      const value = data[key];
      if (value !== null && value !== undefined) {
        normalized[key] = value;
      }
    }

    return normalized;
  }

  /**
   * 计算字段变更
   */
  private calculateFieldChanges(
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>
  ): FieldChange[] {
    const changes: FieldChange[] = [];
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

    for (const key of allKeys) {
      const oldValue = oldData[key];
      const newValue = newData[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        let changeType: 'added' | 'removed' | 'modified';
        
        if (oldValue === undefined) {
          changeType = 'added';
        } else if (newValue === undefined) {
          changeType = 'removed';
        } else {
          changeType = 'modified';
        }

        changes.push({
          field_path: key,
          field_name: this.getFieldDisplayName(key),
          old_value: oldValue,
          new_value: newValue,
          change_type: changeType
        });
      }
    }

    return changes;
  }

  /**
   * 生成变更摘要
   */
  private generateChangeSummary(changes: FieldChange[]): string {
    if (changes.length === 0) {
      return '无变更';
    }

    const summaryParts: string[] = [];
    
    const addedFields = changes.filter(c => c.change_type === 'added');
    const removedFields = changes.filter(c => c.change_type === 'removed');
    const modifiedFields = changes.filter(c => c.change_type === 'modified');

    if (addedFields.length > 0) {
      summaryParts.push(`新增字段: ${addedFields.map(f => f.field_name).join(', ')}`);
    }

    if (removedFields.length > 0) {
      summaryParts.push(`删除字段: ${removedFields.map(f => f.field_name).join(', ')}`);
    }

    if (modifiedFields.length > 0) {
      summaryParts.push(`修改字段: ${modifiedFields.map(f => f.field_name).join(', ')}`);
    }

    return summaryParts.join('; ');
  }

  /**
   * 获取字段显示名称
   */
  private getFieldDisplayName(fieldPath: string): string {
    const fieldNameMap: Record<string, string> = {
      'claim_number': '债权编号',
      'status': '状态',
      'asserted_claim_details': '主张债权详情',
      'approved_claim_details': '认定债权详情',
      'review_comments': '审核意见',
      'submission_time': '提交时间',
      'review_time': '审核时间',
      'creditor_id': '债权人',
      'case_id': '案件',
      'reviewer_id': '审核员'
    };

    return fieldNameMap[fieldPath] || fieldPath;
  }
}

export default ClaimVersionService;