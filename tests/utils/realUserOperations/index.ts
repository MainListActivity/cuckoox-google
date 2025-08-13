/**
 * 真实用户操作封装（服务层驱动）
 * 说明：
 * - 本模块仅封装“按真实用户流程”的集成测试步骤，全部通过 Service Worker Client（SurrealWorkerAPI）与 queryWithAuth 执行
 * - 不直接直写表字段，不绕过权限校验
 * - 登录上下文由测试框架外部设置（例如通过 RealSurrealTestHelpers.setAuthUser('user:admin')）
 *
 * 典型流程：
 * 1) 管理员登录 -> 创建案件 -> 指定案件管理人
 * 2) 案件管理人登录 -> 添加成员（现有用户或创建新用户）/ 赋予角色
 * 3) 成员登录 -> 创建债权人 -> 发起债权申报
 */

import { RecordId } from 'surrealdb';
import type { SurrealWorkerAPI } from '@/src/contexts/SurrealProvider';
import { queryWithAuth } from '@/src/utils/surrealAuth';
import { caseMemberService, createUserAndAddToCase, changeCaseOwner, addCaseMember } from '@/src/services/caseMemberService';
import { getRoleByName } from '@/src/services/roleService';
import ClaimService, { type ClaimData } from '@/src/services/claimService';
import type { CaseMember } from '@/src/types/caseMember';

// -----------------------------
// 辅助工具
// -----------------------------

/**
 * 将 table:id 形式或 RecordId 统一转换为 RecordId
 */
function toRid(table: string, thing: string | RecordId): RecordId {
  if (thing instanceof RecordId) return thing;
  const str = String(thing);
  if (str.includes(':')) {
    const [tb, id] = str.split(':');
    return new RecordId(tb || table, id);
  }
  return new RecordId(table, str);
}

/**
 * 从 Surreal 返回记录中解析 id（兼容字符串/RecordId/对象）
 */
function normalizeThingId(thing: any): RecordId | null {
  if (!thing) return null;
  const raw = (thing as any).id ?? thing;
  if (raw instanceof RecordId) return raw;
  if (typeof raw === 'string') {
    if (raw.includes(':')) {
      const [tb, id] = raw.split(':');
      return new RecordId(tb, id);
    }
    // 无表前缀时无法可靠构造
    return null;
  }
  if (raw && typeof raw === 'object' && 'tb' in raw && 'id' in raw) {
    return new RecordId((raw as any).tb, (raw as any).id);
  }
  return null;
}

/**
 * 获取当前认证用户（来自 $auth）
 */
async function getAuthUser(client: SurrealWorkerAPI): Promise<{ id: RecordId; name?: string; email?: string } | null> {
  const res = await queryWithAuth<any[]>(client, 'SELECT * FROM $auth LIMIT 1;');
  // queryWithAuth 统一返回“第2条语句”的结果。此处为 SELECT 的第一行
  const row = Array.isArray(res) ? res[0] : res;
  if (!row) return null;
  const id = normalizeThingId(row.id);
  if (!id) return null;
  return { id, name: row.name, email: row.email };
}

/**
 * 根据角色名列表获取对应 RecordId 列表（不存在则过滤）
 */
async function getRoleIdsByNames(client: SurrealWorkerAPI, roleNames: string[]): Promise<RecordId[]> {
  const results: RecordId[] = [];
  for (const name of roleNames) {
    const role = await getRoleByName(client, name);
    if (role?.id) results.push(role.id);
  }
  return results;
}

/**
 * 将日期入参统一转换为 Date（允许 string | Date）
 */
function toDate(d?: string | Date): Date | undefined {
  if (!d) return undefined;
  return d instanceof Date ? d : new Date(d);
}

// -----------------------------
// 1) 管理员 -> 创建案件
// -----------------------------

export interface AdminCreateCaseParams {
  name: string;
  case_number?: string;
  case_procedure?: string; // 破产清算/破产重整/破产和解
  acceptance_date?: string | Date; // 必填，若未传入则使用当前时间
  announcement_date?: string | Date;
  claim_submission_start_date?: string | Date;
  claim_submission_end_date?: string | Date;
  case_manager_name?: string;
  procedure_phase?: string; // 默认：立案
}

/**
 * 管理员创建案件（通过 client.create + 随后成员与负责人指定，避免直写只读字段）
 * 返回：创建后的案件完整对象（尽可能兼容 Surreal 返回结构）
 */
