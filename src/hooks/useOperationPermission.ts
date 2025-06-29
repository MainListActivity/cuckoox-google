import { useState, useEffect, useCallback, useRef } from 'react';
import { menuService } from '../services/menuService';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to check if the current user has permission for specific operations
 * @param operationIds Array of operation IDs to check
 * @returns Object with operation permissions and loading state
 */
export function useOperationPermissions(operationIds: string[]) {
  const { user, selectedCaseId } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // 使用 ref 来跟踪上一次的 operationIds，避免无限重新渲染
  const prevOperationIdsRef = useRef<string>('');
  const currentOperationIdsStr = JSON.stringify(operationIds.sort());

  const checkPermissions = useCallback(async (ids: string[]) => {
    if (!user) {
      // No user, set all permissions to false
      const fallbackPermissions: Record<string, boolean> = {};
      ids.forEach(id => {
        fallbackPermissions[id] = false;
      });
      setPermissions(fallbackPermissions);
      setIsLoading(false);
      return;
    }

    // Admin has all permissions
    if (user.github_id === '--admin--') {
      const adminPermissions: Record<string, boolean> = {};
      ids.forEach(id => {
        adminPermissions[id] = true;
      });
      setPermissions(adminPermissions);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await menuService.hasOperations(
        user.id.toString(),
        ids,
        selectedCaseId?.toString() || null
      );
      setPermissions(result);
    } catch (error) {
      console.error('Error checking operation permissions:', error);
      // Set all permissions to false on error
      const fallbackPermissions: Record<string, boolean> = {};
      ids.forEach(id => {
        fallbackPermissions[id] = false;
      });
      setPermissions(fallbackPermissions);
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedCaseId]);

  useEffect(() => {
    // 只有当 operationIds 真的改变时才重新执行
    if (currentOperationIdsStr !== prevOperationIdsRef.current) {
      prevOperationIdsRef.current = currentOperationIdsStr;
      
      if (operationIds.length > 0) {
        checkPermissions(operationIds);
      } else {
        setPermissions({});
        setIsLoading(false);
      }
    }
  }, [currentOperationIdsStr, operationIds, checkPermissions]);

  return { permissions, isLoading };
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