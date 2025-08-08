/**
 * 债权统计分析服务
 * 提供债权处理效率、质量指标等统计功能
 */

import { RecordId } from "surrealdb";
import type { SurrealWorkerAPI } from "../contexts/SurrealProvider";
import { queryWithAuth } from "@/src/utils/surrealAuth";

// 统计数据类型定义
export interface ProcessingEfficiencyStats {
  avgProcessingDays: number;
  totalClaims: number;
  pendingClaims: number;
  processedClaims: number;
  timeRanges: {
    range: string;
    count: number;
    percentage: number;
  }[];
}

export interface QualityIndicatorStats {
  onePassRate: number;
  rejectionRate: number;
  supplementRequestRate: number;
  avgReviewRounds: number;
  totalReviewed: number;
}

export interface WorkloadStats {
  reviewerStats: {
    reviewerId: RecordId | string;
    reviewerName: string;
    totalReviewed: number;
    avgProcessingTime: number;
    efficiency: number;
  }[];
  dailyWorkload: {
    date: string;
    operationsCount: number;
    reviewsCount: number;
  }[];
}

export interface StatusFlowStats {
  statusDistribution: {
    status: string;
    count: number;
    percentage: number;
  }[];
  flowAnalysis: {
    fromStatus: string;
    toStatus: string;
    count: number;
    avgDuration: number;
  }[];
}

export interface BottleneckAnalysis {
  slowClaims: {
    claimId: RecordId | string;
    claimNumber: string;
    daysInStatus: number;
    currentStatus: string;
    submissionDate: string;
  }[];
  bottleneckStages: {
    stage: string;
    avgDuration: number;
    claimCount: number;
    severity: "low" | "medium" | "high";
  }[];
}

export interface TimeSeriesData {
  date: string;
  submissions: number;
  approvals: number;
  rejections: number;
  supplements: number;
}

class ClaimStatisticsService {
  private clientGetter: (() => Promise<SurrealWorkerAPI>) | null = null;

  /**
   * 设置客户端获取函数
   */
  setClientGetter(getter: () => Promise<SurrealWorkerAPI>) {
    this.clientGetter = getter;
  }

  /**
   * 获取 SurrealDB 客户端
   */
  private async getClient(): Promise<SurrealWorkerAPI> {
    if (!this.clientGetter) {
      throw new Error(
        "SurrealDB client not available. Ensure ClaimStatisticsService is properly initialized with setClientGetter.",
      );
    }

    const client = await this.clientGetter();
    if (!client) {
      throw new Error("SurrealDB client is null");
    }
    return client;
  }

  /**
   * 获取处理效率统计
   */
  async getProcessingEfficiencyStats(
    caseId?: RecordId | string,
    dateRange?: { start: Date; end: Date },
  ): Promise<ProcessingEfficiencyStats> {
    try {
      const client = await this.getClient();

      let whereClause = "";
      const params: any = {};

      if (caseId) {
        whereClause += " AND case_id = $caseId";
        params.caseId = caseId;
      }

      if (dateRange) {
        whereClause +=
          " AND created_at >= $startDate AND created_at <= $endDate";
        params.startDate = dateRange.start.toISOString();
        params.endDate = dateRange.end.toISOString();
      }

      // 获取处理时长统计
      const [processingStats] = await queryWithAuth<
        Array<{
          total_claims: number;
          pending_claims: number;
          processed_claims: number;
          avg_processing_days: number;
        }>[]
      >(
        client,
        `SELECT
          count() AS total_claims,
          count(IF review_status_id.name = '待审核' THEN 1 END) AS pending_claims,
          count(IF review_status_id.name != '待审核' THEN 1 END) AS processed_claims,
          math::mean(array::flatten(
            (SELECT math::floor(time::now() - created_at) / (24 * 60 * 60 * 1000) AS days
             FROM claim WHERE review_status_id.name != '待审核' ${whereClause})
          )) AS avg_processing_days
         FROM claim WHERE 1=1 ${whereClause}`,
        params,
      );

      // 获取时间分布统计
      const [timeRanges] = await queryWithAuth<
        Array<{
          range: string;
          count: number;
        }>[]
      >(
        client,
        `SELECT
          CASE
            WHEN days <= 3 THEN '0-3天'
            WHEN days <= 7 THEN '4-7天'
            WHEN days <= 14 THEN '8-14天'
            WHEN days <= 30 THEN '15-30天'
            ELSE '30天以上'
          END AS range,
          count() AS count
         FROM (
           SELECT math::floor(time::now() - created_at) / (24 * 60 * 60 * 1000) AS days
           FROM claim WHERE review_status_id.name != '待审核' ${whereClause}
         ) GROUP BY range ORDER BY range`,
        params,
      );

      const stats = processingStats[0] || {
        total_claims: 0,
        pending_claims: 0,
        processed_claims: 0,
        avg_processing_days: 0,
      };

      const processedTotal = stats.processed_claims || 1; // 避免除零

      return {
        avgProcessingDays: Math.round(stats.avg_processing_days || 0),
        totalClaims: stats.total_claims || 0,
        pendingClaims: stats.pending_claims || 0,
        processedClaims: stats.processed_claims || 0,
        timeRanges: (timeRanges || []).map((range) => ({
          range: range.range,
          count: range.count,
          percentage: Math.round((range.count / processedTotal) * 100),
        })),
      };
    } catch (error) {
      console.error("Error getting processing efficiency stats:", error);
      throw error;
    }
  }