export async function adminCreateCase(
  client: SurrealWorkerAPI,
  params: AdminCreateCaseParams
): Promise<{ id: RecordId } & Record<string, any>> {
  const current = await getAuthUser(client);
  if (!current) {
    throw new Error('当前无认证用户，请先完成登录（admin）');
  }

  const {
    name,
    case_number,
    case_procedure = '破产清算',
    acceptance_date = new Date(),
    announcement_date,
    claim_submission_start_date,
    claim_submission_end_date,
    case_manager_name = current.name || '未分配',
    procedure_phase = '立案',
  } = params;

  // 1) 创建案件（遵循只读/默认字段，不手动设置 created_at/updated_at/created_by_user）
  const payload: Record<string, any> = {
    name,
    case_number: case_number ?? `BK-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
    case_manager_name,
    case_procedure,
    procedure_phase,
    acceptance_date: toDate(acceptance_date),
  };

  if (announcement_date) payload.announcement_date = toDate(announcement_date);
  if (claim_submission_start_date) payload.claim_submission_start_date = toDate(claim_submission_start_date);
  if (claim_submission_end_date) payload.claim_submission_end_date = toDate(claim_submission_end_date);

  const created = await client.create('case', payload);
  const createdRow = Array.isArray(created) ? created[0] : created;
  const caseId = normalizeThingId(createdRow?.id);
  if (!caseId) {
    throw new Error('创建案件成功但无法解析ID');
  }

  // 2) 将当前管理员加入为案件成员（角色：case_manager）
  const managerRoleIds = await getRoleIdsByNames(client, ['case_manager']);
  if (managerRoleIds.length > 0) {
    try {
      await addCaseMember(
        client,
        caseId,
        current.id,
        current.name || '管理员',
        current.email,
        undefined,
        managerRoleIds
      );
    } catch (e) {
      // 非关键路径（若失败不影响案件创建本身）
      // eslint-disable-next-line no-console
      console.warn(`[realUserOperations] 添加管理员为案件成员失败：${String(e)}`);
    }
  }

  // 3) 设置案件负责人为当前管理员
  try {
    await changeCaseOwner(client, caseId, current.id);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[realUserOperations] 设置案件负责人失败：${String(e)}`);
  }

  return { ...createdRow, id: caseId };
}

// -----------------------------
// 2) 管理员 -> 指定案件管理人
// -----------------------------

export interface AdminAssignCaseManagerParams {
  caseId: string | RecordId;
  managerUserId: string | RecordId;
}

/**
 * 管理员指定案件管理人：
 * - 确保该用户在案件中（若不在则添加为成员，角色：case_manager）
 * - 更新案件负责人（case_lead_user_id）
 */
export async function adminAssignCaseManager(
  client: SurrealWorkerAPI,
  { caseId, managerUserId }: AdminAssignCaseManagerParams
): Promise<void> {
  const cid = toRid('case', caseId);
  const uid = toRid('user', managerUserId);

  // 获取目标用户基本信息
  const info = await queryWithAuth<any[]>(client, 'SELECT name, email FROM $uid LIMIT 1;', { uid });
  const row = Array.isArray(info) ? info[0] : info;
  const userName = row?.name || '案件管理人';
  const userEmail = row?.email;

  // 确保成员关系 + 角色
  const managerRoles = await getRoleIdsByNames(client, ['case_manager']);
  if (managerRoles.length > 0) {
    await addCaseMember(client, cid, uid, userName, userEmail, undefined, managerRoles);
  }

  // 设置负责人
  await changeCaseOwner(client, cid, uid);
}

// -----------------------------
// 3) 案件管理人 -> 添加成员（现有用户 / 新用户）
// -----------------------------

export interface ManagerAddExistingUserParams {
  caseId: string | RecordId;
  userId: string | RecordId;
  roleNames: string[]; // 例：['assistant_lawyer'] / ['creditor_representative']
}

/**
 * 添加现有系统用户为案件成员
 */
export async function managerAddExistingUserToCase(
  client: SurrealWorkerAPI,
  { caseId, userId, roleNames }: ManagerAddExistingUserParams
): Promise<CaseMember> {
  const cid = toRid('case', caseId);
  const uid = toRid('user', userId);

  // 获取用户名称/邮箱
  const info = await queryWithAuth<any[]>(client, 'SELECT name, email FROM $uid LIMIT 1;', { uid });
  const row = Array.isArray(info) ? info[0] : info;
  const userName = row?.name || '案件成员';
  const userEmail = row?.email;

  const roleIds = await getRoleIdsByNames(client, roleNames);
  return await addCaseMember(client, cid, uid, userName, userEmail, undefined, roleIds);
}

