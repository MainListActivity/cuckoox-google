import { CaseMember } from '@/src/types/caseMember';
import Surreal from 'surrealdb';

// 基于SurrealDB的案件成员服务
export const fetchCaseMembers = async (client: Surreal, caseId: string): Promise<CaseMember[]> => {
  console.log(`[SurrealDB API] Fetching members for case: ${caseId}`);
  
  try {
    // 查询案件成员，关联用户信息和角色信息
    const query = `
      SELECT 
        user_id.id as id,
        $parent.case_id as caseId,
        role_id.name as roleInCase,
        user_id.name as userName,
        user_id.email as userEmail,
        user_id.email as avatarUrl
      FROM user_case_role 
      WHERE case_id = type::record('case', $caseId)
      FETCH user_id, role_id;
    `;
    
    const result = await client.query<[{ result: any[] }]>(query, { caseId });
    
    if (!result || !result[0] || !result[0].result) {
      return [];
    }
    
    const members: CaseMember[] = result[0].result.map((row: any) => ({
      id: row.id.toString(),
      caseId: row.caseId.toString(),
      roleInCase: mapRoleToMemberRole(row.roleInCase),
      userName: row.userName,
      userEmail: row.userEmail,
      avatarUrl: row.userEmail ? `https://i.pravatar.cc/150?u=${row.userEmail}` : `https://i.pravatar.cc/150?u=${row.id}`
    }));
    
    return members;
  } catch (error) {
    console.error('[SurrealDB API] Error fetching case members:', error);
    throw error;
  }
};

export const addCaseMember = async (
  client: Surreal, 
  caseId: string, 
  userId: string, 
  userName: string, 
  userEmail: string | undefined, 
  avatarUrl: string | undefined, 
  role: 'owner' | 'member'
): Promise<CaseMember> => {
  console.log(`[SurrealDB API] Adding user ${userId} (${userName}) to case ${caseId} as ${role}`);
  
  try {
    // 首先检查用户是否已经是案件成员
    const existingQuery = `
      SELECT * FROM user_case_role 
      WHERE user_id = type::record('user', $userId) 
      AND case_id = type::record('case', $caseId);
    `;
    
    const existingResult = await client.query<[{ result: any[] }]>(existingQuery, { userId, caseId });
    
    if (existingResult && existingResult[0] && existingResult[0].result && existingResult[0].result.length > 0) {
      console.warn(`[SurrealDB API] User ${userId} already exists in case ${caseId}.`);
      // 返回现有成员信息
      const existing = existingResult[0].result[0];
      return {
        id: existing.user_id.toString(),
        caseId: existing.case_id.toString(),
        roleInCase: mapRoleToMemberRole(existing.role_id.name),
        userName,
        userEmail,
        avatarUrl: avatarUrl || (userEmail ? `https://i.pravatar.cc/150?u=${userEmail}` : `https://i.pravatar.cc/150?u=${userId}`)
      };
    }
    
    // 获取角色ID
    const roleId = await getRoleIdByName(client, mapMemberRoleToRole(role));
    
    // 创建新的用户案件角色关系
    const createQuery = `
      CREATE user_case_role SET
        user_id = type::record('user', $userId),
        case_id = type::record('case', $caseId),
        role_id = type::record('role', $roleId);
    `;
    
    const createResult = await client.query<[{ result: any[] }]>(createQuery, { userId, caseId, roleId });
    
    if (!createResult || !createResult[0] || !createResult[0].result || createResult[0].result.length === 0) {
      throw new Error('Failed to create case member relationship');
    }
    
    const newMember: CaseMember = {
      id: userId,
      caseId,
      roleInCase: role,
      userName,
      userEmail,
      avatarUrl: avatarUrl || (userEmail ? `https://i.pravatar.cc/150?u=${userEmail}` : `https://i.pravatar.cc/150?u=${userId}`)
    };
    
    return newMember;
  } catch (error) {
    console.error('[SurrealDB API] Error adding case member:', error);
    throw error;
  }
};

