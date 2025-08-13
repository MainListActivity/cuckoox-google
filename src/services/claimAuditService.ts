/**
 * 债权审计服务
 * 负责访问日志记录、审计查询和报告生成功能
 */

import { queryWithAuth } from "@/src/utils/surrealAuth";
import {
  ClaimAccessLog,
  AccessType,
  AccessResult,
  AuditLogQueryOptions,
  AuditFilters,
  LogAccessParams,
} from "@/src/types/claimTracking";
import type { RecordId } from "surrealdb";

export class ClaimAuditService {
  private client: any;

  constructor(surrealClient: any) {
    this.client = surrealClient;
  }

  /**
   * 记录访问日志
   */
  async logAccess(params: LogAccessParams): Promise<ClaimAccessLog> {
    try {
      // 获取客户端信息
      const clientInfo = this.getClientInfo();

      // 计算访问时长（如果提供）
      const accessDuration = params.access_duration
        ? this.formatDuration(params.access_duration)
        : undefined;

      const query = `
        CREATE claim_access_log SET
          claim_id = $claim_id,
          access_type = $access_type,
          accessor_name = $auth.name,
          accessor_role = $auth.role,
          access_time = time::now(),
          ip_address = $ip_address,
          user_agent = $user_agent,
          accessed_fields = $accessed_fields,
          access_duration = $access_duration,
          access_result = $access_result
      `;

      const queryParams = {
        claim_id: params.claim_id,
        access_type: params.access_type,
        ip_address: clientInfo.ip_address,
        user_agent: clientInfo.user_agent,
        accessed_fields: params.accessed_fields || [],
        access_duration: accessDuration,
        access_result: AccessResult.SUCCESS,
      };

      const results = await queryWithAuth(this.client, query, queryParams);
      const accessLog = results[0]?.[0] as ClaimAccessLog;

      if (!accessLog) {
        throw new Error("访问日志记录失败");
      }

      return accessLog;
    } catch (error) {
      console.error("记录访问日志失败:", error);

      // 尝试记录失败的访问
      await this.logFailedAccess(params, error as Error);

      throw new Error("记录访问日志失败");
    }
  }

  /**
   * 记录失败的访问
   */
  private async logFailedAccess(
    params: LogAccessParams,
    error: Error,
  ): Promise<void> {
    try {
      const clientInfo = this.getClientInfo();

      const query = `
        CREATE claim_access_log SET
          claim_id = $claim_id,
          access_type = $access_type,
          accessor_name = $auth.name,
          accessor_role = $auth.role,
          access_time = time::now(),
          ip_address = $ip_address,
          user_agent = $user_agent,
          access_result = $access_result,
          denial_reason = $denial_reason
      `;

      await queryWithAuth(this.client, query, {
        claim_id: params.claim_id,
        access_type: params.access_type,
        ip_address: clientInfo.ip_address,
        user_agent: clientInfo.user_agent,
        access_result: AccessResult.ERROR,
        denial_reason: error.message,
      });
    } catch (logError) {
      console.error("记录失败访问日志失败:", logError);
    }
  }

  /**
   * 获取审计日志
   */
  async getAuditLog(
    options: AuditLogQueryOptions = {},
  ): Promise<ClaimAccessLog[]> {
    try {
      const {
        claim_id,
        user_id,
        date_range,
        access_type,
        access_result,
        limit = 50,
        offset = 0,
      } = options;

      let whereClause = "1 = 1";
      const queryParams: Record<string, unknown> = { limit, offset };

      // 添加债权过滤
      if (claim_id) {
        whereClause += " AND claim_id = $claim_id";
        queryParams.claim_id = claim_id;
      }

      // 添加用户过滤
      if (user_id) {
        whereClause += " AND accessor_id = $user_id";
        queryParams.user_id = user_id;
      }

      // 添加日期范围过滤
      if (date_range) {
        whereClause +=
          " AND access_time >= $start_date AND access_time <= $end_date";
        queryParams.start_date = date_range.start.toISOString();
        queryParams.end_date = date_range.end.toISOString();
      }

      // 添加访问类型过滤
      if (access_type) {
        whereClause += " AND access_type = $access_type";
        queryParams.access_type = access_type;
      }

      // 添加访问结果过滤
      if (access_result) {
        whereClause += " AND access_result = $access_result";
        queryParams.access_result = access_result;
      }

      const query = `
        SELECT
          *,
          claim_id.claim_number AS claim_number,
          claim_id.case_id.name AS case_name
        FROM claim_access_log
        WHERE ${whereClause}
        ORDER BY access_time DESC
        LIMIT $limit START $offset
      `;

      const results = await queryWithAuth(this.client, query, queryParams);
      return (results[0] as ClaimAccessLog[]) || [];
    } catch (error) {
      console.error("获取审计日志失败:", error);
      throw new Error("获取审计日志失败");
    }
  }