  /**
   * 获取质量指标统计
   */
  async getQualityIndicatorStats(
    caseId?: RecordId | string,
    dateRange?: { start: Date; end: Date },
  ): Promise<QualityIndicatorStats> {
    try {
      const client = await this.getClient();

      let whereClause = "";
      const params: any = {};

      if (caseId) {
        whereClause += " AND case_id = $caseId";
        params.caseId = caseId;
      }

      if (dateRange) {
        whereClause +=
          " AND created_at >= $startDate AND created_at <= $endDate";
        params.startDate = dateRange.start.toISOString();
        params.endDate = dateRange.end.toISOString();
      }

      // 获取质量指标
      const [qualityStats] = await queryWithAuth<
        Array<{
          total_reviewed: number;
          one_pass_count: number;
          rejection_count: number;
          supplement_count: number;
          avg_review_rounds: number;
        }>[]
      >(
        client,
        `SELECT
          count() AS total_reviewed,
          count(IF review_status_id.name = '审核通过' THEN 1 END) AS one_pass_count,
          count(IF review_status_id.name = '审核不通过' THEN 1 END) AS rejection_count,
          count(IF review_status_id.name = '需要补充' THEN 1 END) AS supplement_count,
          math::mean(array::flatten(
            (SELECT count(*) FROM claim_status_flow
             WHERE claim_id = claim.id AND to_status.name IN ['审核通过', '审核不通过', '需要补充'])
          )) AS avg_review_rounds
         FROM claim WHERE review_status_id.name != '待审核' ${whereClause}`,
        params,
      );

      const stats = qualityStats[0] || {
        total_reviewed: 0,
        one_pass_count: 0,
        rejection_count: 0,
        supplement_count: 0,
        avg_review_rounds: 1,
      };

      const totalReviewed = stats.total_reviewed || 1; // 避免除零

      return {
        onePassRate: Math.round((stats.one_pass_count / totalReviewed) * 100),
        rejectionRate: Math.round(
          (stats.rejection_count / totalReviewed) * 100,
        ),
        supplementRequestRate: Math.round(
          (stats.supplement_count / totalReviewed) * 100,
        ),
        avgReviewRounds: Math.round(stats.avg_review_rounds || 1),
        totalReviewed: stats.total_reviewed,
      };
    } catch (error) {
      console.error("Error getting quality indicator stats:", error);
      throw error;
    }
  }