export const removeCaseMember = async (client: Surreal, caseId: string, userId: string): Promise<void> => {
  console.log(`[SurrealDB API] Removing user ${userId} from case ${caseId}`);
  
  try {
    // 检查是否是最后一个owner
    const ownersQuery = `
      SELECT * FROM user_case_role 
      WHERE case_id = type::record('case', $caseId) 
      AND role_id.name = 'case_manager'
      FETCH role_id;
    `;
    
    const ownersResult = await client.query<[{ result: any[] }]>(ownersQuery, { caseId });
    const owners = ownersResult && ownersResult[0] && ownersResult[0].result ? ownersResult[0].result : [];
    
    // 检查要删除的用户是否是owner
    const userRoleQuery = `
      SELECT * FROM user_case_role 
      WHERE user_id = type::record('user', $userId) 
      AND case_id = type::record('case', $caseId)
      FETCH role_id;
    `;
    
    const userRoleResult = await client.query<[{ result: any[] }]>(userRoleQuery, { userId, caseId });
    const userRole = userRoleResult && userRoleResult[0] && userRoleResult[0].result && userRoleResult[0].result.length > 0 
      ? userRoleResult[0].result[0] : null;
    
    if (userRole && userRole.role_id.name === 'case_manager' && owners.length === 1) {
      throw new Error('Cannot remove the last owner.');
    }
    
    // 删除用户案件角色关系
    const deleteQuery = `
      DELETE FROM user_case_role 
      WHERE user_id = type::record('user', $userId) 
      AND case_id = type::record('case', $caseId);
    `;
    
    await client.query(deleteQuery, { userId, caseId });
    
  } catch (error) {
    console.error('[SurrealDB API] Error removing case member:', error);
    throw error;
  }
};

// 系统用户搜索接口
export interface SystemUser {
  id: string; // user recordId, e.g., "user:001"
  name: string;
  email?: string;
  avatarUrl?: string;
}

export const searchSystemUsers = async (client: Surreal, query: string): Promise<SystemUser[]> => {
  console.log(`[SurrealDB API] Searching system users with query: ${query}`);
  
  try {
    let searchQuery: string;
    const params: Record<string, string> = {};
    
    if (!query.trim()) {
      // 返回所有用户（限制数量）
      searchQuery = `SELECT id, name, email FROM user LIMIT 20;`;
    } else {
      // 按名称或邮箱搜索
      searchQuery = `
        SELECT id, name, email FROM user 
        WHERE string::lowercase(name) CONTAINS string::lowercase($query) 
        OR string::lowercase(email) CONTAINS string::lowercase($query)
        LIMIT 20;
      `;
      params.query = query;
    }
    
    const result = await client.query<[{ result: any[] }]>(searchQuery, params);
    
    if (!result || !result[0] || !result[0].result) {
      return [];
    }
    
    const users: SystemUser[] = result[0].result.map((user: any) => ({
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      avatarUrl: user.email ? `https://i.pravatar.cc/150?u=${user.email}` : `https://i.pravatar.cc/150?u=${user.id}`
    }));
    
    return users;
  } catch (error) {
    console.error('[SurrealDB API] Error searching system users:', error);
    throw error;
  }
};

export const changeCaseOwner = async (
  client: Surreal, 
  caseId: string, 
  newOwnerUserId: string, 
  oldOwnerUserId: string
): Promise<void> => {
  console.log(`[SurrealDB API] Changing owner for case ${caseId}. New owner: ${newOwnerUserId}, Old owner: ${oldOwnerUserId}`);
  
  try {
    // 获取case_manager角色ID
    const caseManagerRoleId = await getRoleIdByName(client, 'case_manager');
    const memberRoleId = await getRoleIdByName(client, 'member');
    
    // 开始事务处理
    // 1. 将新owner设置为case_manager
    const updateNewOwnerQuery = `
      UPDATE user_case_role SET 
        role_id = type::record('role', $caseManagerRoleId)
      WHERE user_id = type::record('user', $newOwnerUserId) 
      AND case_id = type::record('case', $caseId);
    `;
    
    const newOwnerResult = await client.query<[{ result: any[] }]>(updateNewOwnerQuery, { 
      newOwnerUserId, 
      caseId, 
      caseManagerRoleId 
    });
    
    if (!newOwnerResult || !newOwnerResult[0] || !newOwnerResult[0].result || newOwnerResult[0].result.length === 0) {
      throw new Error('New potential owner not found in the case.');
    }
    
    // 2. 将旧owner降级为member（如果不是同一个人）
    if (oldOwnerUserId !== newOwnerUserId) {
      const updateOldOwnerQuery = `
        UPDATE user_case_role SET 
          role_id = type::record('role', $memberRoleId)
        WHERE user_id = type::record('user', $oldOwnerUserId) 
        AND case_id = type::record('case', $caseId);
      `;
      
      await client.query(updateOldOwnerQuery, { 
        oldOwnerUserId, 
        caseId, 
        memberRoleId 
      });
    }
    
  } catch (error) {
    console.error('[SurrealDB API] Error changing case owner:', error);
    throw error;
  }
};