  /**
   * 获取用户访问统计
   */
  async getUserAccessStatistics(params: {
    user_id?: string;
    date_range?: { start: Date; end: Date };
  }): Promise<{
    total_accesses: number;
    accesses_by_type: Record<AccessType, number>;
    accesses_by_result: Record<AccessResult, number>;
    unique_claims_accessed: number;
    average_access_duration: number;
    most_accessed_claims: Array<{
      claim_id: string;
      claim_number: string;
      access_count: number;
    }>;
  }> {
    try {
      const { user_id, date_range } = params;

      let whereClause = "1 = 1";
      const queryParams: Record<string, unknown> = {};

      if (user_id) {
        whereClause += " AND accessor_id = $user_id";
        queryParams.user_id = user_id;
      }

      if (date_range) {
        whereClause +=
          " AND access_time >= $start_date AND access_time <= $end_date";
        queryParams.start_date = date_range.start.toISOString();
        queryParams.end_date = date_range.end.toISOString();
      }

      // 基础统计查询
      const baseQuery = `
        SELECT
          count() AS total_accesses,
          count(DISTINCT claim_id) AS unique_claims_accessed,
          math::mean(duration::secs(access_duration)) AS avg_access_duration_seconds
        FROM claim_access_log
        WHERE ${whereClause} AND access_duration IS NOT NONE
        GROUP ALL
      `;

      // 按访问类型分组统计
      const typeStatsQuery = `
        SELECT
          access_type,
          count() AS count
        FROM claim_access_log
        WHERE ${whereClause}
        GROUP BY access_type
      `;

      // 按访问结果分组统计
      const resultStatsQuery = `
        SELECT
          access_result,
          count() AS count
        FROM claim_access_log
        WHERE ${whereClause}
        GROUP BY access_result
      `;

      // 最常访问的债权
      const mostAccessedQuery = `
        SELECT
          claim_id,
          claim_id.claim_number AS claim_number,
          count() AS access_count
        FROM claim_access_log
        WHERE ${whereClause}
        GROUP BY claim_id, claim_id.claim_number
        ORDER BY access_count DESC
        LIMIT 10
      `;

      const [baseResults, typeResults, resultResults, mostAccessedResults] =
        await Promise.all([
          queryWithAuth(this.client, baseQuery, queryParams),
          queryWithAuth(this.client, typeStatsQuery, queryParams),
          queryWithAuth(this.client, resultStatsQuery, queryParams),
          queryWithAuth(this.client, mostAccessedQuery, queryParams),
        ]);

      const baseStats = baseResults[0]?.[0] || {};
      const typeStats = typeResults[0] || [];
      const resultStats = resultResults[0] || [];
      const mostAccessed = mostAccessedResults[0] || [];

      // 构建统计结果
      const accessesByType: Record<AccessType, number> = {} as Record<
        AccessType,
        number
      >;
      typeStats.forEach((stat: any) => {
        accessesByType[stat.access_type as AccessType] = stat.count;
      });

      const accessesByResult: Record<AccessResult, number> = {} as Record<
        AccessResult,
        number
      >;
      resultStats.forEach((stat: any) => {
        accessesByResult[stat.access_result as AccessResult] = stat.count;
      });

      const mostAccessedClaims = mostAccessed.map((item: any) => ({
        claim_id: String(item.claim_id),
        claim_number: item.claim_number,
        access_count: item.access_count,
      }));

      return {
        total_accesses: baseStats.total_accesses || 0,
        accesses_by_type: accessesByType,
        accesses_by_result: accessesByResult,
        unique_claims_accessed: baseStats.unique_claims_accessed || 0,
        average_access_duration: baseStats.avg_access_duration_seconds || 0,
        most_accessed_claims: mostAccessedClaims,
      };
    } catch (error) {
      console.error("获取用户访问统计失败:", error);
      throw new Error("获取用户访问统计失败");
    }
  }

