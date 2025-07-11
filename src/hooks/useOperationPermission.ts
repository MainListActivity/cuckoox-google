import { useOperationPermissions as useOperationPermissionsFromPermission } from './usePermission';

/**
 * Hook to check if the current user has permission for specific operations
 * @param operationIds Array of operation IDs to check
 * @returns Object with operation permissions and loading state
 */
export function useOperationPermissions(operationIds: string[]) {
  // 使用新的权限检查逻辑
  return useOperationPermissionsFromPermission(operationIds);
}

/**
 * Hook to check if the current user has permission for a single operation
 * @param operationId Operation ID to check
 * @returns Object with hasPermission boolean and loading state
 */
export function useOperationPermission(operationId: string) {
  const { permissions, isLoading } = useOperationPermissions([operationId]);
  
  return {
    hasPermission: permissions[operationId] || false,
    isLoading
  };
}