export const changeMemberRole = async (
  client: Surreal, 
  caseId: string, 
  userId: string, 
  newRole: 'owner' | 'member'
): Promise<CaseMember> => {
  console.log(`[SurrealDB API] Changing role for user ${userId} in case ${caseId} to ${newRole}`);
  
  try {
    // 如果要降级为member，检查是否是最后一个owner
    if (newRole === 'member') {
      const ownersQuery = `
        SELECT * FROM user_case_role 
        WHERE case_id = type::record('case', $caseId) 
        AND role_id.name = 'case_manager'
        FETCH role_id;
      `;
      
      const ownersResult = await client.query<[{ result: any[] }]>(ownersQuery, { caseId });
      const owners = ownersResult && ownersResult[0] && ownersResult[0].result ? ownersResult[0].result : [];
      
      if (owners.length === 1 && owners[0].user_id.toString().includes(userId)) {
        throw new Error('Cannot change role of the last owner.');
      }
    }
    
    // 获取新角色ID
    const roleId = await getRoleIdByName(client, mapMemberRoleToRole(newRole));
    
    // 更新用户角色
    const updateQuery = `
      UPDATE user_case_role SET 
        role_id = type::record('role', $roleId)
      WHERE user_id = type::record('user', $userId) 
      AND case_id = type::record('case', $caseId)
      RETURN AFTER;
    `;
    
    const result = await client.query<[{ result: any[] }]>(updateQuery, { userId, caseId, roleId });
    
    if (!result || !result[0] || !result[0].result || result[0].result.length === 0) {
      throw new Error(`User ${userId} not found in case ${caseId}`);
    }
    
    const updatedRecord = result[0].result[0];
    
    // 获取用户信息
    const userQuery = `SELECT id, name, email FROM user WHERE id = type::record('user', $userId);`;
    const userResult = await client.query<[{ result: any[] }]>(userQuery, { userId });
    const user = userResult && userResult[0] && userResult[0].result && userResult[0].result.length > 0 
      ? userResult[0].result[0] : null;
    
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    
    return {
      id: user.id.toString(),
      caseId: updatedRecord.case_id.toString(),
      roleInCase: newRole,
      userName: user.name,
      userEmail: user.email,
      avatarUrl: user.email ? `https://i.pravatar.cc/150?u=${user.email}` : `https://i.pravatar.cc/150?u=${user.id}`
    };
    
  } catch (error) {
    console.error('[SurrealDB API] Error changing member role:', error);
    throw error;
  }
};

// 辅助函数：根据角色名称获取角色ID
async function getRoleIdByName(client: Surreal, roleName: string): Promise<string> {
  const query = `SELECT id FROM role WHERE name = $roleName LIMIT 1;`;
  const result = await client.query<[{ result: any[] }]>(query, { roleName });
  
  if (!result || !result[0] || !result[0].result || result[0].result.length === 0) {
    throw new Error(`Role '${roleName}' not found`);
  }
  
  return result[0].result[0].id.toString().split(':')[1]; // 提取ID部分
}

// 辅助函数：将数据库角色映射到成员角色
function mapRoleToMemberRole(dbRole: string): 'owner' | 'member' {
  switch (dbRole) {
    case 'case_manager':
      return 'owner';
    case 'member':
    default:
      return 'member';
  }
}

// 辅助函数：将成员角色映射到数据库角色
function mapMemberRoleToRole(memberRole: 'owner' | 'member'): string {
  switch (memberRole) {
    case 'owner':
      return 'case_manager';
    case 'member':
    default:
      return 'member';
  }
}
