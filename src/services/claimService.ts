import { QuillDelta } from '@/src/components/RichTextEditor';
import { queryWithAuth } from '@/src/utils/surrealAuth';
import type { RecordId } from 'surrealdb';

// 数据库原始数据接口
export interface RawClaimData {
  id: RecordId | string;
  claim_number: string;
  case_id: RecordId | string;
  creditor_id: RecordId | string;
  status: string;
  submission_time?: string;
  review_status_id?: RecordId | string;
  review_time?: string;
  reviewer_id?: RecordId | string;
  review_comments?: string;
  created_at: string;
  updated_at: string;
  created_by: RecordId | string;
  // 主张债权详情
  asserted_claim_details: {
    nature: string;
    principal: number;
    interest: number;
    other_amount?: number;
    total_asserted_amount: number;
    currency: string;
    brief_description?: string;
    attachment_doc_id?: RecordId | string;
  };
  // 认定债权详情
  approved_claim_details?: {
    nature: string;
    principal: number;
    interest: number;
    other_amount?: number;
    total_approved_amount: number;
    currency: string;
    approved_attachment_doc_id?: RecordId | string;
  };
}

// 前端展示用的债权数据接口
export interface ClaimData {
  id?: string;
  case_id: string;
  creditor_id: string;
  claim_number?: string;
  asserted_claim_details: {
    nature: string;
    principal: number;
    interest: number;
    other_amount: number;
    total_asserted_amount: number;
    currency: string;
    brief_description?: string;
    attachment_doc_id?: string;
    attachment_content?: QuillDelta;
  };
  approved_claim_details?: {
    nature: string;
    principal: number;
    interest: number;
    other_amount: number;
    total_approved_amount: number;
  };
  review_status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'requires_supplement';
  review_opinion?: string;
  auditor?: string;
  audit_time?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface CaseData {
    id: string;
    name: string;
    case_number: string;
}

export interface ClaimAttachmentData {
  claim_id: string;
  content: QuillDelta;
  last_saved_at: string;
}

 
class ClaimService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(surrealClient: any) {
    this.client = surrealClient;
  }

  /**
   * 将数据库原始数据转换为前端展示格式
   */
  private transformRawClaimData(rawClaim: RawClaimData): ClaimData {
    return {
      id: String(rawClaim.id),
      case_id: String(rawClaim.case_id),
      creditor_id: String(rawClaim.creditor_id),
      claim_number: rawClaim.claim_number,
      asserted_claim_details: {
        nature: rawClaim.asserted_claim_details.nature,
        principal: rawClaim.asserted_claim_details.principal,
        interest: rawClaim.asserted_claim_details.interest,
        other_amount: rawClaim.asserted_claim_details.other_amount || 0,
        total_asserted_amount: rawClaim.asserted_claim_details.total_asserted_amount,
        currency: rawClaim.asserted_claim_details.currency,
        brief_description: rawClaim.asserted_claim_details.brief_description,
        attachment_doc_id: rawClaim.asserted_claim_details.attachment_doc_id ? String(rawClaim.asserted_claim_details.attachment_doc_id) : undefined,
      },
      approved_claim_details: rawClaim.approved_claim_details ? {
        nature: rawClaim.approved_claim_details.nature,
        principal: rawClaim.approved_claim_details.principal,
        interest: rawClaim.approved_claim_details.interest,
        other_amount: rawClaim.approved_claim_details.other_amount || 0,
        total_approved_amount: rawClaim.approved_claim_details.total_approved_amount,
      } : undefined,
      review_status: this.mapReviewStatus(rawClaim.status),
      review_opinion: rawClaim.review_comments,
      created_at: rawClaim.created_at,
      updated_at: rawClaim.updated_at,
      created_by: String(rawClaim.created_by),
    };
  }

  /**
   * 映射数据库状态到前端状态
   */
  private mapReviewStatus(dbStatus: string): ClaimData['review_status'] {
    const statusMap: Record<string, ClaimData['review_status']> = {
      '草稿': 'draft',
      '待提交': 'draft',
      '已提交': 'submitted',
      '待审核': 'under_review',
      '审核中': 'under_review',
      '审核通过': 'approved',
      '已驳回': 'rejected',
      '需要补充': 'requires_supplement',
      '部分通过': 'approved',
    };
    return statusMap[dbStatus] || 'draft';
  }

  /**
   * 获取债权基本信息
   */
  async getClaimById(claimId: string): Promise<ClaimData | null> {
    try {
      const query = `
        SELECT 
          id,
          claim_number,
          case_id,
          creditor_id,
          status,
          submission_time,
          review_status_id,
          review_time,
          reviewer_id,
          review_comments,
          created_at,
          updated_at,
          created_by,
          asserted_claim_details,
          approved_claim_details
        FROM claim 
        WHERE id = $claimId
      `;
      
      const results = await queryWithAuth(this.client, query, { claimId });
      const rawClaim = results[0]?.[0] as RawClaimData;
      
      return rawClaim ? this.transformRawClaimData(rawClaim) : null;
    } catch (error) {
      console.error('获取债权信息失败:', error);
      throw new Error('获取债权信息失败');
    }
  }

