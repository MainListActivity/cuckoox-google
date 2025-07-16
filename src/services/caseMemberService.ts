import { CaseMember, Role } from '@/src/types/caseMember';
import { RecordId } from 'surrealdb';
import { queryWithAuth } from '@/src/utils/surrealAuth';
import type { SurrealWorkerAPI } from '@/src/contexts/SurrealProvider';

// 案件信息接口
export interface CaseInfo {
  id: RecordId;
  case_lead_user_id?: RecordId;
  case_number?: string;
  name?: string;
  case_manager_name?: string;
  acceptance_date?: string;
  created_at?: string;
  updated_at?: string;
}

// 查询结果类型定义
interface MemberQueryResult {
  userId: RecordId;
  userName: string;
  userEmail?: string;
  roles: Role[];
}

interface UserQueryResult {
  id: RecordId;
  name: string;
  email?: string;
  username?: string;
}

interface HasMemberQueryResult {
  id: RecordId;
  in: RecordId;
  out: RecordId;
  assigned_at?: string;
}

interface RoleQueryResult {
  role_id: Role;
}


// 系统用户搜索接口
export interface SystemUser {
  id: string; // user recordId, e.g., "user:001"
  name: string;
  email?: string;
  avatarUrl?: string;
}

// 创建用户并添加到案件的接口
export interface CreateUserAndAddToCaseParams {
  username: string;
  password_hash: string;
  email: string;
  name: string;
  roleId: RecordId; // 直接使用角色RecordId，不再需要查询
}

// 获取案件基本信息
export async function fetchCaseInfo(client: SurrealWorkerAPI, caseId: RecordId): Promise<CaseInfo | null> {
    console.log(`[SurrealDB API] Fetching case info for: ${caseId}`);

    try {
      const query = `
        SELECT * FROM case 
        WHERE id = $caseId;
      `;

      const result = await queryWithAuth<CaseInfo[]>(client, query, { caseId });

      if (!result || result.length === 0) {
        return null;
      }

      return result[0] as CaseInfo;
    } catch (error) {
      console.error('[SurrealDB API] Error fetching case info:', error);
      throw error;
    }
}

// 基于SurrealDB的案件成员服务
export async function fetchCaseMembers(client: SurrealWorkerAPI, caseId: RecordId): Promise<CaseMember[]> {
    console.log(`[SurrealDB API] Fetching members for case: ${caseId}`);

    try {
      // 查询案件成员及其在案件中的角色
      const query = `
        SELECT 
          out as userId,
          out.name as userName,
          out.email as userEmail,
          (SELECT role_id FROM has_case_role WHERE in = out AND case_id = $caseId FETCH role_id) as roles
        FROM has_member 
        WHERE in = $caseId
        FETCH out;
      `;

      const result = await queryWithAuth<MemberQueryResult[]>(client, query, { caseId });

      if (!result || result.length === 0) {
        return [];
      }

      const members: CaseMember[] = result.map((row: MemberQueryResult) => ({
        id: row.userId,
        caseId: caseId,
        roles: row.roles || [],
        userName: row.userName,
        userEmail: row.userEmail,
        avatarUrl: row.userEmail ? `https://i.pravatar.cc/150?u=${row.userEmail}` : `https://i.pravatar.cc/150?u=${row.userId}`
      }));

      return members;
    } catch (error) {
      console.error('[SurrealDB API] Error fetching case members:', error);
      throw error;
    }
}

