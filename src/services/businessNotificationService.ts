import { RecordId } from 'surrealdb';
import { useSurrealClientSingleton } from '../contexts/SurrealProvider';
import type { SurrealWorkerAPI } from '../contexts/SurrealProvider';
import { queryWithAuth } from '../utils/surrealAuth';
import { messageService } from './messageService';

interface ClaimData {
  id: RecordId | string;
  claim_number: string;
  case_id: RecordId | string;
  created_by: RecordId | string;
  creditor_id: RecordId | string;
}

interface MeetingData {
  id: RecordId | string;
  meeting_name: string;
  case_id: RecordId | string;
  scheduled_start_date: string;
  scheduled_end_date: string;
  participants: (RecordId | string)[];
}

interface CaseData {
  id: RecordId | string;
  case_number: string;
  name: string;
  procedure_phase: string;
}

class BusinessNotificationService {
  private clientGetter: (() => Promise<SurrealWorkerAPI>) | null = null;
  
  /**
   * 设置客户端获取函数 - 在应用启动时由 SurrealProvider 调用
   */
  setClientGetter(getter: () => Promise<SurrealWorkerAPI>) {
    this.clientGetter = getter;
  }
  
  /**
   * 获取 SurrealDB 客户端
   */
  private async getClient(): Promise<SurrealWorkerAPI> {
    if (!this.clientGetter) {
      // 如果没有设置客户端获取函数，尝试使用 hook 方式（仅用于向后兼容）
      try {
        const { surrealClient } = useSurrealClientSingleton();
        return await surrealClient();
      } catch (error) {
        throw new Error('SurrealDB client not available. Ensure BusinessNotificationService is properly initialized with setClientGetter.');
      }
    }
    
    if (!this.clientGetter) {
      throw new Error('SurrealDB client getter not set');
    }
    
    const client = await this.clientGetter();
    if (!client) {
      throw new Error('SurrealDB client is null');
    }
    return client;
  }
  /**
   * Send notification when claim is reviewed
   */
  async notifyClaimReviewed(
    claimId: RecordId | string,
    reviewStatus: string,
    reviewComments?: string,
    _reviewerId?: RecordId | string
  ) {
    try {
      const client = await this.getClient();
      
      // Get claim details
      const claim = await queryWithAuth<ClaimData[]>(client,
        `SELECT id, claim_number, case_id, created_by, creditor_id FROM claim WHERE id = $claimId`,
        { claimId }
      );
      
      if (!Array.isArray(claim) || claim.length === 0) {
        console.error(`Claim not found: ${claimId}`);
        return;
      }
      const claimData = claim[0];
      
      const title = `债权审核通知 - ${claimData.claim_number}`;
      let content = `您提交的债权申报（编号：${claimData.claim_number}）已完成审核。\n`;
      let priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL';
      
      switch (reviewStatus) {
        case '审核通过':
          content += '审核结果：✅ 审核通过';
          break;
        case '部分通过':
          content += '审核结果：⚠️ 部分通过';
          priority = 'HIGH';
          break;
        case '驳回':
          content += '审核结果：❌ 已驳回';
          priority = 'HIGH';
          break;
        case '要求补充材料':
          content += '审核结果：📋 需要补充材料';
          priority = 'HIGH';
          break;
        default:
          content += `审核结果：${reviewStatus}`;
      }
      
      if (reviewComments) {
        content += `\n\n审核意见：${reviewComments}`;
      }
      
      // Send notification to claim creator
      await messageService.sendNotification({
        type: 'BUSINESS_NOTIFICATION',
        target_user_id: claimData.created_by,
        case_id: claimData.case_id,
        title: title,
        content: content,
        priority: priority,
        action_link: `/my-claims/${String(claimId).split(':')[1]}`,
        sender_name: '债权审核系统'
      });
      
      console.log(`Sent claim review notification for claim ${claimData.claim_number}`);
    } catch (error) {
      console.error('Error sending claim review notification:', error);
      throw error;
    }
  }
  
