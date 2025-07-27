/**
 * 债权操作追踪相关类型定义
 */

import { RecordId } from 'surrealdb';

// 操作类型枚举
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  SUBMIT = 'submit',
  WITHDRAW = 'withdraw',
  REVIEW = 'review',
  APPROVE = 'approve',
  REJECT = 'reject',
  SUPPLEMENT_REQUEST = 'supplement_request',
  DELETE = 'delete',
  VIEW = 'view'
}

// 访问类型枚举
export enum AccessType {
  VIEW = 'view',
  DOWNLOAD = 'download',
  EXPORT = 'export',
  PRINT = 'print'
}

// 版本类型枚举
export enum VersionType {
  INITIAL = 'initial',
  DRAFT_UPDATE = 'draft_update',
  SUBMISSION = 'submission',
  REVIEW_UPDATE = 'review_update',
  APPROVAL = 'approval',
  REJECTION = 'rejection'
}

// 状态流转类型枚举
export enum TransitionType {
  USER_ACTION = 'user_action',
  SYSTEM_ACTION = 'system_action',
  ADMIN_ACTION = 'admin_action',
  AUTO_TRANSITION = 'auto_transition'
}

// 操作结果枚举
export enum OperationResult {
  SUCCESS = 'success',
  FAILED = 'failed',
  PARTIAL = 'partial'
}

// 访问结果枚举
export enum AccessResult {
  SUCCESS = 'success',
  DENIED = 'denied',
  ERROR = 'error'
}

// 债权操作日志接口
export interface ClaimOperationLog {
  id?: string | RecordId;
  claim_id: string | RecordId;
  operation_type: OperationType;
  operation_description: string;
  operator_id: string | RecordId;
  operator_name: string;
  operator_role: string;
  operation_time: string;
  ip_address?: string;
  user_agent?: string;
  operation_details?: Record<string, unknown>;
  before_data?: Record<string, unknown>;
  after_data?: Record<string, unknown>;
  changed_fields?: string[];
  operation_result: OperationResult;
  error_message?: string;
  related_documents?: (string | RecordId)[];
  business_context?: Record<string, unknown>;
}

// 债权版本历史接口
export interface ClaimVersionHistory {
  id?: string | RecordId;
  claim_id: string | RecordId;
  version_number: number;
  version_type: VersionType;
  snapshot_data: Record<string, unknown>;
  change_summary?: string;
  changed_by: string | RecordId;
  change_reason?: string;
  created_at: string;
  related_operation_log_id?: string | RecordId;
  checksum?: string;
}

// 债权状态流转接口
export interface ClaimStatusFlow {
  id?: string | RecordId;
  claim_id: string | RecordId;
  from_status?: string | RecordId;
  to_status: string | RecordId;
  transition_type: TransitionType;
  trigger_reason: string;
  transition_time: string;
  operator_id: string | RecordId;
  operator_role: string;
  transition_notes?: string;
  review_comments?: string;
  duration_in_previous_status?: string; // ISO 8601 duration format
  related_operation_log_id?: string | RecordId;
}

// 债权访问日志接口
export interface ClaimAccessLog {
  id?: string | RecordId;
  claim_id: string | RecordId;
  access_type: AccessType;
  accessor_id: string | RecordId;
  accessor_name: string;
  accessor_role: string;
  access_time: string;
  ip_address?: string;
  user_agent?: string;
  accessed_fields?: string[];
  access_duration?: string; // ISO 8601 duration format
  access_result: AccessResult;
  denial_reason?: string;
}

// 操作统计接口
export interface OperationStatistics {
  total_operations: number;
  operations_by_type: Record<OperationType, number>;
  operations_by_user: Record<string, number>;
  operations_by_date: Record<string, number>;
  average_processing_time?: number;
  success_rate: number;
}

// 状态统计接口
export interface StatusStatistics {
  total_transitions: number;
  transitions_by_status: Record<string, number>;
  average_duration_by_status: Record<string, number>;
  status_distribution: Record<string, number>;
}

// 版本对比结果接口
export interface VersionDiff {
  claim_id: string | RecordId;
  from_version: number;
  to_version: number;
  changes: FieldChange[];
  change_summary: string;
}

// 字段变更接口
export interface FieldChange {
  field_path: string;
  field_name: string;
  old_value: unknown;
  new_value: unknown;
  change_type: 'added' | 'removed' | 'modified';
}

// 操作日志查询选项
export interface OperationLogQueryOptions {
  limit?: number;
  offset?: number;
  operation_type?: OperationType;
  date_range?: {
    start: Date;
    end: Date;
  };
  operator_id?: string;
  operation_result?: OperationResult;
}

// 审计日志查询选项
export interface AuditLogQueryOptions {
  claim_id?: string;
  user_id?: string;
  date_range?: {
    start: Date;
    end: Date;
  };
  access_type?: AccessType;
  access_result?: AccessResult;
  limit?: number;
  offset?: number;
}

