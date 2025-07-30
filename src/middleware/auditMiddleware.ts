/**
 * 审计中间件
 * 自动拦截和记录系统访问、操作和权限检查
 */

import { RecordId } from 'surrealdb';
import { 
  claimTrackingAuditService,
  AuditEventType,
  RiskLevel
} from '../services/claimTrackingAuditService';
import { 
  claimTrackingPermissionService,
  type TrackingPermissionType,
  type PermissionContext
} from '../services/claimTrackingPermissionService';
import type { AppUser } from '../contexts/AuthContext';

// 审计配置
export interface AuditConfig {
  enabled: boolean;
  sensitiveResources: string[];
  bulkOperationThreshold: number;
  trackPermissionChecks: boolean;
  trackDataAccess: boolean;
  trackExports: boolean;
}

// 请求上下文
export interface RequestContext {
  user: AppUser | null;
  caseId?: RecordId | string;
  claimId?: RecordId | string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestPath?: string;
  requestMethod?: string;
  requestParams?: Record<string, any>;
  timestamp: Date;
}

// 操作结果
export interface OperationResult {
  success: boolean;
  data?: any;
  error?: Error;
  processingTime: number;
  recordsAffected?: number;
}

class AuditMiddleware {
  private config: AuditConfig = {
    enabled: true,
    sensitiveResources: [
      'claim',
      'creditor',
      'user',
      'case',
      'claim_operation_log',
      'claim_version_history',
      'claim_access_log'
    ],
    bulkOperationThreshold: 50,
    trackPermissionChecks: true,
    trackDataAccess: true,
    trackExports: true
  };