  /**
   * Send notification when meeting is created or updated
   */
  async notifyMeetingChange(
    meetingId: RecordId | string,
    changeType: 'created' | 'updated' | 'cancelled',
    _changedBy: RecordId | string
  ) {
    try {
      const client = await this.getClient();
      
      // Get meeting details
      const meetingResult = await client.query<[MeetingData[]]>(
        `SELECT * FROM ${String(meetingId)}`
      );
      
      if (!meetingResult || !meetingResult[0] || meetingResult[0].length === 0) {
        console.error(`Meeting not found: ${meetingId}`);
        return;
      }
      const meetingData = meetingResult[0][0];
      
      // Get case details
      const caseResult = await client.query<[CaseData[]]>(
        `SELECT id, case_number, name FROM ${String(meetingData.case_id)}`
      );
      
      if (!caseResult || !caseResult[0] || caseResult[0].length === 0) {
        console.error(`Case not found: ${meetingData.case_id}`);
        return;
      }
      const caseData = caseResult[0][0];
      
      let title = '';
      let content = '';
      let priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL';
      
      const meetingTime = new Date(meetingData.scheduled_start_date).toLocaleString('zh-CN');
      
      switch (changeType) {
        case 'created':
          title = `新会议通知 - ${meetingData.meeting_name}`;
          content = `新会议已安排：\n\n` +
            `会议名称：${meetingData.meeting_name}\n` +
            `案件编号：${caseData.case_number}\n` +
            `开始时间：${meetingTime}`;
          break;
          
        case 'updated':
          title = `会议变更通知 - ${meetingData.meeting_name}`;
          content = `会议信息已更新：\n\n` +
            `会议名称：${meetingData.meeting_name}\n` +
            `案件编号：${caseData.case_number}\n` +
            `新的开始时间：${meetingTime}\n\n` +
            `请注意查看最新的会议安排。`;
          priority = 'HIGH';
          break;
          
        case 'cancelled':
          title = `会议取消通知 - ${meetingData.meeting_name}`;
          content = `会议已取消：\n\n` +
            `会议名称：${meetingData.meeting_name}\n` +
            `案件编号：${caseData.case_number}\n` +
            `原定时间：${meetingTime}`;
          priority = 'HIGH';
          break;
      }
      
      // Send notification to all participants
      if (meetingData.participants && meetingData.participants.length > 0) {
        for (const participantId of meetingData.participants) {
          await messageService.sendNotification({
            type: 'BUSINESS_NOTIFICATION',
            target_user_id: participantId,
            case_id: meetingData.case_id,
            title: title,
            content: content,
            priority: priority,
            action_link: `/online-meetings`,
            sender_name: '会议系统'
          });
        }
        
        console.log(`Sent meeting ${changeType} notifications to ${meetingData.participants.length} participants`);
      }
      
      // Also send to all case members
      const [caseMembers] = await client.query<Array<{ user_id: RecordId | string }>[]>(
        'SELECT out AS user_id FROM has_member WHERE in = $case_id',
        { case_id: meetingData.case_id }
      );
      
      if (caseMembers && Array.isArray(caseMembers) && caseMembers.length > 0) {
        for (const member of caseMembers) {
          // Skip if already notified as participant
                     if (!meetingData.participants || !meetingData.participants.some((p: RecordId | string) => String(p) === String(member.user_id))) {
            await messageService.sendNotification({
              type: 'BUSINESS_NOTIFICATION',
              target_user_id: member.user_id,
              case_id: meetingData.case_id,
              title: title,
              content: content,
              priority: priority,
              action_link: `/online-meetings`,
              sender_name: '会议系统'
            });
          }
        }
      }
    } catch (error) {
      console.error('Error sending meeting notification:', error);
      throw error;
    }
  }
  