  /**
   * 导出审计报告
   */
  async exportAuditReport(params: {
    format: "excel" | "pdf";
    filters: AuditFilters;
  }): Promise<string> {
    try {
      const { format, filters } = params;

      // 获取审计数据
      const auditData = await this.getFilteredAuditData(filters);

      // 根据格式生成报告
      let reportUrl: string;

      if (format === "excel") {
        reportUrl = await this.generateExcelReport(auditData, filters);
      } else {
        reportUrl = await this.generatePDFReport(auditData, filters);
      }

      // 记录导出操作
      await this.logExportOperation(format, filters, auditData.length);

      return reportUrl;
    } catch (error) {
      console.error("导出审计报告失败:", error);
      throw new Error("导出审计报告失败");
    }
  }

  /**
   * 检测异常访问模式
   */
  async detectAnomalousAccess(
    params: {
      time_window_hours?: number;
      threshold_multiplier?: number;
    } = {},
  ): Promise<
    Array<{
      user_id: string;
      user_name: string;
      access_count: number;
      normal_average: number;
      anomaly_score: number;
      suspicious_activities: string[];
    }>
  > {
    try {
      const { time_window_hours = 24, threshold_multiplier = 3 } = params;

      const timeWindowStart = new Date();
      timeWindowStart.setHours(timeWindowStart.getHours() - time_window_hours);

      // 获取时间窗口内的访问统计
      const recentAccessQuery = `
        SELECT
          accessor_id,
          accessor_name,
          count() AS recent_access_count,
          count(DISTINCT claim_id) AS unique_claims,
          count(access_result = 'denied') AS denied_count,
          array::group(access_type) AS access_types
        FROM claim_access_log
        WHERE access_time >= $time_window_start
        GROUP BY accessor_id, accessor_name
      `;

      // 获取历史平均访问量
      const historicalAverageQuery = `
        SELECT
          accessor_id,
          math::mean(daily_count) AS avg_daily_access
        FROM (
          SELECT
            accessor_id,
            time::format(access_time, '%Y-%m-%d') AS access_date,
            count() AS daily_count
          FROM claim_access_log
          WHERE access_time < $time_window_start
            AND access_time >= $time_window_start - 30d
          GROUP BY accessor_id, access_date
        )
        GROUP BY accessor_id
      `;

      const [recentResults, historicalResults] = await Promise.all([
        queryWithAuth(this.client, recentAccessQuery, {
          time_window_start: timeWindowStart.toISOString(),
        }),
        queryWithAuth(this.client, historicalAverageQuery, {
          time_window_start: timeWindowStart.toISOString(),
        }),
      ]);

      const recentAccess = recentResults[0] || [];
      const historicalAverage = historicalResults[0] || [];

      // 创建历史平均访问量映射
      const avgAccessMap = new Map();
      historicalAverage.forEach((item: any) => {
        avgAccessMap.set(String(item.accessor_id), item.avg_daily_access);
      });

      // 检测异常
      const anomalies: Array<{
        user_id: string;
        user_name: string;
        access_count: number;
        normal_average: number;
        anomaly_score: number;
        suspicious_activities: string[];
      }> = [];

      recentAccess.forEach((access: any) => {
        const userId = String(access.accessor_id);
        const normalAverage = avgAccessMap.get(userId) || 0;
        const recentCount = access.recent_access_count;

        // 计算异常分数
        const anomalyScore =
          normalAverage > 0 ? recentCount / normalAverage : recentCount;

        if (anomalyScore >= threshold_multiplier) {
          const suspiciousActivities: string[] = [];

          // 检测可疑活动
          if (access.denied_count > 0) {
            suspiciousActivities.push(`${access.denied_count}次访问被拒绝`);
          }

          if (access.unique_claims > 20) {
            suspiciousActivities.push(
              `访问了${access.unique_claims}个不同债权`,
            );
          }

          const accessTypes = access.access_types || [];
          if (
            accessTypes.includes(AccessType.EXPORT) ||
            accessTypes.includes(AccessType.DOWNLOAD)
          ) {
            suspiciousActivities.push("执行了数据导出或下载操作");
          }

          anomalies.push({
            user_id: userId,
            user_name: access.accessor_name,
            access_count: recentCount,
            normal_average: normalAverage,
            anomaly_score: anomalyScore,
            suspicious_activities: suspiciousActivities,
          });
        }
      });

      // 按异常分数排序
      anomalies.sort((a, b) => b.anomaly_score - a.anomaly_score);

      return anomalies;
    } catch (error) {
      console.error("检测异常访问失败:", error);
      throw new Error("检测异常访问失败");
    }
  }