  /**
   * 更新审计配置
   */
  updateConfig(config: Partial<AuditConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取客户端信息
   */
  private getClientInfo(): { ipAddress: string; userAgent: string; sessionId?: string } {
    // 在浏览器环境中获取客户端信息
    const ipAddress = 'client'; // 实际项目中可能需要从服务器获取真实IP
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
    const sessionId = typeof window !== 'undefined' ? 
      sessionStorage.getItem('session_id') || undefined : undefined;

    return { ipAddress, userAgent, sessionId };
  }

  /**
   * 创建请求上下文
   */
  createRequestContext(
    user: AppUser | null,
    options?: {
      caseId?: RecordId | string;
      claimId?: RecordId | string;
      requestPath?: string;
      requestMethod?: string;
      requestParams?: Record<string, any>;
    }
  ): RequestContext {
    const clientInfo = this.getClientInfo();
    
    return {
      user,
      caseId: options?.caseId,
      claimId: options?.claimId,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      sessionId: clientInfo.sessionId,
      requestPath: options?.requestPath,
      requestMethod: options?.requestMethod,
      requestParams: options?.requestParams,
      timestamp: new Date()
    };
  }

  /**
   * 审计数据访问
   */
  async auditDataAccess(
    context: RequestContext,
    resourceType: string,
    resourceId: string | undefined,
    action: string,
    result: OperationResult
  ): Promise<void> {
    if (!this.config.enabled || !this.config.trackDataAccess || !context.user) {
      return;
    }

    try {
      // 判断是否为敏感资源访问
      const isSensitive = this.config.sensitiveResources.includes(resourceType);
      const isBulkOperation = (result.recordsAffected || 0) >= this.config.bulkOperationThreshold;
      
      // 确定事件类型
      let eventType = AuditEventType.ACCESS;
      if (isBulkOperation) {
        eventType = AuditEventType.BULK_OPERATION;
      } else if (isSensitive) {
        eventType = AuditEventType.SENSITIVE_ACCESS;
      }

      // 记录审计事件
      await claimTrackingAuditService.recordAccess(
        context.user.id,
        resourceType,
        resourceId || 'unknown',
        action,
        result.success ? 'success' : 'failure',
        {
          caseId: context.caseId,
          claimId: context.claimId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId,
          requestPath: context.requestPath,
          requestMethod: context.requestMethod,
          requestParams: context.requestParams,
          responseStatus: result.success ? 200 : 500,
          processingTime: result.processingTime,
          errorMessage: result.error?.message
        }
      );

    } catch (error) {
      console.error('Failed to audit data access:', error);
    }
  }

  /**
   * 审计权限检查
   */
  async auditPermissionCheck(
    context: RequestContext,
    permissionType: TrackingPermissionType,
    permissionContext: PermissionContext,
    granted: boolean,
    reason?: string
  ): Promise<void> {
    if (!this.config.enabled || !this.config.trackPermissionChecks || !context.user) {
      return;
    }

    try {
      await claimTrackingAuditService.recordPermissionCheck(
        context.user.id,
        permissionType,
        permissionContext,
        granted ? 'granted' : 'denied',
        reason
      );
    } catch (error) {
      console.error('Failed to audit permission check:', error);
    }
  }

  /**
   * 审计数据导出
   */
  async auditDataExport(
    context: RequestContext,
    exportType: string,
    recordCount: number,
    format: string,
    result: OperationResult
  ): Promise<void> {
    if (!this.config.enabled || !this.config.trackExports || !context.user) {
      return;
    }

    try {
      await claimTrackingAuditService.recordAuditEvent({
        event_type: AuditEventType.DATA_EXPORT,
        user_id: context.user.id,
        case_id: context.caseId,
        claim_id: context.claimId,
        resource_type: 'export',
        resource_id: exportType,
        action: `export_${format}`,
        result: result.success ? 'success' : 'failure',
        risk_level: this.calculateExportRiskLevel(recordCount, exportType),
        ip_address: context.ipAddress || 'unknown',
        user_agent: context.userAgent || 'unknown',
        session_id: context.sessionId,
        request_path: context.requestPath,
        request_method: context.requestMethod,
        processing_time: result.processingTime,
        error_message: result.error?.message,
        additional_data: {
          export_type: exportType,
          record_count: recordCount,
          format,
          file_size: result.data?.fileSize
        }
      });
    } catch (error) {
      console.error('Failed to audit data export:', error);
    }
  }

  /**
   * 审计操作执行
   */
  async auditOperation(
    context: RequestContext,
    operationType: string,
    targetResource: string,
    targetId: string | undefined,
    result: OperationResult,
    additionalData?: Record<string, any>
  ): Promise<void> {
    if (!this.config.enabled || !context.user) {
      return;
    }

    try {
      await claimTrackingAuditService.recordAuditEvent({
        event_type: AuditEventType.OPERATION,
        user_id: context.user.id,
        case_id: context.caseId,
        claim_id: context.claimId,
        resource_type: targetResource,
        resource_id: targetId,
        action: operationType,
        result: result.success ? 'success' : 'failure',
        risk_level: this.calculateOperationRiskLevel(operationType, targetResource, result),
        ip_address: context.ipAddress || 'unknown',
        user_agent: context.userAgent || 'unknown',
        session_id: context.sessionId,
        request_path: context.requestPath,
        request_method: context.requestMethod,
        processing_time: result.processingTime,
        error_message: result.error?.message,
        additional_data: {
          operation_type: operationType,
          records_affected: result.recordsAffected,
          ...additionalData
        }
      });
    } catch (error) {
      console.error('Failed to audit operation:', error);
    }
  }

  /**
   * 审计用户登录
   */
  async auditLogin(
    userId: RecordId | string,
    success: boolean,
    errorMessage?: string,
    additionalData?: Record<string, any>
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const clientInfo = this.getClientInfo();
      
      await claimTrackingAuditService.recordAuditEvent({
        event_type: AuditEventType.LOGIN,
        user_id: userId,
        resource_type: 'auth',
        resource_id: 'login',
        action: 'login',
        result: success ? 'success' : 'failure',
        risk_level: success ? RiskLevel.LOW : RiskLevel.MEDIUM,
        ip_address: clientInfo.ipAddress,
        user_agent: clientInfo.userAgent,
        session_id: clientInfo.sessionId,
        error_message: errorMessage,
        additional_data: additionalData
      });
    } catch (error) {
      console.error('Failed to audit login:', error);
    }
  }

