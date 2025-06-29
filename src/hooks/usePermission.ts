import { useState, useEffect } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSurreal } from '@/src/contexts/SurrealProvider';

interface PermissionCheckResult {
  hasPermission: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * 检查当前用户是否有特定操作的权限
 * @param operationId 操作ID，如 'case_create', 'creditor_edit' 等
 * @returns 权限检查结果
 */
export function useOperationPermission(operationId: string): PermissionCheckResult {
  const { user, currentUserCaseRoles } = useAuth();
  const { surreal: client } = useSurreal();
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkPermission = async () => {
      if (!user || !operationId) {
        setHasPermission(false);
        setIsLoading(false);
        return;
      }

      // 管理员拥有所有权限
      if (user.github_id === '--admin--') {
        setHasPermission(true);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // 获取用户在当前案件中的角色
        const roleIds = currentUserCaseRoles.map(role => role.id);
        
        if (roleIds.length === 0) {
          // 检查用户的全局角色
          const globalRolesQuery = `
            SELECT role_id 
            FROM user_role 
            WHERE user_id = $userId
          `;
          const globalRolesResult = await client.query(globalRolesQuery, { userId: user.id });
          
          if (globalRolesResult && globalRolesResult[0]) {
            roleIds.push(...(globalRolesResult[0] as any[]).map((r: any) => r.role_id));
          }
        }

        if (roleIds.length === 0) {
          setHasPermission(false);
          setIsLoading(false);
          return;
        }

        // 检查这些角色是否有该操作的权限
        const permissionQuery = `
          SELECT * 
          FROM role_operation_permission 
          WHERE role_id IN $roleIds 
            AND operation_id = $operationId 
            AND can_execute = true
          LIMIT 1
        `;
        
        const result = await client.query(permissionQuery, {
          roleIds,
          operationId
        });

        const hasResult = !!(result && result[0] && (result[0] as any[]).length > 0);
        setHasPermission(hasResult);
      } catch (err) {
        console.error('Error checking operation permission:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setHasPermission(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPermission();
  }, [user, operationId, currentUserCaseRoles, client]);

  return { hasPermission, isLoading, error };
}

/**
 * 检查当前用户是否有访问特定菜单的权限
 * @param menuId 菜单ID，如 'cases', 'creditors' 等
 * @returns 权限检查结果
 */
export function useMenuPermission(menuId: string): PermissionCheckResult {
  const { user, currentUserCaseRoles } = useAuth();
  const { surreal: client } = useSurreal();
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkPermission = async () => {
      if (!user || !menuId) {
        setHasPermission(false);
        setIsLoading(false);
        return;
      }

      // 管理员拥有所有权限
      if (user.github_id === '--admin--') {
        setHasPermission(true);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // 获取用户在当前案件中的角色
        const roleIds = currentUserCaseRoles.map(role => role.id);
        
        if (roleIds.length === 0) {
          // 检查用户的全局角色
          const globalRolesQuery = `
            SELECT role_id 
            FROM user_role 
            WHERE user_id = $userId
          `;
          const globalRolesResult = await client.query(globalRolesQuery, { userId: user.id });
          
          if (globalRolesResult && globalRolesResult[0]) {
            roleIds.push(...(globalRolesResult[0] as any[]).map((r: any) => r.role_id));
          }
        }

        if (roleIds.length === 0) {
          setHasPermission(false);
          setIsLoading(false);
          return;
        }

        // 检查这些角色是否有该菜单的权限
        const permissionQuery = `
          SELECT * 
          FROM role_menu_permission 
          WHERE role_id IN $roleIds 
            AND menu_id = $menuId 
            AND can_access = true
          LIMIT 1
        `;
        
        const result = await client.query(permissionQuery, {
          roleIds,
          menuId
        });

        const hasResult = !!(result && result[0] && (result[0] as any[]).length > 0);
        setHasPermission(hasResult);
      } catch (err) {
        console.error('Error checking menu permission:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setHasPermission(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPermission();
  }, [user, menuId, currentUserCaseRoles, client]);

  return { hasPermission, isLoading, error };
}

/**
 * 检查当前用户对特定数据的访问权限
 * @param tableName 数据表名称
 * @param crudType CRUD类型：'create' | 'read' | 'update' | 'delete'
 * @param recordData 要检查的数据记录（可选，用于条件判断）
 * @returns 权限检查结果
 */
export function useDataPermission(
  tableName: string,
  crudType: 'create' | 'read' | 'update' | 'delete',
  recordData?: any
): PermissionCheckResult {
  const { user, currentUserCaseRoles } = useAuth();
  const { surreal: client } = useSurreal();
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkPermission = async () => {
      if (!user || !tableName || !crudType) {
        setHasPermission(false);
        setIsLoading(false);
        return;
      }

      // 管理员拥有所有权限
      if (user.github_id === '--admin--') {
        setHasPermission(true);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // 获取用户的所有角色（案件角色 + 全局角色）
        const roleIds = [...currentUserCaseRoles.map(role => role.id)];
        
        // 获取全局角色
        const globalRolesQuery = `
          SELECT role_id 
          FROM user_role 
          WHERE user_id = $userId
        `;
        const globalRolesResult = await client.query(globalRolesQuery, { userId: user.id });
        
        if (globalRolesResult && globalRolesResult[0]) {
          roleIds.push(...(globalRolesResult[0] as any[]).map((r: any) => r.role_id));
        }

        if (roleIds.length === 0) {
          setHasPermission(false);
          setIsLoading(false);
          return;
        }

        // 获取适用的数据权限规则
        const rulesQuery = `
          SELECT * 
          FROM data_permission_rule 
          WHERE role_id IN $roleIds 
            AND table_name = $tableName 
            AND crud_type = $crudType 
            AND is_active = true
          ORDER BY priority DESC
        `;
        
        const rulesResult = await client.query(rulesQuery, {
          roleIds,
          tableName,
          crudType
        });

        if (!rulesResult || !rulesResult[0] || (rulesResult[0] as any[]).length === 0) {
          setHasPermission(false);
          setIsLoading(false);
          return;
        }

        // 检查规则
        const rules = rulesResult[0] as any[];
        let hasValidRule = false;

        for (const rule of rules) {
          // 如果规则表达式是 'true'，直接允许
          if (rule.rule_expression === 'true') {
            hasValidRule = true;
            break;
          }

          // 如果有记录数据，尝试评估规则表达式
          if (recordData && rule.rule_expression) {
            // 这里需要一个更复杂的表达式评估器
            // 简单起见，我们只处理一些基本情况
            if (rule.rule_expression.includes('$auth.id')) {
              const expression = rule.rule_expression.replace('$auth.id', `"${user.id}"`);
              
              // 检查简单的相等条件
              if (expression.includes('created_by =')) {
                const createdBy = recordData.created_by?.toString() || recordData.created_by_user?.toString();
                if (createdBy === user.id.toString()) {
                  hasValidRule = true;
                  break;
                }
              }
            }
          }
        }

        setHasPermission(hasValidRule);
      } catch (err) {
        console.error('Error checking data permission:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setHasPermission(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPermission();
  }, [user, tableName, crudType, recordData, currentUserCaseRoles, client]);

  return { hasPermission, isLoading, error };
} 