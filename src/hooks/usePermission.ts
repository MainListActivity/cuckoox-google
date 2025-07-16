// 此文件已弃用，所有权限相关功能已移动到 AuthContext 中
// 为了保持向后兼容性，这里重新导出 AuthContext 中的权限方法

import { useAuth } from '../contexts/AuthContext';

/**
 * 检查当前用户是否有执行特定操作的权限
 * @param operationId 操作ID，如 'case_create', 'claim_review' 等
 * @returns 权限检查结果
 */
export function useOperationPermission(operationId: string) {
  const { useOperationPermission } = useAuth();
  return useOperationPermission(operationId);
}

/**
 * 检查当前用户是否有访问特定菜单的权限
 * @param menuId 菜单ID，如 'cases', 'creditors' 等
 * @returns 权限检查结果
 */
export function useMenuPermission(menuId: string) {
  const { useMenuPermission } = useAuth();
  return useMenuPermission(menuId);
}

/**
 * 检查当前用户对特定数据表的CRUD权限
 * @param tableName 数据表名称
 * @param crudType CRUD操作类型
 * @returns 权限检查结果
 */
export function useDataPermission(
  tableName: string,
  crudType: 'create' | 'read' | 'update' | 'delete'
) {
  const { useDataPermission } = useAuth();
  return useDataPermission(tableName, crudType);
}

/**
 * 获取用户的角色列表（包括全局角色和案件角色）
 * @returns 用户角色列表
 */
export function useUserRoles() {
  const { useUserRoles } = useAuth();
  return useUserRoles();
}

/**
 * 批量检查操作权限
 * @param operationIds 操作ID列表
 * @returns 操作权限映射
 */
export function useOperationPermissions(operationIds: string[]) {
  const { useOperationPermissions } = useAuth();
  return useOperationPermissions(operationIds);
}

/**
 * 清除用户权限缓存
 */
export function useClearPermissionCache() {
  const { useClearPermissionCache } = useAuth();
  return useClearPermissionCache();
}

/**
 * 同步权限数据到本地缓存
 */
export function useSyncPermissions() {
  const { useSyncPermissions } = useAuth();
  return useSyncPermissions();
}

// 重新导出权限检查结果接口
export type { PermissionCheckResult } from '../contexts/AuthContext';

