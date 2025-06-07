import { QuillDelta } from '@/src/components/RichTextEditor';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class ClaimService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(surrealClient: any) {
    this.db = surrealClient;
  }

  /**
   * 获取债权基本信息
   */
  async getClaimById(claimId: string): Promise<ClaimData | null> {
    try {
      const result = await this.db.select(claimId);
      return result && result.length > 0 ? result[0] : null;
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
      let query = 'SELECT * FROM claim WHERE creditor_id = $creditorId';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: any = { creditorId };
      
      if (caseId) {
        query += ' AND case_id = $caseId';
        params.caseId = caseId;
      }
      
      query += ' ORDER BY created_at DESC';
      
      const [result] = await this.db.query(query, params);
      return Array.isArray(result) ? result : [];
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
      // This query assumes that a creditor is a "member" of a case they can submit claims to.
      // The specific relationship might need to be adjusted based on the actual schema.
      const [result] = await this.db.query(
        'SELECT id, name, case_number FROM case WHERE id IN (SELECT out FROM case_member WHERE in = $creditorId)',
        { creditorId }
      );
      return Array.isArray(result) ? result : [];
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
      
      const newClaim = {
        ...claimData,
        claim_number: claimNumber,
        review_status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await this.db.create('claim', newClaim);
      return result;
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
      const updateData = {
        asserted_claim_details: basicInfo,
        updated_at: new Date().toISOString(),
      };

      const result = await this.db.merge(claimId, updateData);
      return result;
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
  async submitClaim(claimId: string, attachmentContent: QuillDelta): Promise<ClaimData> {
    try {
      // 验证必要字段
      const claim = await this.getClaimById(claimId);
      if (!claim) {
        throw new Error('债权不存在');
      }

      if (!claim.asserted_claim_details.nature || !claim.asserted_claim_details.principal) {
        throw new Error('请完善债权基本信息');
      }

      const updateData = {
        'asserted_claim_details.attachment_content': attachmentContent,
        review_status: 'submitted',
        updated_at: new Date().toISOString(),
        submit_time: new Date().toISOString(),
      };

      const result = await this.db.merge(claimId, updateData);
      return result;
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

      const updateData = {
        review_status: 'draft',
        updated_at: new Date().toISOString(),
        withdraw_time: new Date().toISOString(),
      };

      const result = await this.db.merge(claimId, updateData);
      return result;
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
      const [result] = await this.db.query(
        'SELECT count() AS count FROM claim WHERE case_id = $caseId',
        { caseId }
      );
      
      const count = result && result.length > 0 ? result[0].count : 0;
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