// 统计查询参数
export interface StatisticsQueryParams {
  case_id?: string;
  date_range?: {
    start: Date;
    end: Date;
  };
  group_by?: 'operator' | 'operation_type' | 'date' | 'status';
}

// 审计过滤器
export interface AuditFilters {
  claim_ids?: string[];
  user_ids?: string[];
  date_range?: {
    start: Date;
    end: Date;
  };
  access_types?: AccessType[];
  include_sensitive_data?: boolean;
}

// 操作日志记录参数
export interface LogOperationParams {
  claim_id: string | RecordId;
  operation_type: OperationType;
  description: string;
  before_data?: Record<string, unknown>;
  after_data?: Record<string, unknown>;
  operation_details?: Record<string, unknown>;
  business_context?: Record<string, unknown>;
  related_documents?: (string | RecordId)[];
}

// 版本快照创建参数
export interface CreateVersionSnapshotParams {
  claim_id: string | RecordId;
  version_type: VersionType;
  change_summary?: string;
  change_reason?: string;
  related_operation_log_id?: string | RecordId;
}

// 状态流转记录参数
export interface RecordStatusTransitionParams {
  claim_id: string | RecordId;
  from_status?: string | RecordId;
  to_status: string | RecordId;
  transition_type: TransitionType;
  trigger_reason: string;
  transition_notes?: string;
  review_comments?: string;
  related_operation_log_id?: string | RecordId;
}

// 访问日志记录参数
export interface LogAccessParams {
  claim_id: string | RecordId;
  access_type: AccessType;
  accessed_fields?: string[];
  access_duration?: number; // 毫秒
}

// 缓存和同步相关类型定义

// 操作追踪缓存策略配置
export interface TrackingCacheStrategy {
  table: string;
  strategy: 'LOCAL_FIRST' | 'REMOTE_FIRST' | 'HYBRID' | 'LOCAL_ONLY' | 'REMOTE_ONLY';
  ttl: number;
  preload: boolean;
  autoRefresh: boolean;
  refreshInterval?: number;
}

// 操作追踪同步状态
export interface TrackingSyncStatus {
  table: string;
  last_sync_time: string;
  sync_status: 'idle' | 'syncing' | 'error' | 'paused';
  pending_operations: number;
  error_message?: string;
  next_sync_time?: string;
}

// 操作追踪实时事件
export interface TrackingRealtimeEvent {
  event_type: 'operation_created' | 'version_created' | 'status_changed' | 'access_logged';
  table_name: string;
  record_id: string;
  claim_id: string;
  event_data: Record<string, unknown>;
  timestamp: string;
  user_id: string;
}

// 缓存失效规则
export interface CacheInvalidationRule {
  trigger_table: string;
  trigger_operation: 'CREATE' | 'UPDATE' | 'DELETE';
  affected_tables: string[];
  invalidation_condition?: (data: Record<string, unknown>) => boolean;
}

// 操作追踪性能指标
export interface TrackingPerformanceMetrics {
  cache_hit_rate: number;
  average_query_time: number;
  total_operations: number;
  failed_operations: number;
  sync_lag_time: number;
  memory_usage: number;
}

// 批量操作结果
export interface BatchOperationResult {
  total_count: number;
  success_count: number;
  failed_count: number;
  failed_items: Array<{
    item: unknown;
    error: string;
  }>;
  execution_time: number;
}

// 数据导出配置
export interface ExportConfiguration {
  format: 'excel' | 'pdf' | 'csv' | 'json';
  include_sensitive_data: boolean;
  date_range?: {
    start: Date;
    end: Date;
  };
  filters: Record<string, unknown>;
  template?: string;
  compression?: boolean;
}

// 报告生成参数
export interface ReportGenerationParams {
  report_type: 'operation_summary' | 'audit_trail' | 'performance_metrics' | 'compliance_report';
  time_period: {
    start: Date;
    end: Date;
  };
  scope: {
    case_ids?: string[];
    claim_ids?: string[];
    user_ids?: string[];
  };
  format: 'pdf' | 'excel' | 'html';
  include_charts: boolean;
  language: 'zh-CN' | 'en-US';
}

// 通知配置
export interface TrackingNotificationConfig {
  event_type: string;
  enabled: boolean;
  recipients: string[];
  template: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  delivery_methods: ('email' | 'sms' | 'push' | 'in_app')[];
  conditions?: Record<string, unknown>;
}

// 权限检查结果
export interface PermissionCheckResult {
  has_permission: boolean;
  permission_level: 'none' | 'read' | 'write' | 'admin';
  denied_reason?: string;
  required_roles?: string[];
  context_data?: Record<string, unknown>;
}

// 数据脱敏配置
export interface DataMaskingConfig {
  field_name: string;
  masking_type: 'partial' | 'full' | 'hash' | 'encrypt';
  masking_pattern?: string;
  preserve_length: boolean;
  apply_to_exports: boolean;
}