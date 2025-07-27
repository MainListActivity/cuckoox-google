/**
 * 债权操作记录服务
 * 负责记录、查询和统计债权操作日志
 */

import { queryWithAuth } from '@/src/utils/surrealAuth';
import {
  ClaimOperationLog,
  OperationType,
  OperationResult,
  OperationStatistics,
  OperationLogQueryOptions,
  LogOperationParams
} from '@/src/types/claimTracking';
import type { RecordId } from 'surrealdb';

export class ClaimOperationService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(surrealClient: any) {
    this.client = surrealClient;
  }

  /**
   * 记录债权操作日志
   */
  async logOperation(params: LogOperationParams): Promise<ClaimOperationLog> {
    try {
      // 获取客户端信息
      const clientInfo = this.getClientInfo();
      
      // 计算变更字段
      const changedFields = this.calculateChangedFields(params.before_data, params.after_data);
      
      const query = `
        CREATE claim_operation_log SET
          claim_id = $claim_id,
          operation_type = $operation_type,
          operation_description = $description,
          operator_name = $auth.name,
          operator_role = $auth.role,
          operation_time = time::now(),
          ip_address = $ip_address,
          user_agent = $user_agent,
          operation_details = $operation_details,
          before_data = $before_data,
          after_data = $after_data,
          changed_fields = $changed_fields,
          operation_result = $operation_result,
          related_documents = $related_documents,
          business_context = $business_context
      `;

      const queryParams = {
        claim_id: params.claim_id,
        operation_type: params.operation_type,
        description: params.description,
        ip_address: clientInfo.ip_address,
        user_agent: clientInfo.user_agent,
        operation_details: params.operation_details || {},
        before_data: params.before_data,
        after_data: params.after_data,
        changed_fields: changedFields,
        operation_result: OperationResult.SUCCESS,
        related_documents: params.related_documents || [],
        business_context: params.business_context || {}
      };

      const results = await queryWithAuth(this.client, query, queryParams);
      const operationLog = results[0]?.[0] as ClaimOperationLog;

      if (!operationLog) {
        throw new Error('操作日志记录失败');
      }

      return operationLog;
    } catch (error) {
      console.error('记录操作日志失败:', error);
      
      // 尝试记录失败的操作
      await this.logFailedOperation(params, error as Error);
      
      throw new Error('记录操作日志失败');
    }
  }

  /**
   * 记录失败的操作
   */
  private async logFailedOperation(params: LogOperationParams, error: Error): Promise<void> {
    try {
      const clientInfo = this.getClientInfo();
      
      const query = `
        CREATE claim_operation_log SET
          claim_id = $claim_id,
          operation_type = $operation_type,
          operation_description = $description,
          operator_name = $auth.name,
          operator_role = $auth.role,
          operation_time = time::now(),
          ip_address = $ip_address,
          user_agent = $user_agent,
          operation_details = $operation_details,
          operation_result = $operation_result,
          error_message = $error_message
      `;

      await queryWithAuth(this.client, query, {
        claim_id: params.claim_id,
        operation_type: params.operation_type,
        description: `${params.description} (失败)`,
        ip_address: clientInfo.ip_address,
        user_agent: clientInfo.user_agent,
        operation_details: { error: error.message, stack: error.stack },
        operation_result: OperationResult.FAILED,
        error_message: error.message
      });
    } catch (logError) {
      console.error('记录失败操作日志失败:', logError);
    }
  }

  /**
   * 获取债权操作历史
   */
  async getOperationHistory(
    claimId: string | RecordId,
    options: OperationLogQueryOptions = {}
  ): Promise<ClaimOperationLog[]> {
    try {
      const {
        limit = 50,
        offset = 0,
        operation_type,
        date_range,
        operator_id,
        operation_result
      } = options;

      let whereClause = 'claim_id = $claim_id';
      const queryParams: Record<string, unknown> = {
        claim_id: claimId,
        limit,
        offset
      };

      // 添加操作类型过滤
      if (operation_type) {
        whereClause += ' AND operation_type = $operation_type';
        queryParams.operation_type = operation_type;
      }

      // 添加日期范围过滤
      if (date_range) {
        whereClause += ' AND operation_time >= $start_date AND operation_time <= $end_date';
        queryParams.start_date = date_range.start.toISOString();
        queryParams.end_date = date_range.end.toISOString();
      }

      // 添加操作人过滤
      if (operator_id) {
        whereClause += ' AND operator_id = $operator_id';
        queryParams.operator_id = operator_id;
      }

      // 添加操作结果过滤
      if (operation_result) {
        whereClause += ' AND operation_result = $operation_result';
        queryParams.operation_result = operation_result;
      }

      const query = `
        SELECT *
        FROM claim_operation_log
        WHERE ${whereClause}
        ORDER BY operation_time DESC
        LIMIT $limit START $offset
      `;

      const results = await queryWithAuth(this.client, query, queryParams);
      return results[0] as ClaimOperationLog[] || [];
    } catch (error) {
      console.error('获取操作历史失败:', error);
      throw new Error('获取操作历史失败');
    }
  }

  /**
   * 获取操作统计信息
   */
  async getOperationStatistics(params: {
    case_id?: string;
    date_range?: { start: Date; end: Date };
    group_by?: 'operator' | 'operation_type' | 'date';
  }): Promise<OperationStatistics> {
    try {
      const { case_id, date_range, group_by } = params;
      
      let whereClause = '1 = 1';
      const queryParams: Record<string, unknown> = {};

      // 添加案件过滤
      if (case_id) {
        whereClause += ' AND claim_id->case_id = $case_id';
        queryParams.case_id = case_id;
      }

      // 添加日期范围过滤
      if (date_range) {
        whereClause += ' AND operation_time >= $start_date AND operation_time <= $end_date';
        queryParams.start_date = date_range.start.toISOString();
        queryParams.end_date = date_range.end.toISOString();
      }

      // 基础统计查询
      const baseQuery = `
        SELECT 
          count() AS total_operations,
          math::mean(array::len(changed_fields)) AS avg_fields_changed,
          count(operation_result = 'success') AS successful_operations,
          count(operation_result = 'failed') AS failed_operations
        FROM claim_operation_log
        WHERE ${whereClause}
        GROUP ALL
      `;

      // 按操作类型分组统计
      const typeStatsQuery = `
        SELECT 
          operation_type,
          count() AS count
        FROM claim_operation_log
        WHERE ${whereClause}
        GROUP BY operation_type
      `;

      // 按操作人分组统计
      const userStatsQuery = `
        SELECT 
          operator_id,
          operator_name,
          count() AS count
        FROM claim_operation_log
        WHERE ${whereClause}
        GROUP BY operator_id, operator_name
      `;

      const [baseResults, typeResults, userResults] = await Promise.all([
        queryWithAuth(this.client, baseQuery, queryParams),
        queryWithAuth(this.client, typeStatsQuery, queryParams),
        queryWithAuth(this.client, userStatsQuery, queryParams)
      ]);

      const baseStats = baseResults[0]?.[0] || {};
      const typeStats = typeResults[0] || [];
      const userStats = userResults[0] || [];

      // 构建统计结果
      const operationsByType: Record<OperationType, number> = {} as Record<OperationType, number>;
      typeStats.forEach((stat: any) => {
        operationsByType[stat.operation_type as OperationType] = stat.count;
      });

      const operationsByUser: Record<string, number> = {};
      userStats.forEach((stat: any) => {
        operationsByUser[stat.operator_name] = stat.count;
      });

      const totalOperations = baseStats.total_operations || 0;
      const successfulOperations = baseStats.successful_operations || 0;
      const successRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0;

      return {
        total_operations: totalOperations,
        operations_by_type: operationsByType,
        operations_by_user: operationsByUser,
        operations_by_date: {}, // 可以根据需要实现按日期分组
        success_rate: successRate
      };
    } catch (error) {
      console.error('获取操作统计失败:', error);
      throw new Error('获取操作统计失败');
    }
  }

  /**
   * 获取最近的操作记录
   */
  async getRecentOperations(limit: number = 10): Promise<ClaimOperationLog[]> {
    try {
      const query = `
        SELECT *
        FROM claim_operation_log
        ORDER BY operation_time DESC
        LIMIT $limit
      `;

      const results = await queryWithAuth(this.client, query, { limit });
      return results[0] as ClaimOperationLog[] || [];
    } catch (error) {
      console.error('获取最近操作记录失败:', error);
      throw new Error('获取最近操作记录失败');
    }
  }

  /**
   * 获取用户的操作记录
   */
  async getUserOperations(
    userId: string | RecordId,
    options: OperationLogQueryOptions = {}
  ): Promise<ClaimOperationLog[]> {
    try {
      const { limit = 50, offset = 0, date_range } = options;
      
      let whereClause = 'operator_id = $user_id';
      const queryParams: Record<string, unknown> = {
        user_id: userId,
        limit,
        offset
      };

      if (date_range) {
        whereClause += ' AND operation_time >= $start_date AND operation_time <= $end_date';
        queryParams.start_date = date_range.start.toISOString();
        queryParams.end_date = date_range.end.toISOString();
      }

      const query = `
        SELECT *
        FROM claim_operation_log
        WHERE ${whereClause}
        ORDER BY operation_time DESC
        LIMIT $limit START $offset
      `;

      const results = await queryWithAuth(this.client, query, queryParams);
      return results[0] as ClaimOperationLog[] || [];
    } catch (error) {
      console.error('获取用户操作记录失败:', error);
      throw new Error('获取用户操作记录失败');
    }
  }

  /**
   * 删除过期的操作日志
   */
  async cleanupOldLogs(daysToKeep: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const query = `
        DELETE FROM claim_operation_log
        WHERE operation_time < $cutoff_date
      `;

      const results = await queryWithAuth(this.client, query, {
        cutoff_date: cutoffDate.toISOString()
      });

      // 记录清理操作
      await this.logOperation({
        claim_id: 'system' as RecordId,
        operation_type: OperationType.DELETE,
        description: `清理${daysToKeep}天前的操作日志`,
        operation_details: {
          cutoff_date: cutoffDate.toISOString(),
          deleted_count: results.length
        }
      });

      return results.length;
    } catch (error) {
      console.error('清理过期日志失败:', error);
      throw new Error('清理过期日志失败');
    }
  }

  /**
   * 获取客户端信息（IP地址和用户代理）
   */
  private getClientInfo(): { ip_address?: string; user_agent?: string } {
    // 在浏览器环境中，我们无法直接获取真实IP地址
    // 这里返回可获取的信息，实际IP地址需要从服务端获取
    return {
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      ip_address: undefined // 需要从服务端获取
    };
  }

  /**
   * 计算数据变更的字段
   */
  private calculateChangedFields(
    beforeData?: Record<string, unknown>,
    afterData?: Record<string, unknown>
  ): string[] {
    if (!beforeData || !afterData) {
      return [];
    }

    const changedFields: string[] = [];
    const allKeys = new Set([...Object.keys(beforeData), ...Object.keys(afterData)]);

    for (const key of allKeys) {
      const beforeValue = beforeData[key];
      const afterValue = afterData[key];

      if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
        changedFields.push(key);
      }
    }

    return changedFields;
  }

  /**
   * 验证操作权限
   */
  async validateOperationPermission(
    claimId: string | RecordId,
    operationType: OperationType
  ): Promise<boolean> {
    try {
      // 这里可以实现具体的权限验证逻辑
      // 目前返回true，实际应该根据用户角色和债权状态进行验证
      return true;
    } catch (error) {
      console.error('验证操作权限失败:', error);
      return false;
    }
  }

  /**
   * 格式化操作描述
   */
  formatOperationDescription(operationType: OperationType, context?: Record<string, unknown>): string {
    const descriptions: Record<OperationType, string> = {
      [OperationType.CREATE]: '创建债权申报',
      [OperationType.UPDATE]: '更新债权信息',
      [OperationType.SUBMIT]: '提交债权申报',
      [OperationType.WITHDRAW]: '撤回债权申报',
      [OperationType.REVIEW]: '审核债权申报',
      [OperationType.APPROVE]: '批准债权申报',
      [OperationType.REJECT]: '驳回债权申报',
      [OperationType.SUPPLEMENT_REQUEST]: '要求补充材料',
      [OperationType.DELETE]: '删除债权申报',
      [OperationType.VIEW]: '查看债权申报'
    };

    let description = descriptions[operationType] || '未知操作';
    
    // 可以根据上下文信息丰富描述
    if (context?.claim_number) {
      description += ` (${context.claim_number})`;
    }

    return description;
  }
}

export default ClaimOperationService;