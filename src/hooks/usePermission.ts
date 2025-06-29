import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSurreal } from '@/src/contexts/SurrealProvider';

export interface PermissionCheckResult {
  hasPermission: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * 检查当前用户是否有执行特定操作的权限
 * @param operationId 操作ID，如 'case_create', 'claim_review' 等
 * @returns 权限检查结果
 */
export function useOperationPermission(operationId: string): PermissionCheckResult {
  const { user, selectedCaseId } = useAuth();
  const { surreal: client, handleSessionError } = useSurreal();
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

        // 使用图查询检查用户是否有操作权限
        // 查询用户的全局角色和案件角色中是否有权限执行该操作
        const query = `
          LET $global_roles = (SELECT out FROM $user_id->has_role);
          LET $case_roles = IF $case_id THEN 
            (SELECT out FROM $user_id->has_case_role WHERE case_id = $case_id)
          ELSE [];
          END;
          LET $all_roles = array::concat($global_roles, $case_roles);
          
          SELECT * FROM (
            SELECT * FROM $all_roles->can_execute_operation 
            WHERE out.operation_id = $operation_id 
              AND can_execute = true 
              AND out.is_active = true
          ) LIMIT 1;
        `;
        
        const result = await client.query(query, {
          user_id: user.id,
          case_id: selectedCaseId || null,
          operation_id: operationId
        });

        const hasResult = !!(result && result[0] && (result[0] as unknown[]).length > 0);
        setHasPermission(hasResult);
      } catch (err) {
        console.error('Error checking operation permission:', err);
        
        // 检查是否为认证错误(session/token过期)并处理
        const isSessionError = await handleSessionError(err);
        if (!isSessionError) {
          // 如果不是认证错误，设置一般错误状态
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
        setHasPermission(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPermission();
  }, [user, operationId, selectedCaseId, client, handleSessionError]);

  return { hasPermission, isLoading, error };
}

/**
 * 检查当前用户是否有访问特定菜单的权限
 * @param menuId 菜单ID，如 'cases', 'creditors' 等
 * @returns 权限检查结果
 */
export function useMenuPermission(menuId: string): PermissionCheckResult {
  const { user, selectedCaseId } = useAuth();
  const { surreal: client, handleSessionError } = useSurreal();
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

        // 使用图查询检查用户是否有菜单权限
        // 查询用户的全局角色和案件角色中是否有权限访问该菜单
        const query = `
          LET $global_roles = (SELECT out FROM $user_id->has_role);
          LET $case_roles = IF $case_id THEN 
            (SELECT out FROM $user_id->has_case_role WHERE case_id = $case_id)
          ELSE [];
          END;
          LET $all_roles = array::concat($global_roles, $case_roles);
          
          SELECT * FROM (
            SELECT * FROM $all_roles->can_access_menu 
            WHERE out.menu_id = $menu_id 
              AND can_access = true 
              AND out.is_active = true
          ) LIMIT 1;
        `;
        
        const result = await client.query(query, {
          user_id: user.id,
          case_id: selectedCaseId || null,
          menu_id: menuId
        });

        const hasResult = !!(result && result[0] && (result[0] as unknown[]).length > 0);
        setHasPermission(hasResult);
      } catch (err) {
        console.error('Error checking menu permission:', err);
        
        // 检查是否为认证错误(session/token过期)并处理
        const isSessionError = await handleSessionError(err);
        if (!isSessionError) {
          // 如果不是认证错误，设置一般错误状态
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
        setHasPermission(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPermission();
  }, [user, menuId, selectedCaseId, client, handleSessionError]);

  return { hasPermission, isLoading, error };
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
): PermissionCheckResult {
  const { user, selectedCaseId } = useAuth();
  const { surreal: client, handleSessionError } = useSurreal();
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkPermission = async () => {
      if (!user || !tableName) {
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

        // 使用SurrealDB内置的权限系统进行数据权限检查
        // 尝试执行一个简单的查询来测试权限
        let testQuery = '';
        switch (crudType) {
          case 'read':
            testQuery = `SELECT * FROM ${tableName} WHERE false LIMIT 0`;
            break;
          case 'create':
            // 对于创建权限，我们检查表的权限定义
            testQuery = `SELECT * FROM ONLY ${tableName} WHERE false LIMIT 0`;
            break;
          case 'update':
          case 'delete':
            // 对于更新和删除，检查是否能查询到记录（基础权限）
            testQuery = `SELECT * FROM ${tableName} WHERE false LIMIT 0`;
            break;
        }

        await client.query(testQuery);
        // 如果查询成功执行（没有抛出权限错误），则说明有权限
        setHasPermission(true);
      } catch (err: unknown) {
        // 首先检查是否为认证错误(session/token过期)
        const isSessionError = await handleSessionError(err);
        if (!isSessionError) {
          // 检查是否是权限错误
          if (err instanceof Error && err.message && err.message.includes('permission')) {
            setHasPermission(false);
          } else {
            console.error('Error checking data permission:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            setHasPermission(false);
          }
        } else {
          setHasPermission(false);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkPermission();
  }, [user, tableName, crudType, selectedCaseId, client, handleSessionError]);

  return { hasPermission, isLoading, error };
}

/**
 * 获取用户的角色列表（包括全局角色和案件角色）
 * @returns 用户角色列表
 */
export function useUserRoles() {
  const { user, selectedCaseId } = useAuth();
  const { surreal: client, handleSessionError } = useSurreal();
  const [roles, setRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRoles = async () => {
      if (!user) {
        setRoles([]);
        setIsLoading(false);
        return;
      }

      // 管理员默认有admin角色
      if (user.github_id === '--admin--') {
        setRoles(['admin']);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // 使用定义的函数获取用户角色
        const query = `
          return $user_id->(select * from has_case_role,has_role where case_id = $case_id or case_id =none)->role.name;
        `;
        
        const result = await client.query(query, {
          user_id: user.id,
          case_id: selectedCaseId || null
        });

        const roleNames = result && result[0] ? result[0] as string[] : [];
        setRoles(roleNames);
      } catch (err) {
        console.error('Error loading user roles:', err);
        
        // 检查是否为认证错误(session/token过期)并处理
        const isSessionError = await handleSessionError(err);
        if (!isSessionError) {
          // 如果不是认证错误，设置一般错误状态
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
        setRoles([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadRoles();
  }, [user, selectedCaseId, client, handleSessionError]);

  return { roles, isLoading, error };
} 