  /**
   * 获取工作量统计
   */
  async getWorkloadStats(
    caseId?: RecordId | string,
    dateRange?: { start: Date; end: Date },
  ): Promise<WorkloadStats> {
    try {
      const client = await this.getClient();

      let whereClause = "";
      const params: any = {};

      if (caseId) {
        whereClause += " AND claim_id.case_id = $caseId";
        params.caseId = caseId;
      }

      if (dateRange) {
        whereClause +=
          " AND operation_time >= $startDate AND operation_time <= $endDate";
        params.startDate = dateRange.start.toISOString();
        params.endDate = dateRange.end.toISOString();
      }

      // 获取审核人员工作量统计
      const [reviewerStats] = await queryWithAuth<
        Array<{
          reviewer_id: RecordId | string;
          reviewer_name: string;
          total_reviewed: number;
          avg_processing_time: number;
        }>[]
      >(
        client,
        `SELECT
          operator_id AS reviewer_id,
          operator_name AS reviewer_name,
          count() AS total_reviewed,
          math::mean(array::flatten(
            (SELECT time::now() - operation_time FROM claim_operation_log
             WHERE operator_id = parent.operator_id AND operation_type = 'review')
          )) / (24 * 60 * 60 * 1000) AS avg_processing_time
         FROM claim_operation_log
         WHERE operation_type IN ['review', 'approve', 'reject'] ${whereClause}
         GROUP BY operator_id, operator_name
         ORDER BY total_reviewed DESC`,
        params,
      );

      // 获取每日工作量统计
      const [dailyStats] = await queryWithAuth<
        Array<{
          date: string;
          operations_count: number;
          reviews_count: number;
        }>[]
      >(
        client,
        `SELECT
          time::format(operation_time, '%Y-%m-%d') AS date,
          count() AS operations_count,
          count(IF operation_type IN ['review', 'approve', 'reject'] THEN 1 END) AS reviews_count
         FROM claim_operation_log
         WHERE 1=1 ${whereClause}
         GROUP BY date
         ORDER BY date DESC
         LIMIT 30`,
        params,
      );

      return {
        reviewerStats: (reviewerStats || []).map((reviewer) => ({
          reviewerId: reviewer.reviewer_id,
          reviewerName: reviewer.reviewer_name,
          totalReviewed: reviewer.total_reviewed,
          avgProcessingTime: Math.round(reviewer.avg_processing_time || 0),
          efficiency:
            reviewer.total_reviewed > 0
              ? Math.round(100 / (reviewer.avg_processing_time || 1))
              : 0,
        })),
        dailyWorkload: (dailyStats || []).map((day) => ({
          date: day.date,
          operationsCount: day.operations_count,
          reviewsCount: day.reviews_count,
        })),
      };
    } catch (error) {
      console.error("Error getting workload stats:", error);
      throw error;
    }
  }

  /**
   * 获取状态流转统计
   */
  async getStatusFlowStats(
    caseId?: RecordId | string,
    dateRange?: { start: Date; end: Date },
  ): Promise<StatusFlowStats> {
    try {
      const client = await this.getClient();

      let whereClause = "";
      const params: any = {};

      if (caseId) {
        whereClause += " AND claim_id.case_id = $caseId";
        params.caseId = caseId;
      }

      if (dateRange) {
        whereClause +=
          " AND transition_time >= $startDate AND transition_time <= $endDate";
        params.startDate = dateRange.start.toISOString();
        params.endDate = dateRange.end.toISOString();
      }

      // 获取状态分布
      const [statusDist] = await queryWithAuth<
        Array<{
          status: string;
          count: number;
        }>[]
      >(
        client,
        `SELECT
          review_status_id.name AS status,
          count() AS count
         FROM claim
         GROUP BY status
         ORDER BY count DESC`,
        {},
      );

      // 获取流转分析
      const [flowAnalysis] = await queryWithAuth<
        Array<{
          from_status: string;
          to_status: string;
          count: number;
          avg_duration: number;
        }>[]
      >(
        client,
        `SELECT
          from_status.name AS from_status,
          to_status.name AS to_status,
          count() AS count,
          math::mean(duration_in_previous_status) / (24 * 60 * 60 * 1000) AS avg_duration
         FROM claim_status_flow
         WHERE 1=1 ${whereClause}
         GROUP BY from_status, to_status
         ORDER BY count DESC`,
        params,
      );

      const totalClaims =
        statusDist.reduce((sum, item) => sum + item.count, 0) || 1;

      return {
        statusDistribution: statusDist.map((item) => ({
          status: item.status,
          count: item.count,
          percentage: Math.round((item.count / totalClaims) * 100),
        })),
        flowAnalysis: flowAnalysis.map((flow) => ({
          fromStatus: flow.from_status || "初始",
          toStatus: flow.to_status,
          count: flow.count,
          avgDuration: Math.round(flow.avg_duration || 0),
        })),
      };
    } catch (error) {
      console.error("Error getting status flow stats:", error);
      throw error;
    }
  }