  /**
   * Send notification when case status changes
   */
  async notifyCaseStatusChange(
    caseId: RecordId | string,
    oldStatus: string,
    newStatus: string,
    _changedBy: RecordId | string
  ) {
    try {
      const client = await this.getClient();
      
      // Get case details
      const caseResult = await client.query<[CaseData[]]>(
        `SELECT * FROM ${String(caseId)}`
      );
      
      if (!caseResult || !caseResult[0] || caseResult[0].length === 0) {
        console.error(`Case not found: ${caseId}`);
        return;
      }
      const caseInfo = caseResult[0][0];
      
      const title = `案件状态变更通知 - ${caseInfo.case_number}`;
      const content = `案件状态已更新：\n\n` +
        `案件编号：${caseInfo.case_number}\n` +
        `案件名称：${caseInfo.name}\n` +
        `原状态：${oldStatus}\n` +
        `新状态：${newStatus}`;
      
      // Get all case members
      const [caseMembers] = await client.query<Array<{ user_id: RecordId | string }>[]>(
        'SELECT out AS user_id FROM has_member WHERE in = $case_id',
        { case_id: caseId }
      );
      
      if (caseMembers && Array.isArray(caseMembers) && caseMembers.length > 0) {
        for (const member of caseMembers) {
          await messageService.sendNotification({
            type: 'BUSINESS_NOTIFICATION',
            target_user_id: member.user_id,
            case_id: caseId,
            title: title,
            content: content,
            priority: 'NORMAL',
            action_link: `/cases/${String(caseId).split(':')[1]}`,
            sender_name: '案件管理系统'
          });
        }
        
        console.log(`Sent case status change notifications to ${caseMembers.length} members`);
      }
    } catch (error) {
      console.error('Error sending case status change notification:', error);
      throw error;
    }
  }
  
  /**
   * Send system announcement
   */
  async sendSystemAnnouncement(
    title: string,
    content: string,
    targetUserIds?: (RecordId | string)[],
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL'
  ) {
    try {
      const client = await this.getClient();
      
      if (targetUserIds && targetUserIds.length > 0) {
        // Send to specific users
        for (const userId of targetUserIds) {
          await messageService.sendNotification({
            type: 'SYSTEM_NOTIFICATION',
            target_user_id: userId,
            title: title,
            content: content,
            priority: priority,
            sender_name: '系统公告'
          });
        }
        
        console.log(`Sent system announcement to ${targetUserIds.length} users`);
      } else {
        // Send to all active users
        const [users] = await client.query<Array<{ id: RecordId | string }>[]>(
          'SELECT id FROM user WHERE email != NONE'
        );
        
        if (users && users.length > 0) {
          for (const user of users) {
            await messageService.sendNotification({
              type: 'SYSTEM_NOTIFICATION',
              target_user_id: user.id,
              title: title,
              content: content,
              priority: priority,
              sender_name: '系统公告'
            });
          }
          
          console.log(`Sent system announcement to ${users.length} users`);
        }
      }
    } catch (error) {
      console.error('Error sending system announcement:', error);
      throw error;
    }
  }
  
  /**
   * Send notification when creditor is added
   */
  async notifyCreditorAdded(
    creditorId: RecordId | string,
    caseId: RecordId | string,
    addedBy: RecordId | string
  ) {
    try {
      const client = await this.getClient();
      
      // Get creditor details
      const creditorResult = await client.query<Array<{ name: string; legal_id: string }>[]>(
        `SELECT name, legal_id FROM ${String(creditorId)}`
      );
      
      // Get case details
      const caseResult = await client.query<CaseData[]>(
        `SELECT case_number, name FROM ${String(caseId)}`
      );
      
      if (!Array.isArray(creditorResult) || creditorResult.length === 0 || 
          !Array.isArray(creditorResult[0]) || creditorResult[0].length === 0 ||
          !Array.isArray(caseResult) || caseResult.length === 0 || 
          !Array.isArray(caseResult[0]) || caseResult[0].length === 0) {
        console.error('Creditor or case not found');
        return;
      }
      const creditorInfo = creditorResult[0][0];
      const caseInfo = caseResult[0][0];
      
      const title = `新债权人录入通知`;
      const content = `案件 ${caseInfo.case_number} 新增债权人：\n\n` +
        `债权人名称：${creditorInfo.name}\n` +
        `证件号码：${creditorInfo.legal_id}\n\n` +
        `请及时关注债权申报情况。`;
      
      // Notify case lead
      const caseLeadResult = await client.query<Array<{ case_lead_user_id: RecordId | string }>[]>(
        `SELECT case_lead_user_id FROM ${String(caseId)}`
      );
      
      if (Array.isArray(caseLeadResult) && caseLeadResult.length > 0 && 
          Array.isArray(caseLeadResult[0]) && caseLeadResult[0].length > 0 &&
          caseLeadResult[0][0]?.case_lead_user_id && 
          String(caseLeadResult[0][0].case_lead_user_id) !== String(addedBy)) {
        await messageService.sendNotification({
          type: 'BUSINESS_NOTIFICATION',
          target_user_id: caseLeadResult[0][0].case_lead_user_id,
          case_id: caseId,
          title: title,
          content: content,
          priority: 'NORMAL',
          action_link: `/creditors`,
          sender_name: '债权人管理系统'
        });
        
        console.log(`Sent creditor added notification to case lead`);
      }
    } catch (error) {
      console.error('Error sending creditor added notification:', error);
      throw error;
    }
  }

