/**
 * 债权追踪审计增强服务
 * 提供访问审计、异常检测、安全监控等功能
 */

import { RecordId } from "surrealdb";

import type { SurrealWorkerAPI } from "../contexts/SurrealProvider";
import { queryWithAuth } from "@/src/utils/surrealAuth";
import { dataMaskingService } from "./dataMaskingService";
import {
  type TrackingPermissionType,
  type PermissionContext,
} from "./claimTrackingPermissionService";

// 审计事件类型
export enum AuditEventType {
  LOGIN = "login",
  LOGOUT = "logout",
  ACCESS = "access",
  OPERATION = "operation",
  PERMISSION_DENIED = "permission_denied",
  DATA_EXPORT = "data_export",
  SENSITIVE_ACCESS = "sensitive_access",
  BULK_OPERATION = "bulk_operation",
  SYSTEM_ERROR = "system_error",
}

// 风险级别
export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

// 审计事件记录
export interface AuditEvent {
  id?: RecordId;
  event_type: AuditEventType;
  user_id: RecordId | string;
  case_id?: RecordId | string;
  claim_id?: RecordId | string;
  resource_type: string; // 访问的资源类型
  resource_id?: string; // 访问的资源ID
  action: string; // 执行的操作
  result: "success" | "failure" | "denied";
  risk_level: RiskLevel;
  ip_address: string;
  user_agent: string;
  session_id?: string;
  request_path?: string;
  request_method?: string;
  request_params?: Record<string, any>;
  response_status?: number;
  processing_time?: number; // 处理时间（毫秒）
  error_message?: string;
  additional_data?: Record<string, any>;
  created_at: Date;
  expires_at?: Date; // 日志过期时间
}

// 异常检测规则
export interface AnomalyRule {
  id: string;
  name: string;
  description: string;
  rule_type: "frequency" | "pattern" | "threshold" | "geo" | "time";
  conditions: Record<string, any>;
  risk_level: RiskLevel;
  enabled: boolean;
  alert_threshold: number;
  time_window: number; // 检测时间窗口（分钟）
}

// 异常检测结果
export interface AnomalyDetectionResult {
  rule_id: string;
  rule_name: string;
  risk_level: RiskLevel;
  score: number; // 异常评分
  triggered_at: Date;
  user_id: RecordId | string;
  event_count: number;
  description: string;
  recommended_action: string;
  evidence: AuditEvent[];
}

// 审计统计
export interface AuditStatistics {
  total_events: number;
  events_by_type: Record<AuditEventType, number>;
  events_by_risk: Record<RiskLevel, number>;
  unique_users: number;
  failed_operations: number;
  permission_denials: number;
  avg_processing_time: number;
  time_range: {
    start: Date;
    end: Date;
  };
}

class ClaimTrackingAuditService {
  private clientGetter: (() => Promise<SurrealWorkerAPI>) | null = null;
  private anomalyRules: AnomalyRule[] = [];
  private readonly AUDIT_RETENTION_DAYS = 90; // 审计日志保留天数