  /**
   * 获取瓶颈分析
   */
  async getBottleneckAnalysis(
    caseId?: RecordId | string,
    thresholdDays: number = 7,
  ): Promise<BottleneckAnalysis> {
    try {
      const client = await this.getClient();

      let whereClause = "";
      const params: any = { thresholdDays };

      if (caseId) {
        whereClause += " AND case_id = $caseId";
        params.caseId = caseId;
      }

      // 获取慢处理债权
      const [slowClaims] = await queryWithAuth<
        Array<{
          claim_id: RecordId | string;
          claim_number: string;
          days_in_status: number;
          current_status: string;
          submission_date: string;
        }>[]
      >(
        client,
        `SELECT
          id AS claim_id,
          claim_number,
          math::floor(time::now() - updated_at) / (24 * 60 * 60 * 1000) AS days_in_status,
          review_status_id.name AS current_status,
          time::format(created_at, '%Y-%m-%d') AS submission_date
         FROM claim
         WHERE math::floor(time::now() - updated_at) / (24 * 60 * 60 * 1000) > $thresholdDays ${whereClause}
         ORDER BY days_in_status DESC
         LIMIT 20`,
        params,
      );

      // 获取瓶颈阶段分析
      const [bottleneckStages] = await queryWithAuth<
        Array<{
          stage: string;
          avg_duration: number;
          claim_count: number;
        }>[]
      >(
        client,
        `SELECT
          to_status.name AS stage,
          math::mean(duration_in_previous_status) / (24 * 60 * 60 * 1000) AS avg_duration,
          count() AS claim_count
         FROM claim_status_flow
         WHERE duration_in_previous_status IS NOT NONE ${whereClause.replace("case_id", "claim_id.case_id")}
         GROUP BY stage
         HAVING avg_duration > $thresholdDays
         ORDER BY avg_duration DESC`,
        params,
      );

      return {
        slowClaims: slowClaims.map((claim) => ({
          claimId: claim.claim_id,
          claimNumber: claim.claim_number,
          daysInStatus: claim.days_in_status,
          currentStatus: claim.current_status,
          submissionDate: claim.submission_date,
        })),
        bottleneckStages: bottleneckStages.map((stage) => ({
          stage: stage.stage,
          avgDuration: Math.round(stage.avg_duration),
          claimCount: stage.claim_count,
          severity:
            stage.avg_duration > 14
              ? "high"
              : stage.avg_duration > 7
                ? "medium"
                : "low",
        })),
      };
    } catch (error) {
      console.error("Error getting bottleneck analysis:", error);
      throw error;
    }
  }

  /**
   * 获取时间序列数据
   */
  async getTimeSeriesData(
    caseId?: RecordId | string,
    days: number = 30,
  ): Promise<TimeSeriesData[]> {
    try {
      const client = await this.getClient();

      let whereClause = "";
      const params: any = { days };

      if (caseId) {
        whereClause += " AND case_id = $caseId";
        params.caseId = caseId;
      }

      const [timeSeriesData] = await queryWithAuth<
        Array<{
          date: string;
          submissions: number;
          approvals: number;
          rejections: number;
          supplements: number;
        }>[]
      >(
        client,
        `SELECT
          time::format(created_at, '%Y-%m-%d') AS date,
          count() AS submissions,
          count(IF review_status_id.name = '审核通过' THEN 1 END) AS approvals,
          count(IF review_status_id.name = '审核不通过' THEN 1 END) AS rejections,
          count(IF review_status_id.name = '需要补充' THEN 1 END) AS supplements
         FROM claim
         WHERE created_at >= time::now() - ($days * 24 * 60 * 60 * 1000) ${whereClause}
         GROUP BY date
         ORDER BY date DESC`,
        params,
      );

      return timeSeriesData || [];
    } catch (error) {
      console.error("Error getting time series data:", error);
      throw error;
    }
  }

  /**
   * 导出统计报告数据
   */
  async exportStatisticsReport(
    caseId?: RecordId | string,
    dateRange?: { start: Date; end: Date },
  ): Promise<{
    efficiency: ProcessingEfficiencyStats;
    quality: QualityIndicatorStats;
    workload: WorkloadStats;
    statusFlow: StatusFlowStats;
    bottleneck: BottleneckAnalysis;
    timeSeries: TimeSeriesData[];
  }> {
    try {
      const [
        efficiency,
        quality,
        workload,
        statusFlow,
        bottleneck,
        timeSeries,
      ] = await Promise.all([
        this.getProcessingEfficiencyStats(caseId, dateRange),
        this.getQualityIndicatorStats(caseId, dateRange),
        this.getWorkloadStats(caseId, dateRange),
        this.getStatusFlowStats(caseId, dateRange),
        this.getBottleneckAnalysis(caseId),
        this.getTimeSeriesData(caseId, 30),
      ]);

      return {
        efficiency,
        quality,
        workload,
        statusFlow,
        bottleneck,
        timeSeries,
      };
    } catch (error) {
      console.error("Error exporting statistics report:", error);
      throw error;
    }
  }
}

export const claimStatisticsService = new ClaimStatisticsService();