  /**
   * 清理旧的访问日志
   */
  async cleanupOldAccessLogs(daysToKeep: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const query = `
        DELETE FROM claim_access_log
        WHERE access_time < $cutoff_date
      `;

      const results = await queryWithAuth(this.client, query, {
        cutoff_date: cutoffDate.toISOString(),
      });

      return results.length;
    } catch (error) {
      console.error("清理旧访问日志失败:", error);
      throw new Error("清理旧访问日志失败");
    }
  }

  /**
   * 获取过滤后的审计数据
   */
  private async getFilteredAuditData(
    filters: AuditFilters,
  ): Promise<ClaimAccessLog[]> {
    const options: AuditLogQueryOptions = {
      date_range: filters.date_range,
      limit: 10000, // 导出时获取更多数据
    };

    if (filters.claim_ids && filters.claim_ids.length > 0) {
      // 如果有多个债权ID，需要使用IN查询
      const query = `
        SELECT
          *,
          claim_id.claim_number AS claim_number,
          claim_id.case_id.name AS case_name
        FROM claim_access_log
        WHERE claim_id IN $claim_ids
        ${filters.date_range ? "AND access_time >= $start_date AND access_time <= $end_date" : ""}
        ${filters.access_types && filters.access_types.length > 0 ? "AND access_type IN $access_types" : ""}
        ORDER BY access_time DESC
        LIMIT 10000
      `;

      const queryParams: Record<string, unknown> = {
        claim_ids: filters.claim_ids,
      };

      if (filters.date_range) {
        queryParams.start_date = filters.date_range.start.toISOString();
        queryParams.end_date = filters.date_range.end.toISOString();
      }

      if (filters.access_types && filters.access_types.length > 0) {
        queryParams.access_types = filters.access_types;
      }

      const results = await queryWithAuth(this.client, query, queryParams);
      return (results[0] as ClaimAccessLog[]) || [];
    } else {
      return await this.getAuditLog(options);
    }
  }

  /**
   * 生成Excel报告
   */
  private async generateExcelReport(
    data: ClaimAccessLog[],
    filters: AuditFilters,
  ): Promise<string> {
    // 这里应该实现实际的Excel生成逻辑
    // 目前返回模拟的URL
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `audit-report-${timestamp}.xlsx`;

    // 实际实现中，这里应该：
    // 1. 使用Excel库（如exceljs）生成Excel文件
    // 2. 将文件上传到文件存储服务（如MinIO）
    // 3. 返回文件的访问URL

    return `/exports/${filename}`;
  }

  /**
   * 生成PDF报告
   */
  private async generatePDFReport(
    data: ClaimAccessLog[],
    filters: AuditFilters,
  ): Promise<string> {
    // 这里应该实现实际的PDF生成逻辑
    // 目前返回模拟的URL
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `audit-report-${timestamp}.pdf`;

    // 实际实现中，这里应该：
    // 1. 使用PDF库（如puppeteer或jsPDF）生成PDF文件
    // 2. 将文件上传到文件存储服务（如MinIO）
    // 3. 返回文件的访问URL

    return `/exports/${filename}`;
  }

  /**
   * 记录导出操作
   */
  private async logExportOperation(
    format: string,
    filters: AuditFilters,
    recordCount: number,
  ): Promise<void> {
    try {
      // 这里可以记录导出操作到操作日志
      console.log(`导出审计报告: 格式=${format}, 记录数=${recordCount}`);
    } catch (error) {
      console.error("记录导出操作失败:", error);
    }
  }

  /**
   * 获取客户端信息（IP地址和用户代理）
   */
  private getClientInfo(): { ip_address?: string; user_agent?: string } {
    // 在浏览器环境中，我们无法直接获取真实IP地址
    // 这里返回可获取的信息，实际IP地址需要从服务端获取
    return {
      user_agent:
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      ip_address: undefined, // 需要从服务端获取
    };
  }

  /**
   * 格式化时长为ISO 8601 duration格式
   */
  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `PT${hours}H${minutes % 60}M${seconds % 60}S`;
    } else if (minutes > 0) {
      return `PT${minutes}M${seconds % 60}S`;
    } else {
      return `PT${seconds}S`;
    }
  }

  /**
   * 验证访问权限
   */
  async validateAccessPermission(
    claimId: string | RecordId,
    accessType: AccessType,
  ): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // 这里可以实现具体的权限验证逻辑
    // 目前返回允许访问，实际应该根据用户角色和债权状态进行验证
    
    // TODO: 实现真正的权限验证逻辑
    // - 检查用户角色
    // - 检查债权状态
    // - 检查访问类型权限
    
    return { allowed: true };
  }
}

export default ClaimAuditService;