  // ===== 债权追踪相关通知方法 =====

  /**
   * 发送债权操作通知
   */
  async notifyClaimOperation(
    claimId: RecordId | string,
    operationType: string,
    operatorId: RecordId | string,
    description?: string
  ) {
    try {
      const client = await this.getClient();
      
      // 获取债权详细信息
      const claim = await queryWithAuth<ClaimData[]>(client,
        `SELECT id, claim_number, case_id, created_by, creditor_id FROM claim WHERE id = $claimId`,
        { claimId }
      );
      
      if (!Array.isArray(claim) || claim.length === 0) {
        console.error(`Claim not found: ${claimId}`);
        return;
      }
      const claimData = claim[0];
      
      // 获取操作人信息
      const [operatorResult] = await client.query<Array<{ display_name: string }>[]>(
        `SELECT display_name FROM user WHERE id = $operatorId`,
        { operatorId }
      );
      const operatorName = operatorResult?.[0]?.display_name || '系统';
      
      let title = '';
      let content = '';
      let priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL';
      
      switch (operationType) {
        case 'submit':
          title = `债权申报提交通知 - ${claimData.claim_number}`;
          content = `债权人提交了新的债权申报，请及时审核。\n\n债权编号：${claimData.claim_number}\n提交人：${operatorName}`;
          priority = 'HIGH';
          break;
        case 'review':
          title = `债权审核通知 - ${claimData.claim_number}`;
          content = `债权申报已开始审核。\n\n债权编号：${claimData.claim_number}\n审核人：${operatorName}`;
          break;
        case 'supplement_request':
          title = `补充材料要求 - ${claimData.claim_number}`;
          content = `您的债权申报需要补充材料，请尽快完善。\n\n债权编号：${claimData.claim_number}\n审核人：${operatorName}`;
          priority = 'HIGH';
          break;
        default:
          title = `债权操作通知 - ${claimData.claim_number}`;
          content = `债权申报发生了新的操作。\n\n债权编号：${claimData.claim_number}\n操作类型：${operationType}\n操作人：${operatorName}`;
      }
      
      if (description) {
        content += `\n\n备注：${description}`;
      }
      
      // 根据操作类型确定通知对象
      const recipients: (RecordId | string)[] = [];
      
      if (['submit'].includes(operationType)) {
        // 提交类操作：通知案件负责人和审核人员
        const [caseMembers] = await client.query<Array<{ user_id: RecordId | string }>[]>(
          'SELECT out AS user_id FROM has_member WHERE in = $case_id',
          { case_id: claimData.case_id }
        );
        if (caseMembers) {
          recipients.push(...caseMembers.map(m => m.user_id));
        }
      } else if (['review', 'approve', 'reject', 'supplement_request'].includes(operationType)) {
        // 审核类操作：通知债权人
        recipients.push(claimData.created_by);
      }
      
      // 发送通知
      for (const recipientId of recipients) {
        if (String(recipientId) !== String(operatorId)) { // 不通知操作者自己
          await messageService.sendNotification({
            type: 'BUSINESS_NOTIFICATION',
            target_user_id: recipientId,
            case_id: claimData.case_id,
            title: title,
            content: content,
            priority: priority,
            action_link: `/claims/${String(claimId).split(':')[1]}`,
            sender_name: '债权管理系统'
          });
        }
      }
      
      console.log(`Sent claim operation notification for operation ${operationType} on claim ${claimData.claim_number}`);
    } catch (error) {
      console.error('Error sending claim operation notification:', error);
      throw error;
    }
  }

