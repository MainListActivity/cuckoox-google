/**
 * 债权状态流转服务
 * 负责记录和查询债权状态流转历史，计算状态停留时长和流转统计
 */

import { queryWithAuth } from '@/src/utils/surrealAuth';
import {
  ClaimStatusFlow,
  TransitionType,
  StatusStatistics,
  RecordStatusTransitionParams
} from '@/src/types/claimTracking';
import type { RecordId } from 'surrealdb';

export class ClaimStatusFlowService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(surrealClient: any) {
    this.client = surrealClient;
  }

  /**
   * 记录状态流转
   */
  async recordStatusTransition(params: RecordStatusTransitionParams): Promise<ClaimStatusFlow> {
    try {
      // 获取前一个状态的停留时长
      const durationInPreviousStatus = await this.calculatePreviousStatusDuration(
        params.claim_id,
        params.from_status
      );

      const query = `
        CREATE claim_status_flow SET
          claim_id = $claim_id,
          from_status = $from_status,
          to_status = $to_status,
          transition_type = $transition_type,
          trigger_reason = $trigger_reason,
          transition_time = time::now(),
          operator_role = $auth.role,
          transition_notes = $transition_notes,
          review_comments = $review_comments,
          duration_in_previous_status = $duration_in_previous_status,
          related_operation_log_id = $related_operation_log_id
      `;

      const queryParams = {
        claim_id: params.claim_id,
        from_status: params.from_status,
        to_status: params.to_status,
        transition_type: params.transition_type,
        trigger_reason: params.trigger_reason,
        transition_notes: params.transition_notes,
        review_comments: params.review_comments,
        duration_in_previous_status: durationInPreviousStatus,
        related_operation_log_id: params.related_operation_log_id
      };

      const results = await queryWithAuth(this.client, query, queryParams);
      const statusFlow = results[0]?.[0] as ClaimStatusFlow;

      if (!statusFlow) {
        throw new Error('状态流转记录失败');
      }

      return statusFlow;
    } catch (error) {
      console.error('记录状态流转失败:', error);
      throw new Error('记录状态流转失败');
    }
  }

  /**
   * 获取债权状态流转历史
   */
  async getStatusFlowHistory(claimId: string | RecordId): Promise<ClaimStatusFlow[]> {
    try {
      const query = `
        SELECT 
          *,
          from_status.name AS from_status_name,
          to_status.name AS to_status_name
        FROM claim_status_flow
        WHERE claim_id = $claim_id
        ORDER BY transition_time ASC
      `;

      const results = await queryWithAuth(this.client, query, { claim_id: claimId });
      return results[0] as ClaimStatusFlow[] || [];
    } catch (error) {
      console.error('获取状态流转历史失败:', error);
      throw new Error('获取状态流转历史失败');
    }
  }

  /**
   * 获取状态统计信息
   */
  async getStatusStatistics(params: {
    case_id?: string;
    date_range?: { start: Date; end: Date };
  }): Promise<StatusStatistics> {
    try {
      const { case_id, date_range } = params;
      
      let whereClause = '1 = 1';
      const queryParams: Record<string, unknown> = {};

      // 添加案件过滤
      if (case_id) {
        whereClause += ' AND claim_id->case_id = $case_id';
        queryParams.case_id = case_id;
      }

      // 添加日期范围过滤
      if (date_range) {
        whereClause += ' AND transition_time >= $start_date AND transition_time <= $end_date';
        queryParams.start_date = date_range.start.toISOString();
        queryParams.end_date = date_range.end.toISOString();
      }

      // 基础统计查询
      const baseQuery = `
        SELECT 
          count() AS total_transitions
        FROM claim_status_flow
        WHERE ${whereClause}
        GROUP ALL
      `;

      // 按状态分组统计流转次数
      const statusTransitionsQuery = `
        SELECT 
          to_status.name AS status_name,
          count() AS count
        FROM claim_status_flow
        WHERE ${whereClause}
        GROUP BY to_status.name
      `;

      // 按状态计算平均停留时长
      const statusDurationQuery = `
        SELECT 
          from_status.name AS status_name,
          math::mean(duration::secs(duration_in_previous_status)) AS avg_duration_seconds
        FROM claim_status_flow
        WHERE ${whereClause} AND duration_in_previous_status IS NOT NONE
        GROUP BY from_status.name
      `;

      // 当前状态分布统计
      const currentStatusQuery = `
        SELECT 
          status AS current_status,
          count() AS count
        FROM claim
        WHERE ${case_id ? 'case_id = $case_id' : '1 = 1'}
        GROUP BY status
      `;

      const [baseResults, transitionResults, durationResults, currentStatusResults] = await Promise.all([
        queryWithAuth(this.client, baseQuery, queryParams),
        queryWithAuth(this.client, statusTransitionsQuery, queryParams),
        queryWithAuth(this.client, statusDurationQuery, queryParams),
        queryWithAuth(this.client, currentStatusQuery, case_id ? { case_id } : {})
      ]);

      const baseStats = baseResults[0]?.[0] || {};
      const transitionStats = transitionResults[0] || [];
      const durationStats = durationResults[0] || [];
      const currentStatusStats = currentStatusResults[0] || [];

      // 构建统计结果
      const transitionsByStatus: Record<string, number> = {};
      transitionStats.forEach((stat: any) => {
        transitionsByStatus[stat.status_name] = stat.count;
      });

      const averageDurationByStatus: Record<string, number> = {};
      durationStats.forEach((stat: any) => {
        averageDurationByStatus[stat.status_name] = stat.avg_duration_seconds;
      });

      const statusDistribution: Record<string, number> = {};
      currentStatusStats.forEach((stat: any) => {
        statusDistribution[stat.current_status] = stat.count;
      });

      return {
        total_transitions: baseStats.total_transitions || 0,
        transitions_by_status: transitionsByStatus,
        average_duration_by_status: averageDurationByStatus,
        status_distribution: statusDistribution
      };
    } catch (error) {
      console.error('获取状态统计失败:', error);
      throw new Error('获取状态统计失败');
    }
  }

  /**
   * 获取债权当前状态信息
   */
  async getCurrentStatusInfo(claimId: string | RecordId): Promise<{
    current_status: string;
    status_since: string;
    duration_in_current_status: string;
    last_transition: ClaimStatusFlow | null;
  } | null> {
    try {
      // 获取最后一次状态流转
      const lastTransitionQuery = `
        SELECT *
        FROM claim_status_flow
        WHERE claim_id = $claim_id
        ORDER BY transition_time DESC
        LIMIT 1
      `;

      // 获取当前债权状态
      const currentStatusQuery = `
        SELECT status, updated_at
        FROM claim
        WHERE id = $claim_id
        LIMIT 1
      `;

      const [transitionResults, statusResults] = await Promise.all([
        queryWithAuth(this.client, lastTransitionQuery, { claim_id: claimId }),
        queryWithAuth(this.client, currentStatusQuery, { claim_id: claimId })
      ]);

      const lastTransition = transitionResults[0]?.[0] as ClaimStatusFlow || null;
      const currentClaim = statusResults[0]?.[0];

      if (!currentClaim) {
        return null;
      }

      const statusSince = lastTransition?.transition_time || currentClaim.updated_at;
      const durationInCurrentStatus = this.calculateDurationFromTimestamp(statusSince);

      return {
        current_status: currentClaim.status,
        status_since: statusSince,
        duration_in_current_status: durationInCurrentStatus,
        last_transition: lastTransition
      };
    } catch (error) {
      console.error('获取当前状态信息失败:', error);
      throw new Error('获取当前状态信息失败');
    }
  }

  /**
   * 获取状态流转路径分析
   */
  async getStatusFlowPathAnalysis(params: {
    case_id?: string;
    date_range?: { start: Date; end: Date };
  }): Promise<{
    common_paths: Array<{
      path: string;
      count: number;
      avg_duration: number;
    }>;
    bottleneck_statuses: Array<{
      status: string;
      avg_duration: number;
      claim_count: number;
    }>;
  }> {
    try {
      const { case_id, date_range } = params;
      
      let whereClause = '1 = 1';
      const queryParams: Record<string, unknown> = {};

      if (case_id) {
        whereClause += ' AND claim_id->case_id = $case_id';
        queryParams.case_id = case_id;
      }

      if (date_range) {
        whereClause += ' AND transition_time >= $start_date AND transition_time <= $end_date';
        queryParams.start_date = date_range.start.toISOString();
        queryParams.end_date = date_range.end.toISOString();
      }

      // 分析常见流转路径
      const pathAnalysisQuery = `
        SELECT 
          string::concat(from_status.name, ' → ', to_status.name) AS path,
          count() AS count,
          math::mean(duration::secs(duration_in_previous_status)) AS avg_duration
        FROM claim_status_flow
        WHERE ${whereClause} AND from_status IS NOT NONE
        GROUP BY from_status.name, to_status.name
        ORDER BY count DESC
        LIMIT 10
      `;

      // 分析瓶颈状态（停留时间较长的状态）
      const bottleneckQuery = `
        SELECT 
          from_status.name AS status,
          math::mean(duration::secs(duration_in_previous_status)) AS avg_duration,
          count() AS claim_count
        FROM claim_status_flow
        WHERE ${whereClause} AND from_status IS NOT NONE AND duration_in_previous_status IS NOT NONE
        GROUP BY from_status.name
        HAVING avg_duration > 86400 -- 超过1天的状态
        ORDER BY avg_duration DESC
        LIMIT 10
      `;

      const [pathResults, bottleneckResults] = await Promise.all([
        queryWithAuth(this.client, pathAnalysisQuery, queryParams),
        queryWithAuth(this.client, bottleneckQuery, queryParams)
      ]);

      const commonPaths = (pathResults[0] || []).map((result: any) => ({
        path: result.path,
        count: result.count,
        avg_duration: result.avg_duration || 0
      }));

      const bottleneckStatuses = (bottleneckResults[0] || []).map((result: any) => ({
        status: result.status,
        avg_duration: result.avg_duration,
        claim_count: result.claim_count
      }));

      return {
        common_paths: commonPaths,
        bottleneck_statuses: bottleneckStatuses
      };
    } catch (error) {
      console.error('获取状态流转路径分析失败:', error);
      throw new Error('获取状态流转路径分析失败');
    }
  }

  /**
   * 获取用户操作的状态流转记录
   */
  async getUserStatusTransitions(
    userId: string | RecordId,
    options: {
      limit?: number;
      offset?: number;
      date_range?: { start: Date; end: Date };
    } = {}
  ): Promise<ClaimStatusFlow[]> {
    try {
      const { limit = 50, offset = 0, date_range } = options;
      
      let whereClause = 'operator_id = $user_id';
      const queryParams: Record<string, unknown> = {
        user_id: userId,
        limit,
        offset
      };

      if (date_range) {
        whereClause += ' AND transition_time >= $start_date AND transition_time <= $end_date';
        queryParams.start_date = date_range.start.toISOString();
        queryParams.end_date = date_range.end.toISOString();
      }

      const query = `
        SELECT 
          *,
          from_status.name AS from_status_name,
          to_status.name AS to_status_name,
          claim_id.claim_number AS claim_number
        FROM claim_status_flow
        WHERE ${whereClause}
        ORDER BY transition_time DESC
        LIMIT $limit START $offset
      `;

      const results = await queryWithAuth(this.client, query, queryParams);
      return results[0] as ClaimStatusFlow[] || [];
    } catch (error) {
      console.error('获取用户状态流转记录失败:', error);
      throw new Error('获取用户状态流转记录失败');
    }
  }

  /**
   * 清理旧的状态流转记录
   */
  async cleanupOldStatusFlows(daysToKeep: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const query = `
        DELETE FROM claim_status_flow
        WHERE transition_time < $cutoff_date
      `;

      const results = await queryWithAuth(this.client, query, {
        cutoff_date: cutoffDate.toISOString()
      });

      return results.length;
    } catch (error) {
      console.error('清理旧状态流转记录失败:', error);
      throw new Error('清理旧状态流转记录失败');
    }
  }

  /**
   * 计算前一个状态的停留时长
   */
  private async calculatePreviousStatusDuration(
    claimId: string | RecordId,
    fromStatus?: string | RecordId
  ): Promise<string | undefined> {
    try {
      if (!fromStatus) {
        return undefined;
      }

      // 获取进入前一个状态的时间
      const query = `
        SELECT transition_time
        FROM claim_status_flow
        WHERE claim_id = $claim_id AND to_status = $from_status
        ORDER BY transition_time DESC
        LIMIT 1
      `;

      const results = await queryWithAuth(this.client, query, {
        claim_id: claimId,
        from_status: fromStatus
      });

      const lastTransition = results[0]?.[0];
      if (!lastTransition) {
        return undefined;
      }

      // 计算时长
      const startTime = new Date(lastTransition.transition_time);
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      // 转换为ISO 8601 duration格式
      return this.formatDuration(durationMs);
    } catch (error) {
      console.error('计算前一个状态停留时长失败:', error);
      return undefined;
    }
  }

  /**
   * 格式化时长为ISO 8601 duration格式
   */
  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `P${days}DT${hours % 24}H${minutes % 60}M${seconds % 60}S`;
    } else if (hours > 0) {
      return `PT${hours}H${minutes % 60}M${seconds % 60}S`;
    } else if (minutes > 0) {
      return `PT${minutes}M${seconds % 60}S`;
    } else {
      return `PT${seconds}S`;
    }
  }

  /**
   * 从时间戳计算到现在的时长
   */
  private calculateDurationFromTimestamp(timestamp: string): string {
    const startTime = new Date(timestamp);
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    return this.formatDuration(durationMs);
  }

  /**
   * 验证状态流转的合法性
   */
  async validateStatusTransition(
    claimId: string | RecordId,
    fromStatus: string | RecordId,
    toStatus: string | RecordId
  ): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    try {
      // 获取状态流转规则（这里可以实现具体的业务规则）
      // 目前简单实现，实际应该根据业务需求定义状态流转规则
      
      // 检查目标状态是否存在
      const statusQuery = `
        SELECT id FROM claim_review_status_definition 
        WHERE id = $to_status AND is_active = true
        LIMIT 1
      `;

      const statusResults = await queryWithAuth(this.client, statusQuery, {
        to_status: toStatus
      });

      if (!statusResults[0]?.[0]) {
        return {
          valid: false,
          reason: '目标状态不存在或已禁用'
        };
      }

      // 检查是否存在循环流转（短时间内重复相同的状态变更）
      const recentTransitionQuery = `
        SELECT id
        FROM claim_status_flow
        WHERE claim_id = $claim_id 
          AND from_status = $to_status 
          AND to_status = $from_status
          AND transition_time > time::now() - 1h
        LIMIT 1
      `;

      const recentResults = await queryWithAuth(this.client, recentTransitionQuery, {
        claim_id: claimId,
        from_status: fromStatus,
        to_status: toStatus
      });

      if (recentResults[0]?.[0]) {
        return {
          valid: false,
          reason: '检测到循环状态流转，请稍后再试'
        };
      }

      return { valid: true };
    } catch (error) {
      console.error('验证状态流转失败:', error);
      return {
        valid: false,
        reason: '状态流转验证失败'
      };
    }
  }

  /**
   * 获取状态流转建议
   */
  getStatusTransitionSuggestions(currentStatus: string): Array<{
    status: string;
    description: string;
    required_role?: string;
  }> {
    // 定义状态流转建议规则
    const transitionRules: Record<string, Array<{
      status: string;
      description: string;
      required_role?: string;
    }>> = {
      '草稿': [
        { status: '已提交', description: '提交债权申报' },
        { status: '已删除', description: '删除草稿' }
      ],
      '已提交': [
        { status: '审核中', description: '开始审核', required_role: 'claim_reviewer' },
        { status: '草稿', description: '撤回申报' }
      ],
      '审核中': [
        { status: '审核通过', description: '审核通过', required_role: 'claim_reviewer' },
        { status: '已驳回', description: '驳回申报', required_role: 'claim_reviewer' },
        { status: '需要补充', description: '要求补充材料', required_role: 'claim_reviewer' }
      ],
      '已驳回': [
        { status: '草稿', description: '重新编辑' }
      ],
      '需要补充': [
        { status: '已提交', description: '补充材料后重新提交' }
      ],
      '审核通过': [
        { status: '需要补充', description: '要求补充材料', required_role: 'claim_reviewer' }
      ]
    };

    return transitionRules[currentStatus] || [];
  }
}

export default ClaimStatusFlowService;