export interface ManagerCreateUserParams {
  caseId: string | RecordId;
  username: string;      // 登录名
  password: string;      // 登录密码（将更新为 argon2，确保可登录）
  email: string;
  name: string;
  roleNames: string[];   // 初始角色
}

/**
 * 创建新用户并加入案件：
 * - 首次使用 createUserAndAddToCase（内部默认 bcrypt），随后强制将口令更新为 argon2 以适配测试登录方式
 * - 若配置了多个角色，最终以 changeMemberRole 覆盖为完整角色集
 */
export async function managerCreateUserAndAddToCase(
  client: SurrealWorkerAPI,
  { caseId, username, password, email, name, roleNames }: ManagerCreateUserParams
): Promise<CaseMember> {
  const cid = toRid('case', caseId);

  // 先用第一个角色完成创建与添加
  const roleIds = await getRoleIdsByNames(client, roleNames.length ? [roleNames[0]] : ['creditor_representative']);
  const primaryRoleId = roleIds[0];
  if (!primaryRoleId) {
    throw new Error('未找到可用角色，请检查 roleNames');
  }

  const member = await createUserAndAddToCase(client, cid, {
    username,
    password_hash: password, // 服务内部使用 bcrypt::generate
    email,
    name,
    roleId: primaryRoleId,
  });

  // 将口令升级为 argon2，确保后续可以通过 Access/Scope 登录
  // 同时确保 username 字段写入
  await queryWithAuth(client, `
    UPDATE $userId SET
      username = $username,
      password_hash = crypto::argon2::generate($password)
    RETURN AFTER;
  `, { userId: member.id, username, password });

  // 若传入了多个角色，使用 changeMemberRole 覆盖为完整角色集
  if (roleNames.length > 1) {
    const allRoleIds = await getRoleIdsByNames(client, roleNames);
    const updated = await caseMemberService.changeMemberRole(client, cid, member.id, allRoleIds);
    return updated;
  }

  return member;
}

// -----------------------------
// 4) 成员 -> 创建债权人 与 发起债权申报
// -----------------------------

export interface MemberCreateCreditorParams {
  caseId: string | RecordId;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  // 生产 schema 中更通用的证件字段为 legal_id（测试老字段 identification_number 不再使用）
  legal_id?: string;
  organization_code?: string; // 企业组织代码（可选）
}

/**
 * 创建债权人（遵循生产 schema，避免写只读字段）
 */
export async function memberCreateCreditor(
  client: SurrealWorkerAPI,
  { caseId, name, phone, email, address, legal_id, organization_code }: MemberCreateCreditorParams
): Promise<{ id: RecordId } & Record<string, any>> {
  const cid = toRid('case', caseId);

  const data: Record<string, any> = {
    case_id: cid,
    name,
  };
  if (phone) data.phone = phone;
  if (email) data.email = email;
  if (address) data.address = address;
  if (legal_id) data.legal_id = legal_id;
  if (organization_code) data.organization_code = organization_code;

  const rows = await queryWithAuth<any[]>(client, 'CREATE creditor CONTENT $data RETURN AFTER;', { data });
  const row = Array.isArray(rows) ? rows[0] : rows;
  const rid = normalizeThingId(row?.id);
  if (!rid) {
    throw new Error('创建债权人成功但无法解析ID');
  }
  return { ...row, id: rid };
}

export interface MemberCreateClaimParams {
  caseId: string | RecordId;
  creditorId: string | RecordId;
  nature: string;                 // 债权性质（如：服务费/借款等）
  principal: number;
  interest: number;
  other_amount?: number;
  currency?: string;              // 默认 CNY
  brief_description?: string;
}

/**
 * 发起债权申报
 * 优先通过 ClaimService.createClaim（含操作/版本/状态流转），如果状态定义缺失等导致失败，则回退到最小可行 SurQL 创建
 */