  /**
   * 获取债权人的所有债权
   */
  async getClaimsByCreditor(creditorId: string, caseId?: string): Promise<ClaimData[]> {
    try {
      let whereClause = 'creditor_id = $creditorId';
      const params: Record<string, any> = { creditorId };
      
      if (caseId) {
        whereClause += ' AND case_id = $caseId';
        params.caseId = caseId;
      }
      
      const query = `
        SELECT 
          id,
          claim_number,
          case_id,
          creditor_id,
          status,
          submission_time,
          review_status_id,
          review_time,
          reviewer_id,
          review_comments,
          created_at,
          updated_at,
          created_by,
          asserted_claim_details,
          approved_claim_details
        FROM claim 
        WHERE ${whereClause}
        ORDER BY created_at DESC
      `;
      
      const results = await queryWithAuth(this.client, query, params);
      const rawClaims = results[0] as RawClaimData[] || [];
      
      return rawClaims.map(rawClaim => this.transformRawClaimData(rawClaim));
    } catch (error) {
      console.error('获取债权列表失败:', error);
      throw new Error('获取债权列表失败');
    }
  }

  /**
   * 获取债权人可以申报的案件列表
   */
  async getCreditorCases(creditorId: string): Promise<CaseData[]> {
    try {
      const query = `
        SELECT 
          case_id.id AS id,
          case_id.name AS name,
          case_id.case_number AS case_number
        FROM creditor 
        WHERE id = $creditorId
      `;
      
      const results = await queryWithAuth(this.client, query, { creditorId });
      const creditorData = results[0]?.[0];
      
      if (!creditorData) {
        return [];
      }
      
      // 获取该债权人关联的案件
      const caseQuery = `
        SELECT id, name, case_number
        FROM case
        WHERE id = $caseId
      `;
      
      const caseResults = await queryWithAuth(this.client, caseQuery, { caseId: creditorData.id });
      return caseResults[0] || [];
    } catch (error) {
      console.error('获取案件列表失败:', error);
      throw new Error('获取案件列表失败');
    }
  }

  /**
   * 创建新的债权申报
   */
  async createClaim(claimData: Omit<ClaimData, 'id' | 'created_at' | 'updated_at'>): Promise<ClaimData> {
    try {
      // 生成债权编号
      const claimNumber = await this.generateClaimNumber(claimData.case_id);
      
      // 获取待提交状态ID
      const statusQuery = `
        SELECT id FROM claim_review_status_definition 
        WHERE name = '待提交' AND is_active = true
        LIMIT 1
      `;
      
      const statusResults = await queryWithAuth(this.client, statusQuery, {});
      const draftStatus = statusResults[0]?.[0];
      
      const createQuery = `
        CREATE claim SET
          claim_number = $claimNumber,
          case_id = $caseId,
          creditor_id = $creditorId,
          status = '草稿',
          review_status_id = $reviewStatusId,
          asserted_claim_details = $assertedClaimDetails,
          submission_time = time::now(),
          created_at = time::now(),
          updated_at = time::now(),
          created_by = $auth.id
      `;
      
      const params = {
        claimNumber,
        caseId: claimData.case_id,
        creditorId: claimData.creditor_id,
        reviewStatusId: draftStatus?.id,
        assertedClaimDetails: claimData.asserted_claim_details,
      };
      
      const results = await queryWithAuth(this.client, createQuery, params);
      const rawClaim = results[0]?.[0] as RawClaimData;
      
      return this.transformRawClaimData(rawClaim);
    } catch (error) {
      console.error('创建债权申报失败:', error);
      throw new Error('创建债权申报失败');
    }
  }

  /**
   * 更新债权基本信息
   */
  async updateClaimBasicInfo(
    claimId: string, 
    basicInfo: Partial<ClaimData['asserted_claim_details']>
  ): Promise<ClaimData> {
    try {
      const updateQuery = `
        UPDATE $claimId SET
          asserted_claim_details = $assertedClaimDetails,
          updated_at = time::now()
      `;
      
      const results = await queryWithAuth(this.client, updateQuery, {
        claimId,
        assertedClaimDetails: basicInfo,
      });
      
      const rawClaim = results[0]?.[0] as RawClaimData;
      return this.transformRawClaimData(rawClaim);
    } catch (error) {
      console.error('更新债权基本信息失败:', error);
      throw new Error('更新债权基本信息失败');
    }
  }