export async function addCaseMember(
  client: SurrealWorkerAPI,
  caseId: RecordId,
    userId: RecordId,
    userName: string,
    userEmail: string | undefined,
    avatarUrl: string | undefined,
    roleIds: RecordId[]
  ): Promise<CaseMember> {
    console.log(`[SurrealDB API] Adding user ${userId} (${userName}) to case ${caseId} with roles ${roleIds.map(r => r.toString()).join(', ')}`);

    try {
      // 首先检查用户是否已经是案件成员
      const existingQuery = `
      SELECT * FROM has_member 
      WHERE in = $caseId 
      AND out = $userId;
    `;

      const existingResult = await queryWithAuth<HasMemberQueryResult[]>(client, existingQuery, { userId, caseId });

      if (existingResult && existingResult.length > 0) {
        console.warn(`[SurrealDB API] User ${userId} already exists in case ${caseId}.`);
        // 查询现有用户的角色
        const roleQuery = `
        SELECT role_id FROM has_case_role 
        WHERE in = $userId AND case_id = $caseId 
        FETCH role_id;
      `;
        const roleResult = await queryWithAuth<RoleQueryResult[]>(client, roleQuery, { userId, caseId });
        const existingRoles = roleResult && roleResult.length > 0
          ? roleResult.map((r: RoleQueryResult) => r.role_id) : [];

        return {
          id: userId,
          caseId: caseId,
          roles: existingRoles,
          userName,
          userEmail,
          avatarUrl: avatarUrl || (userEmail ? `https://i.pravatar.cc/150?u=${userEmail}` : `https://i.pravatar.cc/150?u=${userId}`)
        };
      }

      // 创建案件成员关系
      const createMemberQuery = `
      RELATE $caseId->has_member->$userId SET
        assigned_at = time::now();
    `;

      const createMemberResult = await queryWithAuth<HasMemberQueryResult[]>(client, createMemberQuery, { userId, caseId });

      if (!createMemberResult || createMemberResult.length === 0) {
        throw new Error('Failed to create case member relationship');
      }

      // 为每个角色创建 has_case_role 关系，同时获取角色信息
      const roles: Role[] = [];
      for (const roleId of roleIds) {
        const createRoleQuery = `
        RELATE $userId->has_case_role->$roleId SET
          case_id = $caseId,
          assigned_at = time::now();
      `;

        await queryWithAuth(client, createRoleQuery, { userId, roleId, caseId });

        // 获取角色详细信息
        const roleInfoResult = await queryWithAuth<Role[]>(client, `SELECT * FROM ${roleId}`);
        const roleInfo = roleInfoResult && roleInfoResult.length > 0 ? roleInfoResult[0] : null;
        if (roleInfo) {
          roles.push(roleInfo);
        }
      }

      const newMember: CaseMember = {
        id: userId,
        caseId,
        roles,
        userName,
        userEmail,
        avatarUrl: avatarUrl || (userEmail ? `https://i.pravatar.cc/150?u=${userEmail}` : `https://i.pravatar.cc/150?u=${userId}`)
      };

      return newMember;
    } catch (error) {
      console.error('[SurrealDB API] Error adding case member:', error);
      throw error;
    }
}

export async function removeCaseMember(client: SurrealWorkerAPI, caseId: RecordId, userId: RecordId): Promise<void> {
    console.log(`[SurrealDB API] Removing user ${userId} from case ${caseId}`);

    try {
      // 检查要删除的用户是否是案件负责人
      const caseQuery = `
      SELECT case_lead_user_id FROM case 
      WHERE id = $caseId;
    `;

      const caseResult = await queryWithAuth<CaseInfo[]>(client, caseQuery, { caseId });
      const caseData = caseResult && caseResult.length > 0
        ? caseResult[0] : null;

      if (caseData && caseData.case_lead_user_id && caseData.case_lead_user_id.toString() === userId.toString()) {
        throw new Error('Cannot remove the case lead user. Please change the case lead first.');
      }

      // 删除用户在该案件中的所有角色关系
      const deleteRolesQuery = `
      DELETE has_case_role 
      WHERE in = $userId AND case_id = $caseId;
    `;

      await queryWithAuth(client, deleteRolesQuery, { userId, caseId });

      // 删除案件成员关系
      const deleteMemberQuery = `
      DELETE has_member 
      WHERE in = $caseId 
      AND out = $userId;
    `;

      await queryWithAuth(client, deleteMemberQuery, { userId, caseId });

    } catch (error) {
      console.error('[SurrealDB API] Error removing case member:', error);
      throw error;
    }
}