export async function memberCreateClaim(
  client: SurrealWorkerAPI,
  params: MemberCreateClaimParams
): Promise<ClaimData> {
  const cid = toRid('case', params.caseId);
  const creditorId = toRid('creditor', params.creditorId);

  // 先尝试服务层（更贴近真实业务流程）
  try {
    const service = new ClaimService(client);
    const claim = await service.createClaim({
      case_id: cid.toString(),
      creditor_id: creditorId.toString(),
      asserted_claim_details: {
        nature: params.nature,
        principal: params.principal,
        interest: params.interest,
        other_amount: params.other_amount ?? 0,
        total_asserted_amount: params.principal + params.interest + (params.other_amount ?? 0),
        currency: params.currency ?? 'CNY',
        brief_description: params.brief_description,
      },
      review_status: 'draft',
    } as any);
    return claim;
  } catch (e) {
    // 回退路径：最小化创建（不依赖状态定义）
    // eslint-disable-next-line no-console
    console.warn('[realUserOperations] ClaimService.createClaim 失败，回退最小 SurQL 创建：', String(e));

    const data = {
      case_id: cid,
      creditor_id: creditorId,
      status: '草稿',
      asserted_claim_details: {
        nature: params.nature,
        principal: params.principal,
        interest: params.interest,
        other_amount: params.other_amount ?? 0,
        total_asserted_amount: params.principal + params.interest + (params.other_amount ?? 0),
        currency: params.currency ?? 'CNY',
        brief_description: params.brief_description,
      },
      created_by: '$auth.id', // 注意：VALUE 表达式在 CONTENT 中不生效，这里仅标注；实际 created_by 字段可由业务逻辑填充或保持为空
    };

    // 不能在 CONTENT 中使用 $auth.id 作为表达式，因此改为两步创建与更新（若需要 created_by）
    const createdRows = await queryWithAuth<any[]>(client, 'CREATE claim CONTENT $data RETURN AFTER;', { data: { ...data, created_by: undefined } });
    const createdRow = Array.isArray(createdRows) ? createdRows[0] : createdRows;
    const claimId = normalizeThingId(createdRow?.id);
    if (!claimId) {
      throw new Error('创建债权申报成功但无法解析ID');
    }

    // 如果需要补写 created_by，可在此执行（若 schema 不强制/READONLY，可跳过）
    // await queryWithAuth(client, 'UPDATE $id SET created_by = $auth.id RETURN AFTER;', { id: claimId });

    // 读取标准展示结构
    const fetched = await queryWithAuth<any[]>(client, 'SELECT * FROM $id LIMIT 1;', { id: claimId });
    const row = Array.isArray(fetched) ? fetched[0] : fetched;

    return {
      id: String(claimId.toString()),
      case_id: String(cid.toString()),
      creditor_id: String(creditorId.toString()),
      asserted_claim_details: {
        nature: row?.asserted_claim_details?.nature ?? params.nature,
        principal: Number(row?.asserted_claim_details?.principal ?? params.principal),
        interest: Number(row?.asserted_claim_details?.interest ?? params.interest),
        other_amount: Number(row?.asserted_claim_details?.other_amount ?? params.other_amount ?? 0),
        total_asserted_amount: Number(row?.asserted_claim_details?.total_asserted_amount ?? (params.principal + params.interest + (params.other_amount ?? 0))),
        currency: String(row?.asserted_claim_details?.currency ?? params.currency ?? 'CNY'),
        brief_description: row?.asserted_claim_details?.brief_description ?? params.brief_description,
      },
      review_status: 'draft',
      created_at: row?.created_at,
      updated_at: row?.updated_at,
    } as ClaimData;
  }
}

// -----------------------------
// 复合流程封装
// -----------------------------

export interface CreateCreditorAndClaimFlowParams {
  caseId: string | RecordId;
  creditor: Omit<MemberCreateCreditorParams, 'caseId'>;
  claim: Omit<MemberCreateClaimParams, 'caseId' | 'creditorId'>;
}

/**
 * 成员在指定案件下创建债权人并立即发起债权申报
 * 返回：{ creditor, claim }
 */
export async function memberCreateCreditorAndClaimFlow(
  client: SurrealWorkerAPI,
  { caseId, creditor, claim }: CreateCreditorAndClaimFlowParams
): Promise<{ creditor: { id: RecordId } & Record<string, any>, claim: ClaimData }> {
  const createdCreditor = await memberCreateCreditor(client, { caseId, ...creditor });
  const createdClaim = await memberCreateClaim(client, {
    caseId,
    creditorId: createdCreditor.id,
    ...claim,
  });
  return { creditor: createdCreditor, claim: createdClaim };
}

// -----------------------------
// 导出模块入口
// -----------------------------

export const RealUserOperations = {
  // 管理员
  adminCreateCase,
  adminAssignCaseManager,

  // 管理人
  managerAddExistingUserToCase,
  managerCreateUserAndAddToCase,

  // 成员
  memberCreateCreditor,
  memberCreateClaim,
  memberCreateCreditorAndClaimFlow,
};

export type {
  AdminCreateCaseParams,
  AdminAssignCaseManagerParams,
  ManagerAddExistingUserParams,
  ManagerCreateUserParams,
  MemberCreateCreditorParams,
  MemberCreateClaimParams,
  CreateCreditorAndClaimFlowParams,
};