  /**
   * 保存附件材料草稿
   */
  async saveAttachmentDraft(claimId: string, content: QuillDelta): Promise<void> {
    try {
      const updateData = {
        'asserted_claim_details.attachment_content': content,
        updated_at: new Date().toISOString(),
      };

      await this.db.merge(claimId, updateData);
    } catch (error) {
      console.error('保存附件草稿失败:', error);
      throw new Error('保存附件草稿失败');
    }
  }

  /**
   * 提交债权申报
   */
  async submitClaim(claimId: string, attachmentContent?: QuillDelta): Promise<ClaimData> {
    try {
      // 验证必要字段
      const claim = await this.getClaimById(claimId);
      if (!claim) {
        throw new Error('债权不存在');
      }

      if (!claim.asserted_claim_details.nature || !claim.asserted_claim_details.principal) {
        throw new Error('请完善债权基本信息');
      }

      // 获取已提交状态ID
      const statusQuery = `
        SELECT id FROM claim_review_status_definition 
        WHERE name = '待审核' AND is_active = true
        LIMIT 1
      `;
      
      const statusResults = await queryWithAuth(this.client, statusQuery, {});
      const submittedStatus = statusResults[0]?.[0];
      
      const updateQuery = `
        UPDATE $claimId SET
          status = '已提交',
          review_status_id = $reviewStatusId,
          submission_time = time::now(),
          updated_at = time::now()
      `;
      
      const results = await queryWithAuth(this.client, updateQuery, {
        claimId,
        reviewStatusId: submittedStatus?.id,
      });
      
      const rawClaim = results[0]?.[0] as RawClaimData;
      return this.transformRawClaimData(rawClaim);
    } catch (error) {
      console.error('提交债权申报失败:', error);
      throw error;
    }
  }

  /**
   * 撤回债权申报
   */
  async withdrawClaim(claimId: string): Promise<ClaimData> {
    try {
      const claim = await this.getClaimById(claimId);
      if (!claim) {
        throw new Error('债权不存在');
      }

      if (claim.review_status !== 'submitted' && claim.review_status !== 'under_review') {
        throw new Error('只有已提交或审核中的债权才能撤回');
      }

      // 获取草稿状态ID
      const statusQuery = `
        SELECT id FROM claim_review_status_definition 
        WHERE name = '待提交' AND is_active = true
        LIMIT 1
      `;
      
      const statusResults = await queryWithAuth(this.client, statusQuery, {});
      const draftStatus = statusResults[0]?.[0];
      
      const updateQuery = `
        UPDATE $claimId SET
          status = '草稿',
          review_status_id = $reviewStatusId,
          updated_at = time::now()
      `;
      
      const results = await queryWithAuth(this.client, updateQuery, {
        claimId,
        reviewStatusId: draftStatus?.id,
      });
      
      const rawClaim = results[0]?.[0] as RawClaimData;
      return this.transformRawClaimData(rawClaim);
    } catch (error) {
      console.error('撤回债权申报失败:', error);
      throw error;
    }
  }

  /**
   * 生成债权编号
   */
  private async generateClaimNumber(caseId: string): Promise<string> {
    try {
      // 获取案件中已有的债权数量
      const countQuery = `
        SELECT count() AS total 
        FROM claim 
        WHERE case_id = $caseId
        GROUP ALL
      `;
      
      const results = await queryWithAuth(this.client, countQuery, { caseId });
      const count = results[0]?.[0]?.total || 0;
      
      const sequence = String(count + 1).padStart(3, '0');
      const year = new Date().getFullYear();
      
      return `CL-${year}-${sequence}`;
    } catch (error) {
      console.error('生成债权编号失败:', error);
      // 如果生成失败，使用时间戳作为后备方案
      return `CL-${Date.now()}`;
    }
  }

  /**
   * 检查债权是否可编辑
   */
  isClaimEditable(claim: ClaimData): boolean {
    return ['draft', 'rejected', 'requires_supplement'].includes(claim.review_status);
  }

  /**
   * 检查债权是否可撤回
   */
  isClaimWithdrawable(claim: ClaimData): boolean {
    return ['submitted', 'under_review'].includes(claim.review_status);
  }

  /**
   * 格式化货币显示
   */
  formatCurrency(amount: number, currency: string = 'CNY'): string {
    return amount.toLocaleString('zh-CN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * 获取状态显示文本
   */
  getStatusText(status: ClaimData['review_status']): string {
    const statusMap = {
      draft: '草稿',
      submitted: '已提交',
      under_review: '审核中',
      approved: '审核通过',
      rejected: '已驳回',
      requires_supplement: '需要补充',
    };
    return statusMap[status] || '未知状态';
  }

  /**
   * 获取状态颜色
   */
  getStatusColor(status: ClaimData['review_status']): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' {
    const colorMap = {
      draft: 'default' as const,
      submitted: 'info' as const,
      under_review: 'warning' as const,
      approved: 'success' as const,
      rejected: 'error' as const,
      requires_supplement: 'secondary' as const,
    };
    return colorMap[status] || 'default';
  }
}

export default ClaimService; 