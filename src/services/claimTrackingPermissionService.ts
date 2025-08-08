/**
 * 债权追踪权限控制服务
 * 实现操作追踪数据的细粒度权限控制
 */

import { RecordId } from "surrealdb";

import type { SurrealWorkerAPI } from "../contexts/SurrealProvider";
import { queryWithAuth } from "@/src/utils/surrealAuth";

// 权限级别定义
export enum PermissionLevel {
  NONE = "none", // 无权限
  READ = "read", // 只读权限
  WRITE = "write", // 读写权限
  ADMIN = "admin", // 管理员权限
}

// 操作追踪权限类型
export enum TrackingPermissionType {
  OPERATION_LOG = "operation_log", // 操作日志权限
  VERSION_HISTORY = "version_history", // 版本历史权限
  STATUS_FLOW = "status_flow", // 状态流转权限
  ACCESS_LOG = "access_log", // 访问日志权限
  STATISTICS = "statistics", // 统计分析权限
  EXPORT = "export", // 数据导出权限
}

// 权限检查结果
export interface TrackingPermissionResult {
  hasPermission: boolean;
  permissionLevel: PermissionLevel;
  reason?: string;
  restrictions?: {
    canViewSensitiveData: boolean;
    canViewOtherUsers: boolean;
    canExportData: boolean;
    maxRecordsAccess: number;
  };
}

// 权限上下文
export interface PermissionContext {
  userId: RecordId | string;
  caseId?: RecordId | string;
  claimId?: RecordId | string;
  targetUserId?: RecordId | string; // 目标用户ID（查看他人操作时）
  operationType?: string; // 操作类型
  isSystemAdmin?: boolean; // 是否系统管理员
}

