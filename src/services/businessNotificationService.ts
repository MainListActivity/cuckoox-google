import { RecordId } from 'surrealdb';
import { surrealClient } from '@/src/lib/surrealClient';
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
  participants?: (RecordId | string)[];
  scheduled_start_date: string;
  scheduled_end_date: string;
}

interface CaseData {
  id: RecordId | string;
  case_number: string;
  name: string;
  procedure_phase: string;
}

class BusinessNotificationService {
  /**
   * Send notification when claim is reviewed
   */
  async notifyClaimReviewed(
    claimId: RecordId | string,
    reviewStatus: string,
    reviewComments?: string,
    reviewerId?: RecordId | string
  ) {
    try {
      const client = await surrealClient();
      
      // Get claim details
      const [[claim]] = await client.query<[ClaimData]>(
        `SELECT id, claim_number, case_id, created_by, creditor_id FROM ${String(claimId)}`
      );
      
      if (!claim) {
        console.error(`Claim not found: ${claimId}`);
        return;
      }
      
      // Get case details
      const [[caseData]] = await client.query<[CaseData]>(
        `SELECT id, case_number, name FROM ${String(claim.case_id)}`
      );
      
      let title = `债权审核通知 - ${claim.claim_number}`;
      let content = `您提交的债权申报（编号：${claim.claim_number}）已完成审核。\n`;
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
        target_user_id: claim.created_by,
        case_id: claim.case_id,
        title: title,
        content: content,
        priority: priority,
        action_link: `/my-claims/${String(claimId).split(':')[1]}`,
        sender_name: '债权审核系统'
      });
      
      console.log(`Sent claim review notification for claim ${claim.claim_number}`);
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
    changedBy: RecordId | string
  ) {
    try {
      const client = await surrealClient();
      
      // Get meeting details
      const [[meeting]] = await client.query<[MeetingData]>(
        `SELECT * FROM ${String(meetingId)}`
      );
      
      if (!meeting) {
        console.error(`Meeting not found: ${meetingId}`);
        return;
      }
      
      // Get case details
      const [[caseData]] = await client.query<[CaseData]>(
        `SELECT id, case_number, name FROM ${String(meeting.case_id)}`
      );
      
      let title = '';
      let content = '';
      let priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL';
      
      const meetingTime = new Date(meeting.scheduled_start_date).toLocaleString('zh-CN');
      
      switch (changeType) {
        case 'created':
          title = `新会议通知 - ${meeting.meeting_name}`;
          content = `新会议已安排：\n\n` +
            `会议名称：${meeting.meeting_name}\n` +
            `案件编号：${caseData.case_number}\n` +
            `开始时间：${meetingTime}`;
          break;
          
        case 'updated':
          title = `会议变更通知 - ${meeting.meeting_name}`;
          content = `会议信息已更新：\n\n` +
            `会议名称：${meeting.meeting_name}\n` +
            `案件编号：${caseData.case_number}\n` +
            `新的开始时间：${meetingTime}\n\n` +
            `请注意查看最新的会议安排。`;
          priority = 'HIGH';
          break;
          
        case 'cancelled':
          title = `会议取消通知 - ${meeting.meeting_name}`;
          content = `会议已取消：\n\n` +
            `会议名称：${meeting.meeting_name}\n` +
            `案件编号：${caseData.case_number}\n` +
            `原定时间：${meetingTime}`;
          priority = 'HIGH';
          break;
      }
      
      // Send notification to all participants
      if (meeting.participants && meeting.participants.length > 0) {
        for (const participantId of meeting.participants) {
          await messageService.sendNotification({
            type: 'BUSINESS_NOTIFICATION',
            target_user_id: participantId,
            case_id: meeting.case_id,
            title: title,
            content: content,
            priority: priority,
            action_link: `/online-meetings`,
            sender_name: '会议系统'
          });
        }
        
        console.log(`Sent meeting ${changeType} notifications to ${meeting.participants.length} participants`);
      }
      
      // Also send to all case members
      const [[caseMembers]] = await client.query<[Array<{ user_id: RecordId | string }>]>(
        'SELECT out AS user_id FROM has_member WHERE in = $case_id',
        { case_id: meeting.case_id }
      );
      
      if (caseMembers && caseMembers.length > 0) {
        for (const member of caseMembers) {
          // Skip if already notified as participant
                     if (!meeting.participants || !meeting.participants.some((p: RecordId | string) => String(p) === String(member.user_id))) {
            await messageService.sendNotification({
              type: 'BUSINESS_NOTIFICATION',
              target_user_id: member.user_id,
              case_id: meeting.case_id,
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
    changedBy: RecordId | string
  ) {
    try {
      const client = await surrealClient();
      
      // Get case details
      const [[caseData]] = await client.query<[CaseData]>(
        `SELECT * FROM ${String(caseId)}`
      );
      
      if (!caseData) {
        console.error(`Case not found: ${caseId}`);
        return;
      }
      
      const title = `案件状态变更通知 - ${caseData.case_number}`;
      const content = `案件状态已更新：\n\n` +
        `案件编号：${caseData.case_number}\n` +
        `案件名称：${caseData.name}\n` +
        `原状态：${oldStatus}\n` +
        `新状态：${newStatus}`;
      
      // Get all case members
      const [[caseMembers]] = await client.query<[Array<{ user_id: RecordId | string }>]>(
        'SELECT out AS user_id FROM has_member WHERE in = $case_id',
        { case_id: caseId }
      );
      
      if (caseMembers && caseMembers.length > 0) {
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
      const client = await surrealClient();
      
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
        const [[users]] = await client.query<[Array<{ id: RecordId | string }>]>(
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
      const client = await surrealClient();
      
      // Get creditor details
      const [[creditor]] = await client.query(
        `SELECT name, legal_id FROM ${String(creditorId)}`
      );
      
      // Get case details
      const [[caseData]] = await client.query<[CaseData]>(
        `SELECT case_number, name FROM ${String(caseId)}`
      );
      
      if (!creditor || !caseData) {
        console.error('Creditor or case not found');
        return;
      }
      
      const title = `新债权人录入通知`;
      const content = `案件 ${caseData.case_number} 新增债权人：\n\n` +
        `债权人名称：${creditor.name}\n` +
        `证件号码：${creditor.legal_id}\n\n` +
        `请及时关注债权申报情况。`;
      
      // Notify case lead
      const [[caseLead]] = await client.query(
        `SELECT case_lead_user_id FROM ${String(caseId)}`
      );
      
      if (caseLead?.case_lead_user_id && String(caseLead.case_lead_user_id) !== String(addedBy)) {
        await messageService.sendNotification({
          type: 'BUSINESS_NOTIFICATION',
          target_user_id: caseLead.case_lead_user_id,
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
}

export const businessNotificationService = new BusinessNotificationService();