import { useState, useEffect } from 'react';
import { menuService } from '../services/menuService';

/**
 * Hook to check if the current user has permission for specific operations
 * @param operationIds Array of operation IDs to check
 * @returns Object with operation permissions and loading state
 */
export function useOperationPermissions(operationIds: string[]) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPermissions = async () => {
      setIsLoading(true);
      try {
        const result = await menuService.hasOperations(operationIds);
        setPermissions(result);
      } catch (error) {
        console.error('Error checking operation permissions:', error);
        // Set all permissions to false on error
        const fallbackPermissions: Record<string, boolean> = {};
        operationIds.forEach(id => {
          fallbackPermissions[id] = false;
        });
        setPermissions(fallbackPermissions);
      } finally {
        setIsLoading(false);
      }
    };

    if (operationIds.length > 0) {
      checkPermissions();
    } else {
      setPermissions({});
      setIsLoading(false);
    }
  }, [JSON.stringify(operationIds)]); // Use JSON.stringify to avoid re-running on every render

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