class ClaimTrackingPermissionService {
  private clientGetter: (() => Promise<SurrealWorkerAPI>) | null = null;
  private permissionCache = new Map<
    string,
    { result: TrackingPermissionResult; expiry: number }
  >();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

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
        "SurrealDB client not available. Ensure ClaimTrackingPermissionService is properly initialized with setClientGetter.",
      );
    }

    const client = await this.clientGetter();
    if (!client) {
      throw new Error("SurrealDB client is null");
    }
    return client;
  }

  /**
   * 生成权限缓存键
   */
  private generateCacheKey(
    permissionType: TrackingPermissionType,
    context: PermissionContext,
  ): string {
    return `${permissionType}_${context.userId}_${context.caseId || "global"}_${context.claimId || "all"}_${context.targetUserId || "self"}`;
  }

  /**
   * 从缓存获取权限结果
   */
  private getFromCache(cacheKey: string): TrackingPermissionResult | null {
    const cached = this.permissionCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.result;
    }
    if (cached) {
      this.permissionCache.delete(cacheKey);
    }
    return null;
  }

  /**
   * 将权限结果存入缓存
   */
  private setToCache(cacheKey: string, result: TrackingPermissionResult): void {
    this.permissionCache.set(cacheKey, {
      result,
      expiry: Date.now() + this.CACHE_TTL,
    });
  }

  /**
   * 检查债权追踪数据访问权限
   */
  async checkTrackingPermission(
    permissionType: TrackingPermissionType,
    context: PermissionContext,
  ): Promise<TrackingPermissionResult> {
    try {
      const cacheKey = this.generateCacheKey(permissionType, context);

      // 检查缓存
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // 系统管理员检查
      if (context.isSystemAdmin || (await this.isSystemAdmin(context.userId))) {
        const adminResult: TrackingPermissionResult = {
          hasPermission: true,
          permissionLevel: PermissionLevel.ADMIN,
          reason: "System administrator access",
          restrictions: {
            canViewSensitiveData: true,
            canViewOtherUsers: true,
            canExportData: true,
            maxRecordsAccess: Number.MAX_SAFE_INTEGER,
          },
        };
        this.setToCache(cacheKey, adminResult);
        return adminResult;
      }

      // 基于权限类型的具体检查
      const result = await this.checkSpecificPermission(
        permissionType,
        context,
      );

      this.setToCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error("Error checking tracking permission:", error);
      return {
        hasPermission: false,
        permissionLevel: PermissionLevel.NONE,
        reason: `Permission check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * 检查是否为系统管理员
   */
  private async isSystemAdmin(userId: RecordId | string): Promise<boolean> {
    try {
      const client = await this.getClient();

      // 检查用户是否有管理员全局角色
      const adminRoles = await queryWithAuth<Array<{ role_name: string }>>(
        client,
        `SELECT out.name AS role_name FROM $userId->has_role
         WHERE out.name CONTAINS 'admin'`,
        { userId },
      );

      const roles = Array.isArray(adminRoles) ? adminRoles : [];
      return roles.length > 0;
    } catch (error) {
      console.error("Error checking system admin status:", error);
      return false;
    }
  }

  /**
   * 检查特定类型的权限
   */
  private async checkSpecificPermission(
    permissionType: TrackingPermissionType,
    context: PermissionContext,
  ): Promise<TrackingPermissionResult> {
    const client = await this.getClient();

    switch (permissionType) {
      case TrackingPermissionType.OPERATION_LOG:
        return await this.checkOperationLogPermission(client, context);

      case TrackingPermissionType.VERSION_HISTORY:
        return await this.checkVersionHistoryPermission(client, context);

      case TrackingPermissionType.STATUS_FLOW:
        return await this.checkStatusFlowPermission(client, context);

      case TrackingPermissionType.ACCESS_LOG:
        return await this.checkAccessLogPermission(client, context);

      case TrackingPermissionType.STATISTICS:
        return await this.checkStatisticsPermission(client, context);

      case TrackingPermissionType.EXPORT:
        return await this.checkExportPermission(client, context);

      default:
        return {
          hasPermission: false,
          permissionLevel: PermissionLevel.NONE,
          reason: `Unknown permission type: ${permissionType}`,
        };
    }
  }

  /**
   * 检查操作日志权限
   */
  private async checkOperationLogPermission(
    client: SurrealWorkerAPI,
    context: PermissionContext,
  ): Promise<TrackingPermissionResult> {
    try {
      // 检查用户是否有债权操作日志的读取权限
      const permissions = await queryWithAuth<Array<{ can_execute: boolean }>>(
        client,
        `SELECT can_execute FROM $userId->has_role->role->can_execute_operation->operation_metadata
         WHERE tables CONTAINS 'claim_operation_log' AND operation_type = 'read'
         ${
           context.caseId
             ? `
         UNION
         SELECT can_execute FROM $userId->has_case_role[WHERE case_id = $caseId]->role->can_execute_operation->operation_metadata
         WHERE tables CONTAINS 'claim_operation_log' AND operation_type = 'read'`
             : ""
         }`,
        { userId: context.userId, caseId: context.caseId },
      );

      const permissionsList = Array.isArray(permissions) ? permissions : [];
      const hasReadPermission = permissionsList.some((p) => p.can_execute);

      if (!hasReadPermission) {
        return {
          hasPermission: false,
          permissionLevel: PermissionLevel.NONE,
          reason: "No permission to access claim operation logs",
        };
      }

      // 检查是否可以查看他人的操作
      const canViewOthers = await this.canViewOtherUsersData(client, context);

      // 检查是否可以查看敏感数据
      const canViewSensitive = await this.canViewSensitiveData(client, context);

      return {
        hasPermission: true,
        permissionLevel: hasReadPermission
          ? PermissionLevel.READ
          : PermissionLevel.NONE,
        restrictions: {
          canViewSensitiveData: canViewSensitive,
          canViewOtherUsers: canViewOthers,
          canExportData: false, // 操作日志默认不允许导出
          maxRecordsAccess: canViewOthers ? 10000 : 1000, // 限制访问记录数
        },
      };
    } catch (error) {
      return {
        hasPermission: false,
        permissionLevel: PermissionLevel.NONE,
        reason: `Operation log permission check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * 检查版本历史权限
   */
  private async checkVersionHistoryPermission(
    client: SurrealWorkerAPI,
    context: PermissionContext,
  ): Promise<TrackingPermissionResult> {
    try {
      // 版本历史权限相对宽松，主要检查是否有债权读取权限
      const permissions = await queryWithAuth<Array<{ can_execute: boolean }>>(
        client,
        `SELECT can_execute FROM $userId->has_role->role->can_execute_operation->operation_metadata
         WHERE tables CONTAINS 'claim_version_history' AND operation_type = 'read'
         ${
           context.caseId
             ? `
         UNION
         SELECT can_execute FROM $userId->has_case_role[WHERE case_id = $caseId]->role->can_execute_operation->operation_metadata
         WHERE tables CONTAINS 'claim_version_history' AND operation_type = 'read'`
             : ""
         }`,
        { userId: context.userId, caseId: context.caseId },
      );

      const permissionsList = Array.isArray(permissions) ? permissions : [];
      const hasReadPermission = permissionsList.some((p) => p.can_execute);

      return {
        hasPermission: hasReadPermission,
        permissionLevel: hasReadPermission
          ? PermissionLevel.READ
          : PermissionLevel.NONE,
        restrictions: {
          canViewSensitiveData: false, // 版本历史不包含敏感数据
          canViewOtherUsers: true, // 版本历史可以查看
          canExportData: hasReadPermission,
          maxRecordsAccess: 5000,
        },
      };
    } catch (error) {
      return {
        hasPermission: false,
        permissionLevel: PermissionLevel.NONE,
        reason: `Version history permission check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * 检查状态流转权限
   */
  private async checkStatusFlowPermission(
    client: SurrealWorkerAPI,
    context: PermissionContext,
  ): Promise<TrackingPermissionResult> {
    try {
      const [permissions] = await queryWithAuth<
        Array<{ can_execute: boolean }>[]
      >(
        client,
        `SELECT can_execute FROM $userId->has_role->role->can_execute_operation->operation_metadata
         WHERE tables CONTAINS 'claim_status_flow' AND operation_type = 'read'
         ${
           context.caseId
             ? `
         UNION
         SELECT can_execute FROM $userId->has_case_role[WHERE case_id = $caseId]->role->can_execute_operation->operation_metadata
         WHERE tables CONTAINS 'claim_status_flow' AND operation_type = 'read'`
             : ""
         }`,
        { userId: context.userId, caseId: context.caseId },
      );

      const hasReadPermission =
        permissions && permissions.some((p) => p.can_execute);

      return {
        hasPermission: hasReadPermission,
        permissionLevel: hasReadPermission
          ? PermissionLevel.READ
          : PermissionLevel.NONE,
        restrictions: {
          canViewSensitiveData: false, // 状态流转不包含敏感数据
          canViewOtherUsers: true, // 状态流转可以查看
          canExportData: hasReadPermission,
          maxRecordsAccess: 3000,
        },
      };
    } catch (error) {
      return {
        hasPermission: false,
        permissionLevel: PermissionLevel.NONE,
        reason: `Status flow permission check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * 检查访问日志权限
   */
  private async checkAccessLogPermission(
    client: SurrealWorkerAPI,
    context: PermissionContext,
  ): Promise<TrackingPermissionResult> {
    try {
      // 访问日志权限较严格，通常只有管理员和审计人员可以查看
      const [auditPermissions] = await queryWithAuth<
        Array<{ role_name: string }>[]
      >(
        client,
        `SELECT out.name AS role_name FROM $userId->has_role
         WHERE out.name CONTAINS 'audit' OR out.name CONTAINS 'admin'
         ${
           context.caseId
             ? `
         UNION
         SELECT out.name AS role_name FROM $userId->has_case_role[WHERE case_id = $caseId]->role
         WHERE name CONTAINS 'audit' OR name CONTAINS 'admin'`
             : ""
         }`,
        { userId: context.userId, caseId: context.caseId },
      );

      const hasAuditRole = auditPermissions && auditPermissions.length > 0;

      if (!hasAuditRole) {
        return {
          hasPermission: false,
          permissionLevel: PermissionLevel.NONE,
          reason: "Access log viewing requires audit or admin role",
        };
      }

      return {
        hasPermission: true,
        permissionLevel: PermissionLevel.READ,
        restrictions: {
          canViewSensitiveData: true, // 审计人员可以查看敏感数据
          canViewOtherUsers: true,
          canExportData: true, // 审计数据可以导出
          maxRecordsAccess: 20000,
        },
      };
    } catch (error) {
      return {
        hasPermission: false,
        permissionLevel: PermissionLevel.NONE,
        reason: `Access log permission check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * 检查统计分析权限
   */
  private async checkStatisticsPermission(
    client: SurrealWorkerAPI,
    context: PermissionContext,
  ): Promise<TrackingPermissionResult> {
    try {
      // 统计分析权限检查案件角色或管理角色
      const [managerRoles] = await queryWithAuth<
        Array<{ role_name: string }>[]
      >(
        client,
        `SELECT out.name AS role_name FROM $userId->has_role
         WHERE out.name CONTAINS 'manager' OR out.name CONTAINS 'lead' OR out.name CONTAINS 'admin'
         ${
           context.caseId
             ? `
         UNION
         SELECT out.name AS role_name FROM $userId->has_case_role[WHERE case_id = $caseId]->role
         WHERE name CONTAINS 'manager' OR name CONTAINS 'lead' OR name CONTAINS 'admin'`
             : ""
         }`,
        { userId: context.userId, caseId: context.caseId },
      );

      const hasManagerRole = managerRoles && managerRoles.length > 0;

      return {
        hasPermission: hasManagerRole,
        permissionLevel: hasManagerRole
          ? PermissionLevel.READ
          : PermissionLevel.NONE,
        restrictions: {
          canViewSensitiveData: false, // 统计数据已脱敏
          canViewOtherUsers: true, // 统计数据可以查看
          canExportData: hasManagerRole,
          maxRecordsAccess: Number.MAX_SAFE_INTEGER, // 统计分析不限制记录数
        },
      };
    } catch (error) {
      return {
        hasPermission: false,
        permissionLevel: PermissionLevel.NONE,
        reason: `Statistics permission check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * 检查导出权限
   */
  private async checkExportPermission(
    client: SurrealWorkerAPI,
    context: PermissionContext,
  ): Promise<TrackingPermissionResult> {
    try {
      // 导出权限需要特殊的导出角色或管理员权限
      const [exportRoles] = await queryWithAuth<Array<{ role_name: string }>[]>(
        client,
        `SELECT out.name AS role_name FROM $userId->has_role
         WHERE out.name CONTAINS 'export' OR out.name CONTAINS 'admin' OR out.name CONTAINS 'manager'
         ${
           context.caseId
             ? `
         UNION
         SELECT out.name AS role_name FROM $userId->has_case_role[WHERE case_id = $caseId]->role
         WHERE name CONTAINS 'export' OR name CONTAINS 'admin' OR name CONTAINS 'manager'`
             : ""
         }`,
        { userId: context.userId, caseId: context.caseId },
      );

      const hasExportRole = exportRoles && exportRoles.length > 0;

      return {
        hasPermission: hasExportRole,
        permissionLevel: hasExportRole
          ? PermissionLevel.WRITE
          : PermissionLevel.NONE,
        reason: hasExportRole
          ? undefined
          : "Data export requires special export role",
        restrictions: {
          canViewSensitiveData: false, // 导出数据需要脱敏
          canViewOtherUsers: hasExportRole,
          canExportData: hasExportRole,
          maxRecordsAccess: hasExportRole ? 50000 : 0,
        },
      };
    } catch (error) {
      return {
        hasPermission: false,
        permissionLevel: PermissionLevel.NONE,
        reason: `Export permission check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * 检查是否可以查看他人数据
   */
  private async canViewOtherUsersData(
    client: SurrealWorkerAPI,
    context: PermissionContext,
  ): Promise<boolean> {
    try {
      // 检查是否有管理角色或审核角色
      const [managerRoles] = await queryWithAuth<
        Array<{ role_name: string }>[]
      >(
        client,
        `SELECT out.name AS role_name FROM $userId->has_role
         WHERE out.name CONTAINS 'manager' OR out.name CONTAINS 'reviewer' OR out.name CONTAINS 'admin'
         ${
           context.caseId
             ? `
         UNION
         SELECT out.name AS role_name FROM $userId->has_case_role[WHERE case_id = $caseId]->role
         WHERE name CONTAINS 'manager' OR name CONTAINS 'reviewer' OR name CONTAINS 'admin'`
             : ""
         }`,
        { userId: context.userId, caseId: context.caseId },
      );

      return managerRoles && managerRoles.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查是否可以查看敏感数据
   */
  private async canViewSensitiveData(
    client: SurrealWorkerAPI,
    context: PermissionContext,
  ): Promise<boolean> {
    try {
      // 检查是否有高级权限角色
      const [sensitiveRoles] = await queryWithAuth<
        Array<{ role_name: string }>[]
      >(
        client,
        `SELECT out.name AS role_name FROM $userId->has_role
         WHERE out.name CONTAINS 'admin' OR out.name CONTAINS 'audit'
         ${
           context.caseId
             ? `
         UNION
         SELECT out.name AS role_name FROM $userId->has_case_role[WHERE case_id = $caseId]->role
         WHERE name CONTAINS 'admin' OR name CONTAINS 'audit'`
             : ""
         }`,
        { userId: context.userId, caseId: context.caseId },
      );

      return sensitiveRoles && sensitiveRoles.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 批量检查权限
   */
  async checkMultiplePermissions(
    permissions: Array<{
      type: TrackingPermissionType;
      context: PermissionContext;
    }>,
  ): Promise<Record<string, TrackingPermissionResult>> {
    const results: Record<string, TrackingPermissionResult> = {};

    await Promise.all(
      permissions.map(async ({ type, context }) => {
        const key = `${type}_${context.userId}_${context.caseId || "global"}`;
        results[key] = await this.checkTrackingPermission(type, context);
      }),
    );

    return results;
  }

  /**
   * 清除权限缓存
   */
  clearPermissionCache(userId?: RecordId | string): void {
    if (userId) {
      // 清除特定用户的权限缓存
      for (const [key] of this.permissionCache.entries()) {
        if (key.includes(String(userId))) {
          this.permissionCache.delete(key);
        }
      }
    } else {
      // 清除所有权限缓存
      this.permissionCache.clear();
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    totalCached: number;
    expiredEntries: number;
    hitRate: number;
  } {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, value] of this.permissionCache.entries()) {
      if (value.expiry <= now) {
        expiredCount++;
        this.permissionCache.delete(key);
      }
    }

    return {
      totalCached: this.permissionCache.size,
      expiredEntries: expiredCount,
      hitRate: 0, // 简化实现，实际项目中可以记录命中率
    };
  }
}

export const claimTrackingPermissionService =
  new ClaimTrackingPermissionService();
