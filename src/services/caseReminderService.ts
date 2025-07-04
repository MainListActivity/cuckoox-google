import { RecordId } from 'surrealdb';
import { surrealClient } from '@/src/lib/surrealClient';
import { messageService } from './messageService';

interface NotificationRule {
  id: RecordId | string;
  procedure_phase: string;
  trigger_condition: string;
  message_template: string;
  notification_frequency: string;
  notification_time: string;
  is_active: boolean;
}

interface CaseData {
  id: RecordId | string;
  case_number: string;
  name: string;
  procedure_phase: string;
  acceptance_date: string;
  announcement_date?: string;
  claim_submission_start_date?: string;
  claim_submission_end_date?: string;
  first_creditor_meeting_date?: string;
  reorganization_ruling_date?: string;
  delayed_reorganization_plan_submission_date?: string;
  reorganization_plan_submission_date?: string;
  second_creditor_meeting_date?: string;
}

interface CaseBotSubscriber {
  user_id: RecordId | string;
}

class CaseReminderService {
  /**
   * Check and send reminders for all active cases
   */
  async checkAndSendReminders() {
    try {
      const client = await surrealClient();
      
      // Get all active notification rules
      const [[rules]] = await client.query<[NotificationRule[]]>(
        'SELECT * FROM notification_rule WHERE is_active = true'
      );
      
      if (!rules || rules.length === 0) {
        console.log('No active notification rules found');
        return;
      }
      
      // Get all active cases
      const [[cases]] = await client.query<[CaseData[]]>(
        'SELECT * FROM case WHERE procedure_phase != "结案"'
      );
      
      if (!cases || cases.length === 0) {
        console.log('No active cases found');
        return;
      }
      
      // Check each case against each rule
      for (const caseData of cases) {
        for (const rule of rules) {
          if (caseData.procedure_phase === rule.procedure_phase) {
            const shouldSend = await this.evaluateTriggerCondition(caseData, rule.trigger_condition);
            
            if (shouldSend) {
              await this.sendReminder(caseData, rule);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking and sending reminders:', error);
      throw error;
    }
  }
  
  /**
   * Evaluate trigger condition for a case
   */
  private async evaluateTriggerCondition(caseData: CaseData, triggerCondition: string): Promise<boolean> {
    try {
      const now = new Date();
      let days = 0;
      
      switch (caseData.procedure_phase) {
        case '立案':
          // 受理时间+25天-当前时间 <= 5天
          if (caseData.acceptance_date) {
            const acceptanceDate = new Date(caseData.acceptance_date);
            const deadlineDate = new Date(acceptanceDate);
            deadlineDate.setDate(deadlineDate.getDate() + 25);
            days = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return days <= 5 && days > 0;
          }
          break;
          
        case '公告':
          // 公告时间+30天-当前时间 <= 3天
          if (caseData.announcement_date) {
            const announcementDate = new Date(caseData.announcement_date);
            const deadlineDate = new Date(announcementDate);
            deadlineDate.setDate(deadlineDate.getDate() + 30);
            days = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return days <= 3 && days > 0;
          }
          break;
          
        case '债权申报':
          // 公告时间+3月-当前时间 <= 3天
          if (caseData.announcement_date) {
            const announcementDate = new Date(caseData.announcement_date);
            const deadlineDate = new Date(announcementDate);
            deadlineDate.setMonth(deadlineDate.getMonth() + 3);
            days = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return days <= 3 && days > 0;
          }
          break;
          
        case '债权人第一次会议':
          // 债权申报截止时间+15日-当前时间 <= 3天
          if (caseData.claim_submission_end_date) {
            const submissionEndDate = new Date(caseData.claim_submission_end_date);
            const deadlineDate = new Date(submissionEndDate);
            deadlineDate.setDate(deadlineDate.getDate() + 15);
            days = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return days <= 3 && days > 0;
          }
          break;
          
        case '裁定重整':
          // 裁定重整时间+6月-当前时间 <= 5天
          if (caseData.reorganization_ruling_date) {
            const rulingDate = new Date(caseData.reorganization_ruling_date);
            const deadlineDate = new Date(rulingDate);
            deadlineDate.setMonth(deadlineDate.getMonth() + 6);
            days = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return days <= 5 && days > 0;
          }
          break;
          
        case '延迟提交重整计划':
          // 延迟提交重整计划时间+3月-当前时间 <= 5天
          if (caseData.delayed_reorganization_plan_submission_date) {
            const delayedDate = new Date(caseData.delayed_reorganization_plan_submission_date);
            const deadlineDate = new Date(delayedDate);
            deadlineDate.setMonth(deadlineDate.getMonth() + 3);
            days = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return days <= 5 && days > 0;
          }
          break;
          
        case '债权人第二次会议':
          // 提交重整计划时间+15日-当前时间 <= 3天
          if (caseData.reorganization_plan_submission_date) {
            const planDate = new Date(caseData.reorganization_plan_submission_date);
            const deadlineDate = new Date(planDate);
            deadlineDate.setDate(deadlineDate.getDate() + 15);
            days = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return days <= 3 && days > 0;
          }
          break;
      }
      
      return false;
    } catch (error) {
      console.error('Error evaluating trigger condition:', error);
      return false;
    }
  }
  
  /**
   * Send reminder to case bot subscribers
   */
  private async sendReminder(caseData: CaseData, rule: NotificationRule) {
    try {
      const client = await surrealClient();
      
      // Get case bot
      const [[caseBot]] = await client.query(
        'SELECT * FROM case_bot WHERE case_id = $case_id',
        { case_id: caseData.id }
      );
      
      if (!caseBot) {
        console.log(`No case bot found for case ${caseData.case_number}`);
        return;
      }
      
      // Get subscribers
      const [[subscribers]] = await client.query<[CaseBotSubscriber[]]>(
        'SELECT user_id FROM case_bot_subscription WHERE case_bot_id = $case_bot_id',
        { case_bot_id: caseBot.id }
      );
      
      if (!subscribers || subscribers.length === 0) {
        console.log(`No subscribers for case bot ${caseData.case_number}`);
        return;
      }
      
      // Calculate days for message template
      const days = await this.calculateDaysForMessage(caseData, rule.procedure_phase);
      const content = rule.message_template.replace('{{days}}', String(days));
      
      // Send notification to each subscriber
      for (const subscriber of subscribers) {
        await messageService.sendNotification({
          type: 'CASE_ROBOT_REMINDER',
          target_user_id: subscriber.user_id,
          case_id: caseData.id,
          title: `案件进程提醒 - ${caseData.case_number}`,
          content: content,
          priority: days <= 3 ? 'HIGH' : 'NORMAL',
          action_link: `/cases/${String(caseData.id).split(':')[1]}`,
          sender_name: `案件机器人 (${caseData.case_number})`
        });
      }
      
      console.log(`Sent reminders for case ${caseData.case_number} to ${subscribers.length} subscribers`);
    } catch (error) {
      console.error('Error sending reminder:', error);
      throw error;
    }
  }
  
  /**
   * Calculate days for message template
   */
  private async calculateDaysForMessage(caseData: CaseData, procedurePhase: string): Promise<number> {
    const now = new Date();
    let days = 0;
    
    switch (procedurePhase) {
      case '立案':
        if (caseData.acceptance_date) {
          const acceptanceDate = new Date(caseData.acceptance_date);
          const deadlineDate = new Date(acceptanceDate);
          deadlineDate.setDate(deadlineDate.getDate() + 25);
          days = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }
        break;
        
      case '公告':
        if (caseData.announcement_date) {
          const announcementDate = new Date(caseData.announcement_date);
          const deadlineDate = new Date(announcementDate);
          deadlineDate.setDate(deadlineDate.getDate() + 30);
          days = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }
        break;
        
      case '债权申报':
        if (caseData.announcement_date) {
          const announcementDate = new Date(caseData.announcement_date);
          const deadlineDate = new Date(announcementDate);
          deadlineDate.setMonth(deadlineDate.getMonth() + 3);
          days = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }
        break;
        
      case '债权人第一次会议':
        if (caseData.claim_submission_end_date) {
          const submissionEndDate = new Date(caseData.claim_submission_end_date);
          const deadlineDate = new Date(submissionEndDate);
          deadlineDate.setDate(deadlineDate.getDate() + 15);
          days = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }
        break;
        
      case '裁定重整':
        if (caseData.reorganization_ruling_date) {
          const rulingDate = new Date(caseData.reorganization_ruling_date);
          const deadlineDate = new Date(rulingDate);
          deadlineDate.setMonth(deadlineDate.getMonth() + 6);
          days = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }
        break;
        
      case '延迟提交重整计划':
        if (caseData.delayed_reorganization_plan_submission_date) {
          const delayedDate = new Date(caseData.delayed_reorganization_plan_submission_date);
          const deadlineDate = new Date(delayedDate);
          deadlineDate.setMonth(deadlineDate.getMonth() + 3);
          days = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }
        break;
        
      case '债权人第二次会议':
        if (caseData.reorganization_plan_submission_date) {
          const planDate = new Date(caseData.reorganization_plan_submission_date);
          const deadlineDate = new Date(planDate);
          deadlineDate.setDate(deadlineDate.getDate() + 15);
          days = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }
        break;
    }
    
    return Math.max(days, 0);
  }
  
  /**
   * Subscribe user to case bot when case is created
   */
  async subscribeToCaseBotOnCaseCreation(caseId: RecordId | string, userId: RecordId | string) {
    try {
      await messageService.subscribeToCaseBot(caseId);
      console.log(`User ${userId} subscribed to case bot for case ${caseId}`);
    } catch (error) {
      console.error('Error subscribing to case bot:', error);
      throw error;
    }
  }
}

export const caseReminderService = new CaseReminderService();