  /**
   * 审计用户登出
   */
  async auditLogout(
    userId: RecordId | string,
    reason?: string
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const clientInfo = this.getClientInfo();
      
      await claimTrackingAuditService.recordAuditEvent({
        event_type: AuditEventType.LOGOUT,
        user_id: userId,
        resource_type: 'auth',
        resource_id: 'logout',
        action: 'logout',
        result: 'success',
        risk_level: RiskLevel.LOW,
        ip_address: clientInfo.ipAddress,
        user_agent: clientInfo.userAgent,
        session_id: clientInfo.sessionId,
        additional_data: {
          logout_reason: reason
        }
      });
    } catch (error) {
      console.error('Failed to audit logout:', error);
    }
  }

  /**
   * 计算导出操作的风险级别
   */
  private calculateExportRiskLevel(recordCount: number, exportType: string): RiskLevel {
    // 大量数据导出
    if (recordCount > 1000) {
      return RiskLevel.HIGH;
    }
    
    // 中等数量数据导出
    if (recordCount > 100) {
      return RiskLevel.MEDIUM;
    }
    
    // 敏感数据类型导出
    if (this.config.sensitiveResources.includes(exportType)) {
      return RiskLevel.MEDIUM;
    }
    
    return RiskLevel.LOW;
  }

  /**
   * 计算操作的风险级别
   */
  private calculateOperationRiskLevel(
    operationType: string,
    targetResource: string,
    result: OperationResult
  ): RiskLevel {
    // 操作失败
    if (!result.success) {
      return RiskLevel.MEDIUM;
    }
    
    // 批量操作
    if ((result.recordsAffected || 0) >= this.config.bulkOperationThreshold) {
      return RiskLevel.MEDIUM;
    }
    
    // 删除操作
    if (operationType.includes('delete') || operationType.includes('remove')) {
      return RiskLevel.MEDIUM;
    }
    
    // 敏感资源操作
    if (this.config.sensitiveResources.includes(targetResource)) {
      return RiskLevel.MEDIUM;
    }
    
    // 管理操作
    if (operationType.includes('admin') || operationType.includes('manage')) {
      return RiskLevel.MEDIUM;
    }
    
    return RiskLevel.LOW;
  }

  /**
   * 包装异步操作以自动审计
   */
  async wrapOperation<T>(
    context: RequestContext,
    operationType: string,
    targetResource: string,
    targetId: string | undefined,
    operation: () => Promise<T>,
    additionalData?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    let result: OperationResult;
    let operationResult: T;
    
    try {
      operationResult = await operation();
      result = {
        success: true,
        data: operationResult,
        processingTime: Date.now() - startTime,
        recordsAffected: this.extractRecordsAffected(operationResult)
      };
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        processingTime: Date.now() - startTime
      };
      throw error;
    } finally {
      // 异步审计，不影响主流程
      this.auditOperation(context, operationType, targetResource, targetId, result, additionalData)
        .catch(auditError => {
          console.error('Audit operation failed:', auditError);
        });
    }
    
    return operationResult;
  }

  /**
   * 包装数据访问操作以自动审计
   */
  async wrapDataAccess<T>(
    context: RequestContext,
    resourceType: string,
    resourceId: string | undefined,
    action: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    let result: OperationResult;
    let operationResult: T;
    
    try {
      operationResult = await operation();
      result = {
        success: true,
        data: operationResult,
        processingTime: Date.now() - startTime,
        recordsAffected: this.extractRecordsAffected(operationResult)
      };
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        processingTime: Date.now() - startTime
      };
      throw error;
    } finally {
      // 异步审计，不影响主流程
      this.auditDataAccess(context, resourceType, resourceId, action, result)
        .catch(auditError => {
          console.error('Audit data access failed:', auditError);
        });
    }
    
    return operationResult;
  }

  /**
   * 提取受影响的记录数
   */
  private extractRecordsAffected(result: any): number | undefined {
    if (Array.isArray(result)) {
      return result.length;
    }
    
    if (typeof result === 'object' && result !== null) {
      if ('length' in result) {
        return result.length;
      }
      if ('count' in result) {
        return result.count;
      }
      if ('affected' in result) {
        return result.affected;
      }
    }
    
    return undefined;
  }

  /**
   * 获取当前配置
   */
  getConfig(): AuditConfig {
    return { ...this.config };
  }

  /**
   * 检查是否启用审计
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 检查是否为敏感资源
   */
  isSensitiveResource(resourceType: string): boolean {
    return this.config.sensitiveResources.includes(resourceType);
  }
}

export const auditMiddleware = new AuditMiddleware();