  constructor() {
    this.initializeAnomalyRules();
  }

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
        "SurrealDB client not available. Ensure ClaimTrackingAuditService is properly initialized with setClientGetter.",
      );
    }

    const client = await this.clientGetter();
    if (!client) {
      throw new Error("SurrealDB client is null");
    }
    return client;
  }

  /**
   * 初始化异常检测规则
   */
  private initializeAnomalyRules(): void {
    this.anomalyRules = [
      {
        id: "frequent_failed_login",
        name: "频繁登录失败",
        description: "短时间内多次登录失败",
        rule_type: "frequency",
        conditions: {
          event_type: AuditEventType.LOGIN,
          result: "failure",
          max_count: 5,
          time_window: 15,
        },
        risk_level: RiskLevel.HIGH,
        enabled: true,
        alert_threshold: 5,
        time_window: 15,
      },
      {
        id: "bulk_data_access",
        name: "批量数据访问",
        description: "短时间内访问大量债权数据",
        rule_type: "frequency",
        conditions: {
          event_type: AuditEventType.ACCESS,
          resource_type: "claim",
          max_count: 100,
          time_window: 10,
        },
        risk_level: RiskLevel.MEDIUM,
        enabled: true,
        alert_threshold: 100,
        time_window: 10,
      },
      {
        id: "off_hours_access",
        name: "非工作时间访问",
        description: "在非工作时间访问敏感数据",
        rule_type: "time",
        conditions: {
          event_type: AuditEventType.SENSITIVE_ACCESS,
          work_hours_start: 9,
          work_hours_end: 18,
          work_days: [1, 2, 3, 4, 5], // 周一到周五
        },
        risk_level: RiskLevel.MEDIUM,
        enabled: true,
        alert_threshold: 1,
        time_window: 60,
      },
      {
        id: "suspicious_ip_pattern",
        name: "可疑IP模式",
        description: "来自多个不同IP的快速访问",
        rule_type: "pattern",
        conditions: {
          unique_ips_threshold: 5,
          time_window: 30,
          min_events_per_ip: 3,
        },
        risk_level: RiskLevel.HIGH,
        enabled: true,
        alert_threshold: 5,
        time_window: 30,
      },
      {
        id: "permission_escalation",
        name: "权限提升尝试",
        description: "尝试访问超出权限的资源",
        rule_type: "frequency",
        conditions: {
          event_type: AuditEventType.PERMISSION_DENIED,
          max_count: 10,
          time_window: 5,
        },
        risk_level: RiskLevel.CRITICAL,
        enabled: true,
        alert_threshold: 10,
        time_window: 5,
      },
    ];
  }

  /**
   * 记录审计事件
   */
  async recordAuditEvent(
    event: Omit<AuditEvent, "id" | "created_at" | "expires_at">,
  ): Promise<void> {
    try {
      const client = await this.getClient();

      // 脱敏处理审计事件数据
      const maskedEvent = dataMaskingService.maskOperationLogData(event);

      const auditEvent: AuditEvent = {
        ...maskedEvent.maskedData,
        created_at: new Date(),
        expires_at: new Date(
          Date.now() + this.AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
        ),
      };

      // 插入审计事件
      await queryWithAuth(client, `CREATE claim_audit_event CONTENT $event`, {
        event: auditEvent,
      });

      // 异步执行异常检测（不影响主流程）
      this.performAnomalyDetection(auditEvent).catch((error) => {
        console.error("Anomaly detection failed:", error);
      });
    } catch (error) {
      console.error("Failed to record audit event:", error);
      // 审计失败不应影响主业务流程，但需要记录到系统日志
      this.recordSystemError("audit_event_recording_failed", error);
    }
  }

  /**
   * 记录访问审计
   */
  async recordAccess(
    userId: RecordId | string,
    resourceType: string,
    resourceId: string,
    action: string,
    result: "success" | "failure" | "denied",
    context?: {
      caseId?: RecordId | string;
      claimId?: RecordId | string;
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      requestPath?: string;
      requestMethod?: string;
      requestParams?: Record<string, any>;
      responseStatus?: number;
      processingTime?: number;
      errorMessage?: string;
    },
  ): Promise<void> {
    const riskLevel = this.calculateRiskLevel(resourceType, action, result);

    await this.recordAuditEvent({
      event_type: AuditEventType.ACCESS,
      user_id: userId,
      case_id: context?.caseId,
      claim_id: context?.claimId,
      resource_type: resourceType,
      resource_id: resourceId,
      action,
      result,
      risk_level: riskLevel,
      ip_address: context?.ipAddress || "unknown",
      user_agent: context?.userAgent || "unknown",
      session_id: context?.sessionId,
      request_path: context?.requestPath,
      request_method: context?.requestMethod,
      request_params: context?.requestParams,
      response_status: context?.responseStatus,
      processing_time: context?.processingTime,
      error_message: context?.errorMessage,
    });
  }

  /**
   * 记录权限检查审计
   */
  async recordPermissionCheck(
    userId: RecordId | string,
    permissionType: TrackingPermissionType,
    permissionContext: PermissionContext,
    result: "granted" | "denied",
    reason?: string,
  ): Promise<void> {
    const eventType =
      result === "denied"
        ? AuditEventType.PERMISSION_DENIED
        : AuditEventType.ACCESS;
    const riskLevel = result === "denied" ? RiskLevel.MEDIUM : RiskLevel.LOW;

    await this.recordAuditEvent({
      event_type: eventType,
      user_id: userId,
      case_id: permissionContext.caseId,
      claim_id: permissionContext.claimId,
      resource_type: "permission",
      resource_id: permissionType,
      action: "permission_check",
      result: result === "granted" ? "success" : "denied",
      risk_level: riskLevel,
      ip_address: "system",
      user_agent: "system",
      additional_data: {
        permission_type: permissionType,
        permission_context: permissionContext,
        denial_reason: reason,
      },
    });
  }

  /**
   * 执行异常检测
   */
  private async performAnomalyDetection(event: AuditEvent): Promise<void> {
    const client = await this.getClient();
    const detectionResults: AnomalyDetectionResult[] = [];

    for (const rule of this.anomalyRules) {
      if (!rule.enabled) continue;

      try {
        const result = await this.checkAnomalyRule(client, rule, event);
        if (result) {
          detectionResults.push(result);
        }
      } catch (error) {
        console.error(`Anomaly rule ${rule.id} check failed:`, error);
      }
    }

    // 处理检测到的异常
    for (const result of detectionResults) {
      await this.handleAnomalyDetection(client, result);
    }
  }

  /**
   * 检查异常检测规则
   */
  private async checkAnomalyRule(
    client: SurrealWorkerAPI,
    rule: AnomalyRule,
    event: AuditEvent,
  ): Promise<AnomalyDetectionResult | null> {
    const timeWindow = new Date(Date.now() - rule.time_window * 60 * 1000);

    switch (rule.rule_type) {
      case "frequency":
        return await this.checkFrequencyRule(client, rule, event, timeWindow);

      case "pattern":
        return await this.checkPatternRule(client, rule, event, timeWindow);

      case "time":
        return await this.checkTimeRule(client, rule, event);

      case "threshold":
        return await this.checkThresholdRule(client, rule, event, timeWindow);

      default:
        return null;
    }
  }

  /**
   * 检查频率规则
   */
  private async checkFrequencyRule(
    client: SurrealWorkerAPI,
    rule: AnomalyRule,
    event: AuditEvent,
    timeWindow: Date,
  ): Promise<AnomalyDetectionResult | null> {
    try {
      const conditions = rule.conditions;
      let query = `
        SELECT count() AS event_count FROM claim_audit_event
        WHERE user_id = $userId
          AND created_at >= $timeWindow
      `;

      const params: any = {
        userId: event.user_id,
        timeWindow,
      };

      if (conditions.event_type) {
        query += ` AND event_type = $eventType`;
        params.eventType = conditions.event_type;
      }

      if (conditions.result) {
        query += ` AND result = $result`;
        params.result = conditions.result;
      }

      if (conditions.resource_type) {
        query += ` AND resource_type = $resourceType`;
        params.resourceType = conditions.resource_type;
      }

      const results = await queryWithAuth<Array<{ event_count: number }>>(
        client,
        query,
        params,
      );
      const countResult =
        Array.isArray(results) && results.length > 0 ? results[0] : null;
      const eventCount = countResult?.event_count || 0;

      if (eventCount >= rule.alert_threshold) {
        // 获取相关证据事件
        const evidenceQuery =
          query.replace("SELECT count() AS event_count", "SELECT *") +
          " ORDER BY created_at DESC LIMIT 20";
        const evidenceResults = await queryWithAuth<AuditEvent[]>(
          client,
          evidenceQuery,
          params,
        );
        const evidence = Array.isArray(evidenceResults) ? evidenceResults : [];

        return {
          rule_id: rule.id,
          rule_name: rule.name,
          risk_level: rule.risk_level,
          score: Math.min(100, (eventCount / rule.alert_threshold) * 50),
          triggered_at: new Date(),
          user_id: event.user_id,
          event_count: eventCount,
          description: `检测到用户在${rule.time_window}分钟内${conditions.event_type || "执行操作"}${eventCount}次，超出阈值${rule.alert_threshold}`,
          recommended_action: this.getRecommendedAction(rule.risk_level),
          evidence,
        };
      }

      return null;
    } catch (error) {
      console.error(`Error in checkFrequencyRule for rule ${rule.id}:`, error);
      return null;
    }
  }

  /**
   * 检查模式规则
   */
  private async checkPatternRule(
    client: SurrealWorkerAPI,
    rule: AnomalyRule,
    event: AuditEvent,
    timeWindow: Date,
  ): Promise<AnomalyDetectionResult | null> {
    try {
      const conditions = rule.conditions;

      if (rule.id === "suspicious_ip_pattern") {
        const query = `
          SELECT ip_address, count() AS event_count
          FROM claim_audit_event
          WHERE user_id = $userId
            AND created_at >= $timeWindow
          GROUP BY ip_address
        `;

        const results = await queryWithAuth<
          Array<{ ip_address: string; event_count: number }>
        >(client, query, { userId: event.user_id, timeWindow });

        const ipResults = Array.isArray(results) ? results : [];
        const uniqueIps = ipResults.length;
        const validIps = ipResults.filter(
          (r) => r.event_count >= (conditions.min_events_per_ip || 1),
        ).length;

        if (
          uniqueIps >= (conditions.unique_ips_threshold || 5) &&
          validIps >= 3
        ) {
          return {
            rule_id: rule.id,
            rule_name: rule.name,
            risk_level: rule.risk_level,
            score: Math.min(
              100,
              (uniqueIps / (conditions.unique_ips_threshold || 5)) * 60,
            ),
            triggered_at: new Date(),
            user_id: event.user_id,
            event_count: uniqueIps,
            description: `检测到用户在${rule.time_window}分钟内从${uniqueIps}个不同IP地址访问系统`,
            recommended_action: this.getRecommendedAction(rule.risk_level),
            evidence: [],
          };
        }
      }

      return null;
    } catch (error) {
      console.error(`Error in checkPatternRule for rule ${rule.id}:`, error);
      return null;
    }
  }

  /**
   * 检查时间规则
   */
  private async checkTimeRule(
    _client: SurrealWorkerAPI,
    rule: AnomalyRule,
    event: AuditEvent,
  ): Promise<AnomalyDetectionResult | null> {
    try {
      // 时间规则检查不需要查询数据库，主要基于事件时间戳
      if (
        rule.id === "off_hours_access" &&
        event.event_type === AuditEventType.SENSITIVE_ACCESS
      ) {
        const hour = new Date(event.created_at).getHours();
        const isWorkingHours = hour >= 9 && hour <= 18;

        if (!isWorkingHours) {
          return {
            rule_id: rule.id,
            rule_name: rule.name,
            risk_level: rule.risk_level,
            score: 40,
            triggered_at: new Date(),
            user_id: event.user_id,
            event_count: 1,
            description: `检测到用户在非工作时间（${hour}:00）访问敏感数据`,
            recommended_action: this.getRecommendedAction(rule.risk_level),
            evidence: [event],
          };
        }
      }

      return null;
    } catch (error) {
      console.error(`Error in checkTimeRule for rule ${rule.id}:`, error);
      return null;
    }
  }

  /**
   * 检查阈值规则
   */
  private async checkThresholdRule(
    client: SurrealWorkerAPI,
    rule: AnomalyRule,
    event: AuditEvent,
    timeWindow: Date,
  ): Promise<AnomalyDetectionResult | null> {
    try {
      const conditions = rule.conditions;

      // 查询指定时间窗口内的事件数量
      let query = `
        SELECT count() AS event_count FROM claim_audit_event
        WHERE user_id = $userId
          AND created_at >= $timeWindow
      `;

      const params: any = {
        userId: event.user_id,
        timeWindow,
      };

      // 添加条件过滤
      if (conditions.resource_type) {
        query += ` AND resource_type = $resourceType`;
        params.resourceType = conditions.resource_type;
      }

      if (conditions.event_type) {
        query += ` AND event_type = $eventType`;
        params.eventType = conditions.event_type;
      }

      const results = await queryWithAuth<Array<{ event_count: number }>>(
        client,
        query,
        params,
      );
      const countResult =
        Array.isArray(results) && results.length > 0 ? results[0] : null;
      const eventCount = countResult?.event_count || 0;

      if (eventCount >= rule.alert_threshold) {
        return {
          rule_id: rule.id,
          rule_name: rule.name,
          risk_level: rule.risk_level,
          score: Math.min(100, (eventCount / rule.alert_threshold) * 70),
          triggered_at: new Date(),
          user_id: event.user_id,
          event_count: eventCount,
          description: `检测到用户在${rule.time_window}分钟内的操作次数（${eventCount}次）超出阈值（${rule.alert_threshold}次）`,
          recommended_action: this.getRecommendedAction(rule.risk_level),
          evidence: [],
        };
      }

      return null;
    } catch (error) {
      console.error(`Error in checkThresholdRule for rule ${rule.id}:`, error);
      return null;
    }
  }

  /**
   * 处理异常检测结果
   */
  private async handleAnomalyDetection(
    client: SurrealWorkerAPI,
    result: AnomalyDetectionResult,
  ): Promise<void> {
    try {
      // 记录异常检测结果到数据库
      await queryWithAuth(
        client,
        `CREATE claim_anomaly_detection CONTENT $result`,
        { result },
      );

      // 根据风险级别执行不同的处理策略
      switch (result.risk_level) {
        case RiskLevel.CRITICAL:
          await this.handleCriticalRisk(result);
          break;

        case RiskLevel.HIGH:
          await this.handleHighRisk(result);
          break;

        case RiskLevel.MEDIUM:
          await this.handleMediumRisk(result);
          break;

        default:
          // 低风险只记录，不采取行动
          break;
      }
    } catch (error) {
      console.error("Failed to handle anomaly detection:", error);
    }
  }

  /**
   * 处理严重风险
   */
  private async handleCriticalRisk(
    result: AnomalyDetectionResult,
  ): Promise<void> {
    // 立即通知管理员
    // 可以考虑临时锁定用户账户
    console.warn(`CRITICAL RISK DETECTED: ${result.description}`, result);

    // 这里可以集成告警系统
    // await alertService.sendCriticalAlert(result);
  }

  /**
   * 处理高风险
   */
  private async handleHighRisk(result: AnomalyDetectionResult): Promise<void> {
    // 通知安全团队
    console.warn(`HIGH RISK DETECTED: ${result.description}`, result);

    // 这里可以集成通知系统
    // await notificationService.sendSecurityAlert(result);
  }

  /**
   * 处理中等风险
   */
  private async handleMediumRisk(
    result: AnomalyDetectionResult,
  ): Promise<void> {
    // 记录到安全日志
    console.info(`MEDIUM RISK DETECTED: ${result.description}`, result);
  }

  /**
   * 计算风险级别
   */
  private calculateRiskLevel(
    resourceType: string,
    action: string,
    result: "success" | "failure" | "denied",
  ): RiskLevel {
    if (result === "denied") {
      return RiskLevel.MEDIUM;
    }

    if (result === "failure") {
      return RiskLevel.LOW;
    }

    // 根据资源类型和操作判断风险级别
    if (
      resourceType === "claim" &&
      (action === "export" || action === "bulk_access")
    ) {
      return RiskLevel.MEDIUM;
    }

    if (action.includes("sensitive") || action.includes("admin")) {
      return RiskLevel.HIGH;
    }

    return RiskLevel.LOW;
  }

  /**
   * 获取推荐行动
   */
  private getRecommendedAction(riskLevel: RiskLevel): string {
    switch (riskLevel) {
      case RiskLevel.CRITICAL:
        return "立即审查用户活动，考虑临时限制账户权限";

      case RiskLevel.HIGH:
        return "通知安全团队进行详细调查，监控后续活动";

      case RiskLevel.MEDIUM:
        return "持续监控用户活动，记录相关行为模式";

      default:
        return "正常监控，定期审查";
    }
  }

  /**
   * 记录系统错误
   */
  private recordSystemError(errorType: string, error: any): void {
    // 简化的系统错误记录，实际项目中应该有更完善的错误处理
    console.error(`System Error [${errorType}]:`, error);
  }

  /**
   * 查询审计事件
   */
  async queryAuditEvents(filters: {
    userId?: RecordId | string;
    caseId?: RecordId | string;
    eventType?: AuditEventType;
    riskLevel?: RiskLevel;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditEvent[]> {
    try {
      const client = await this.getClient();

      let query = "SELECT * FROM claim_audit_event WHERE 1=1";
      const params: any = {};

      if (filters.userId) {
        query += " AND user_id = $userId";
        params.userId = filters.userId;
      }

      if (filters.caseId) {
        query += " AND case_id = $caseId";
        params.caseId = filters.caseId;
      }

      if (filters.eventType) {
        query += " AND event_type = $eventType";
        params.eventType = filters.eventType;
      }

      if (filters.riskLevel) {
        query += " AND risk_level = $riskLevel";
        params.riskLevel = filters.riskLevel;
      }

      if (filters.startTime) {
        query += " AND created_at >= $startTime";
        params.startTime = filters.startTime;
      }

      if (filters.endTime) {
        query += " AND created_at <= $endTime";
        params.endTime = filters.endTime;
      }

      query += " ORDER BY created_at DESC";

      if (filters.limit) {
        query += ` LIMIT $limit`;
        params.limit = filters.limit;
      }

      if (filters.offset) {
        query += ` START $offset`;
        params.offset = filters.offset;
      }

      const [events] = await queryWithAuth<AuditEvent[][]>(
        client,
        query,
        params,
      );
      return events || [];
    } catch (error) {
      console.error("Failed to query audit events:", error);
      return [];
    }
  }

  /**
   * 获取审计统计信息
   */
  async getAuditStatistics(filters: {
    startTime?: Date;
    endTime?: Date;
    userId?: RecordId | string;
    caseId?: RecordId | string;
  }): Promise<AuditStatistics> {
    try {
      const client = await this.getClient();

      let baseQuery = "FROM claim_audit_event WHERE 1=1";
      const params: any = {};

      if (filters.startTime) {
        baseQuery += " AND created_at >= $startTime";
        params.startTime = filters.startTime;
      }

      if (filters.endTime) {
        baseQuery += " AND created_at <= $endTime";
        params.endTime = filters.endTime;
      }

      if (filters.userId) {
        baseQuery += " AND user_id = $userId";
        params.userId = filters.userId;
      }

      if (filters.caseId) {
        baseQuery += " AND case_id = $caseId";
        params.caseId = filters.caseId;
      }

      // 执行多个统计查询
      const queries = [
        `SELECT count() as total ${baseQuery}`,
        `SELECT event_type, count() as count ${baseQuery} GROUP BY event_type`,
        `SELECT risk_level, count() as count ${baseQuery} GROUP BY risk_level`,
        `SELECT count() as unique_users ${baseQuery.replace("count()", "count(DISTINCT user_id)")}`,
        `SELECT count() as failed_ops ${baseQuery} AND result = 'failure'`,
        `SELECT count() as denied_ops ${baseQuery} AND result = 'denied'`,
        `SELECT math::mean(processing_time) as avg_time ${baseQuery} AND processing_time IS NOT NULL`,
      ];

      const results = await Promise.all(
        queries.map((query) =>
          queryWithAuth<any[]>(client, query, params).then(
            ([result]) => result,
          ),
        ),
      );

      const [
        totalResult,
        eventTypeResults,
        riskLevelResults,
        uniqueUsersResult,
        failedOpsResult,
        deniedOpsResult,
        avgTimeResult,
      ] = results;

      // 构建统计结果
      const eventsByType: Record<AuditEventType, number> = {} as any;
      eventTypeResults?.forEach((item: any) => {
        eventsByType[item.event_type as AuditEventType] = item.count;
      });

      const eventsByRisk: Record<RiskLevel, number> = {} as any;
      riskLevelResults?.forEach((item: any) => {
        eventsByRisk[item.risk_level as RiskLevel] = item.count;
      });

      return {
        total_events: totalResult?.[0]?.total || 0,
        events_by_type: eventsByType,
        events_by_risk: eventsByRisk,
        unique_users: uniqueUsersResult?.[0]?.unique_users || 0,
        failed_operations: failedOpsResult?.[0]?.failed_ops || 0,
        permission_denials: deniedOpsResult?.[0]?.denied_ops || 0,
        avg_processing_time: avgTimeResult?.[0]?.avg_time || 0,
        time_range: {
          start: filters.startTime || new Date(0),
          end: filters.endTime || new Date(),
        },
      };
    } catch (error) {
      console.error("Failed to get audit statistics:", error);
      return {
        total_events: 0,
        events_by_type: {} as any,
        events_by_risk: {} as any,
        unique_users: 0,
        failed_operations: 0,
        permission_denials: 0,
        avg_processing_time: 0,
        time_range: {
          start: new Date(0),
          end: new Date(),
        },
      };
    }
  }

  /**
   * 清理过期的审计日志
   */
  async cleanupExpiredAuditLogs(): Promise<number> {
    try {
      const client = await this.getClient();

      const query = `DELETE FROM claim_audit_event WHERE expires_at <= $now`;
      const [result] = await queryWithAuth<any[]>(client, query, {
        now: new Date(),
      });

      const deletedCount = Array.isArray(result) ? result.length : 0;
      console.log(`Cleaned up ${deletedCount} expired audit log entries`);

      return deletedCount;
    } catch (error) {
      console.error("Failed to cleanup expired audit logs:", error);
      return 0;
    }
  }

  /**
   * 导出审计报告
   */
  async exportAuditReport(filters: {
    startTime: Date;
    endTime: Date;
    userId?: RecordId | string;
    caseId?: RecordId | string;
    includeStatistics?: boolean;
  }): Promise<{
    events: AuditEvent[];
    statistics?: AuditStatistics;
    generatedAt: Date;
  }> {
    const events = await this.queryAuditEvents({
      ...filters,
      limit: 10000, // 限制导出数量
    });

    let statistics: AuditStatistics | undefined;
    if (filters.includeStatistics) {
      statistics = await this.getAuditStatistics(filters);
    }

    return {
      events,
      statistics,
      generatedAt: new Date(),
    };
  }
}

export const claimTrackingAuditService = new ClaimTrackingAuditService();