export async function createUserAndAddToCase(
  client: SurrealWorkerAPI,
  caseId: RecordId,
    params: CreateUserAndAddToCaseParams
  ): Promise<CaseMember> {
    console.log(`[SurrealDB API] Creating/finding user ${params.username} and adding to case ${caseId} with role ${params.roleId}`);

    try {
      let userId: RecordId;
      let userName: string;
      let userEmail: string;

      // 首先检查用户名和邮箱是否已存在
      const existingUserQuery = `
      SELECT id, name, email FROM user 
      WHERE username = $username OR email = $email
      LIMIT 1;
    `;

      const existingResult = await queryWithAuth<UserQueryResult[]>(client, existingUserQuery, {
        username: params.username,
        email: params.email
      });

      if (existingResult && existingResult.length > 0) {
        // 用户已存在，使用已存在的用户
        const existingUser = existingResult[0];
        userId = existingUser.id;
        userName = existingUser.name;
        userEmail = existingUser.email || params.email;

        console.log(`[SurrealDB API] User already exists: ${userId}, using existing user`);
      } else {
        // 用户不存在，创建新用户
        const createUserQuery = `
        CREATE user SET
          username = $username,
          password_hash = crypto::bcrypt::generate($password_hash),
          email = $email,
          name = $name,
          created_at = time::now(),
          updated_at = time::now(),
          is_active = true;
      `;

        const createUserResult = await queryWithAuth<UserQueryResult[]>(client, createUserQuery, {
          username: params.username,
          password_hash: params.password_hash,
          email: params.email,
          name: params.name
        });

        if (!createUserResult || !createUserResult.length) {
          throw new Error('Failed to create user');
        }

        const newUser = createUserResult[0];
        userId = newUser.id;
        userName = params.name;
        userEmail = params.email;

        console.log(`[SurrealDB API] Created new user: ${userId}`);
      }

      // 检查用户是否已经在案件中
      const existingMemberQuery = `
      SELECT * FROM has_member 
      WHERE in = $caseId 
      AND out = $userId;
    `;

      const existingMemberResult = await queryWithAuth<HasMemberQueryResult[]>(client, existingMemberQuery, {
        userId,
        caseId
      });

      if (existingMemberResult && existingMemberResult.length > 0) {
        throw new Error('用户已在当前案件中');
      }

      // 使用RELATE将用户添加到案件中
      const createMemberQuery = `
      RELATE $caseId->has_member->$userId SET
        role_id = $roleId,
        assigned_at = time::now();
    `;

      const createMemberResult = await queryWithAuth<HasMemberQueryResult[]>(client, createMemberQuery, {
        userId,
        caseId,
        roleId: params.roleId
      });

      if (!createMemberResult || createMemberResult.length === 0) {
        throw new Error('Failed to create case member relationship');
      }

      // 创建 has_case_role 关系
      const createRoleQuery = `
      RELATE $userId->has_case_role->$roleId SET
        case_id = $caseId,
        assigned_at = time::now();
    `;

      await queryWithAuth(client, createRoleQuery, { userId, roleId: params.roleId, caseId });

      // 获取角色信息用于返回
      const roleInfoResult = await queryWithAuth<Role[]>(client, `SELECT * FROM ${params.roleId}`);
      const roleInfo = roleInfoResult && roleInfoResult.length > 0 ? roleInfoResult[0] : null;
      const roles = roleInfo ? [roleInfo] : [];

      const caseMember: CaseMember = {
        id: userId,
        caseId,
        roles,
        userName,
        userEmail,
        avatarUrl: userEmail ? `https://i.pravatar.cc/150?u=${userEmail}` : `https://i.pravatar.cc/150?u=${userId}`
      };

      return caseMember;

    } catch (error) {
      console.error('[SurrealDB API] Error creating user and adding to case:', error);
      throw error;
    }
}