  /**
   * 发送债权状态变更通知
   */
  async notifyClaimStatusChange(
    claimId: RecordId | string,
    fromStatus: string,
    toStatus: string,
    operatorId: RecordId | string,
    transitionNotes?: string
  ) {
    try {
      const client = await this.getClient();
      
      // 获取债权详细信息
      const claim = await queryWithAuth<ClaimData[]>(client,
        `SELECT id, claim_number, case_id, created_by FROM claim WHERE id = $claimId`,
        { claimId }
      );
      
      if (!Array.isArray(claim) || claim.length === 0) {
        console.error(`Claim not found: ${claimId}`);
        return;
      }
      const claimData = claim[0];
      
      const title = `债权状态变更通知 - ${claimData.claim_number}`;
      let content = `您的债权申报状态已更新：\n\n` +
        `债权编号：${claimData.claim_number}\n` +
        `原状态：${fromStatus}\n` +
        `新状态：${toStatus}`;
      
      if (transitionNotes) {
        content += `\n\n说明：${transitionNotes}`;
      }
      
      let priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL';
      
      // 根据状态变更类型调整优先级
      if (['审核通过', '审核不通过', '需要补充'].includes(toStatus)) {
        priority = 'HIGH';
      }
      
      // 通知债权人
      await messageService.sendNotification({
        type: 'BUSINESS_NOTIFICATION',
        target_user_id: claimData.created_by,
        case_id: claimData.case_id,
        title: title,
        content: content,
        priority: priority,
        action_link: `/my-claims/${String(claimId).split(':')[1]}`,
        sender_name: '债权管理系统'
      });
      
      console.log(`Sent claim status change notification from ${fromStatus} to ${toStatus} for claim ${claimData.claim_number}`);
    } catch (error) {
      console.error('Error sending claim status change notification:', error);
      throw error;
    }
  }

  /**
   * 发送债权审核超时提醒
   */
  async notifyClaimReviewTimeout(
    claimId: RecordId | string,
    submissionDate: string,
    timeoutDays: number = 7
  ) {
    try {
      const client = await this.getClient();
      
      // 获取债权详细信息
      const claim = await queryWithAuth<ClaimData[]>(client,
        `SELECT id, claim_number, case_id, created_by FROM claim WHERE id = $claimId`,
        { claimId }
      );
      
      if (!Array.isArray(claim) || claim.length === 0) {
        console.error(`Claim not found: ${claimId}`);
        return;
      }
      const claimData = claim[0];
      
      const title = `债权审核超时提醒 - ${claimData.claim_number}`;
      const content = `以下债权申报已超过${timeoutDays}天未审核，请尽快处理：\n\n` +
        `债权编号：${claimData.claim_number}\n` +
        `提交日期：${new Date(submissionDate).toLocaleDateString('zh-CN')}\n` +
        `等待天数：${Math.ceil((Date.now() - new Date(submissionDate).getTime()) / (1000 * 60 * 60 * 24))}天`;
      
      // 获取案件成员（审核人员）
      const [caseMembers] = await client.query<Array<{ user_id: RecordId | string }>[]>(
        'SELECT out AS user_id FROM has_member WHERE in = $case_id',
        { case_id: claimData.case_id }
      );
      
      if (caseMembers && caseMembers.length > 0) {
        for (const member of caseMembers) {
          await messageService.sendNotification({
            type: 'BUSINESS_NOTIFICATION',
            target_user_id: member.user_id,
            case_id: claimData.case_id,
            title: title,
            content: content,
            priority: 'URGENT',
            action_link: `/claims/${String(claimId).split(':')[1]}/review`,
            sender_name: '债权管理系统'
          });
        }
        
        console.log(`Sent timeout reminder for claim ${claimData.claim_number} to ${caseMembers.length} reviewers`);
      }
    } catch (error) {
      console.error('Error sending claim review timeout notification:', error);
      throw error;
    }
  }