export async function searchSystemUsers(client: SurrealWorkerAPI, query: string): Promise<SystemUser[]> {
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

      const result = await queryWithAuth<UserQueryResult[]>(client, searchQuery, params);

      if (!result || result.length === 0) {
        return [];
      }

      const users: SystemUser[] = result.map((user: UserQueryResult) => ({
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
}

export async function changeCaseOwner(
  client: SurrealWorkerAPI,
  caseId: RecordId,
    newOwnerUserId: RecordId
  ): Promise<void> {
    console.log(`[SurrealDB API] Changing case lead for case ${caseId} to user: ${newOwnerUserId}`);

    try {
      // 验证新负责人是否是该案件的成员
      const memberQuery = `
      SELECT * FROM has_member 
      WHERE in = $caseId AND out = $newOwnerUserId;
    `;

      const memberResult = await queryWithAuth<HasMemberQueryResult[]>(client, memberQuery, { caseId, newOwnerUserId });

      if (!memberResult || memberResult.length === 0) {
        throw new Error('New case lead must be a member of the case.');
      }

      // 更新案件的 case_lead_user_id 字段
      const updateCaseQuery = `
      UPDATE case SET 
        case_lead_user_id = $newOwnerUserId,
        updated_at = time::now()
      WHERE id = $caseId;
    `;

      const result = await queryWithAuth<CaseInfo[]>(client, updateCaseQuery, {
        caseId,
        newOwnerUserId
      });

      if (!result || result.length === 0) {
        throw new Error('Failed to update case lead user.');
      }

      console.log(`[SurrealDB API] Successfully changed case lead for case ${caseId}`);

    } catch (error) {
      console.error('[SurrealDB API] Error changing case lead:', error);
      throw error;
    }
}

export async function changeMemberRole(
  client: SurrealWorkerAPI,
  caseId: RecordId,
    userId: RecordId,
    newRoleIds: RecordId[]
  ): Promise<CaseMember> {
    console.log(`[SurrealDB API] Changing roles for user ${userId} in case ${caseId} to ${newRoleIds.map(r => r.toString()).join(', ')}`);

    try {
      // 检查用户是否是案件成员
      const memberQuery = `
      SELECT * FROM has_member 
      WHERE in = $caseId AND out = $userId;
    `;

      const memberResult = await queryWithAuth<HasMemberQueryResult[]>(client, memberQuery, { userId, caseId });

      if (!memberResult || memberResult.length === 0) {
        throw new Error(`User ${userId} not found in case ${caseId}`);
      }

      // 删除用户在该案件中的所有现有角色
      const deleteRolesQuery = `
      DELETE has_case_role 
      WHERE in = $userId AND case_id = $caseId;
    `;

      await queryWithAuth(client, deleteRolesQuery, { userId, caseId });

      // 为每个新角色创建 has_case_role 关系，同时获取角色信息
      const roles: Role[] = [];
      for (const roleId of newRoleIds) {
        const createRoleQuery = `
        RELATE $userId->has_case_role->$roleId SET
          case_id = $caseId,
          assigned_at = time::now();
      `;

        await queryWithAuth(client, createRoleQuery, { userId, roleId, caseId });

        // 获取角色详细信息
        const roleInfoResult = await queryWithAuth<Role[]>(client, `SELECT * FROM ${roleId}`);
        const roleInfo = roleInfoResult && roleInfoResult.length > 0 ? roleInfoResult[0] : null;
        if (roleInfo) {
          roles.push(roleInfo);
        }
      }

      // 获取用户信息
      const userQuery = `SELECT id, name, email FROM user WHERE id = $userId;`;
      const userResult = await queryWithAuth<UserQueryResult[]>(client, userQuery, { userId });
      const user = userResult && userResult.length > 0
        ? userResult[0] : null;

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      return {
        id: user.id,
        caseId: caseId,
        roles,
        userName: user.name,
        userEmail: user.email,
        avatarUrl: user.email ? `https://i.pravatar.cc/150?u=${user.email}` : `https://i.pravatar.cc/150?u=${user.id}`
      };

    } catch (error) {
      console.error('[SurrealDB API] Error changing member role:', error);
      throw error;
    }
  }


// Backward compatibility: create a service object with methods that require client to be passed
export const caseMemberService = {
  fetchCaseInfo,
  fetchCaseMembers,
  addCaseMember,
  removeCaseMember,
  createUserAndAddToCase,
  searchSystemUsers,
  changeCaseOwner,
  changeMemberRole,
  // Legacy methods for compatibility - will be removed later
  setDataService: () => {
    console.warn('caseMemberService.setDataService is deprecated. Use direct function calls instead.');
  }
};