  /**
   * 发送债权版本变更通知
   */
  async notifyClaimVersionUpdate(
    claimId: RecordId | string,
    versionNumber: number,
    changeSummary?: string,
    changedBy?: RecordId | string
  ) {
    try {
      const client = await this.getClient();
      
      // 获取债权详细信息
      const claim = await queryWithAuth<ClaimData[]>(client,
        `SELECT id, claim_number, case_id, created_by FROM claim WHERE id = $claimId`,
        { claimId }
      );
      
      if (!Array.isArray(claim) || claim.length === 0) {
        console.error(`Claim not found: ${claimId}`);
        return;
      }
      const claimData = claim[0];
      
      const title = `债权信息变更通知 - ${claimData.claim_number}`;
      let content = `债权申报信息已更新：\n\n` +
        `债权编号：${claimData.claim_number}\n` +
        `版本号：V${versionNumber}`;
      
      if (changeSummary) {
        content += `\n变更内容：${changeSummary}`;
      }
      
      // 通知相关人员
      const recipients: (RecordId | string)[] = [claimData.created_by];
      
      // 获取案件成员
      const [caseMembers] = await client.query<Array<{ user_id: RecordId | string }>[]>(
        'SELECT out AS user_id FROM has_member WHERE in = $case_id',
        { case_id: claimData.case_id }
      );
      if (caseMembers) {
        recipients.push(...caseMembers.map(m => m.user_id));
      }
      
      // 发送通知（去重）
      const uniqueRecipients = [...new Set(recipients.map(r => String(r)))];
      for (const recipientId of uniqueRecipients) {
        if (!changedBy || String(recipientId) !== String(changedBy)) { // 不通知操作者自己
          await messageService.sendNotification({
            type: 'BUSINESS_NOTIFICATION',
            target_user_id: recipientId,
            case_id: claimData.case_id,
            title: title,
            content: content,
            priority: 'NORMAL',
            action_link: `/claims/${String(claimId).split(':')[1]}`,
            sender_name: '债权管理系统'
          });
        }
      }
      
      console.log(`Sent claim version update notification for claim ${claimData.claim_number} version ${versionNumber}`);
    } catch (error) {
      console.error('Error sending claim version update notification:', error);
      throw error;
    }
  }

  /**
   * 批量发送超时提醒
   */
  async sendBatchTimeoutReminders(timeoutDays: number = 7) {
    try {
      const client = await this.getClient();
      
      // 查找超时未审核的债权
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - timeoutDays);
      
      const [timeoutClaims] = await client.query<Array<{
        id: RecordId | string;
        claim_number: string;
        created_at: string;
      }>[]>(
        `SELECT id, claim_number, created_at FROM claim 
         WHERE review_status_id.name = '待审核' 
         AND created_at < $cutoffDate`,
        { cutoffDate: cutoffDate.toISOString() }
      );
      
      if (timeoutClaims && timeoutClaims.length > 0) {
        console.log(`Found ${timeoutClaims.length} timeout claims, sending reminders...`);
        
        for (const claim of timeoutClaims) {
          await this.notifyClaimReviewTimeout(claim.id, claim.created_at, timeoutDays);
        }
        
        console.log(`Sent timeout reminders for ${timeoutClaims.length} claims`);
      }
    } catch (error) {
      console.error('Error sending batch timeout reminders:', error);
      throw error;
    }
  }
}

export const businessNotificationService = new BusinessNotificationService();