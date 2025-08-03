import { RecordId, Uuid } from 'surrealdb';
import { useSurrealClientSingleton, TenantCodeMissingError } from '@/src/contexts/SurrealProvider';
import type { SurrealWorkerAPI } from '@/src/contexts/SurrealProvider';
import type { ConferenceInviteResponse } from '@/src/types/message';

// Types
export interface CreateConversationData {
  type: 'DIRECT' | 'GROUP' | 'SYSTEM';
  name?: string;
  description?: string;
  avatar_url?: string;
  case_id?: RecordId | string;
  participants: (RecordId | string)[];
}

export interface SendMessageData {
  conversation_id: RecordId | string;
  content: string;
  attachments?: {
    file_name: string;
    file_type: string;
    file_size: number;
    mime_type: string;
    s3_object_key: string;
    thumbnail_url?: string;
  }[];
}

export interface SendNotificationData {
  type: 'CASE_ROBOT_REMINDER' | 'BUSINESS_NOTIFICATION' | 'SYSTEM_NOTIFICATION';
  target_user_id?: RecordId | string;
  case_id?: RecordId | string;
  title?: string;
  content: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  action_link?: string;
  sender_name: string;
}

export interface MarkAsReadData {
  message_ids: (RecordId | string)[];
}

// Conference invitation data interface
export interface SendConferenceInviteData {
  target_user_ids: (RecordId | string)[]; // Users to invite
  conference_title: string; // Meeting title
  conference_description?: string; // Optional description
  call_type: 'audio' | 'video'; // Type of call
  scheduled_start_time?: string; // ISO datetime for scheduled meetings
  scheduled_duration?: number; // Duration in minutes
  is_immediate: boolean; // Whether it's immediate or scheduled
  case_id?: RecordId | string; // Optional case link
  group_id?: RecordId | string; // Optional group link
  expires_in_minutes?: number; // How long invitation is valid (default: 30 minutes)
  metadata?: {
    max_participants?: number;
    require_audio?: boolean;
    require_video?: boolean;
    allow_screen_share?: boolean;
    record_meeting?: boolean;
    meeting_password?: string;
  };
}

// Conference invitation response data interface
export interface RespondToConferenceInviteData {
  message_id: RecordId | string; // Original invitation message ID
  response: 'accepted' | 'declined'; // Response type
  response_message?: string; // Optional message from responder
}

// Group message data interfaces
export interface SendGroupMessageData {
  group_id: RecordId | string;
  content: string;
  message_type?: 'TEXT' | 'IMAGE' | 'FILE' | 'AUDIO' | 'VIDEO' | 'SYSTEM';
  reply_to_message_id?: RecordId | string; // Reply to another message
  mentions?: (RecordId | string)[]; // Users mentioned in the message
  attachments?: {
    file_name: string;
    file_type: string;
    file_size: number;
    mime_type: string;
    s3_object_key: string;
    thumbnail_url?: string;
  }[];
  metadata?: {
    is_pinned?: boolean;
    pin_expires_at?: string;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    [key: string]: any;
  };
}

export interface PinMessageData {
  message_id: RecordId | string;
  group_id: RecordId | string;
  pin_duration_hours?: number; // Optional expiration time for pin
  reason?: string; // Optional reason for pinning
}

export interface MarkGroupMessageAsReadData {
  group_id: RecordId | string;
  last_read_message_id?: RecordId | string;
  read_up_to_time?: string; // ISO datetime
}

export interface SearchGroupMessagesData {
  group_id: RecordId | string;
  query: string;
  message_type?: 'TEXT' | 'IMAGE' | 'FILE' | 'AUDIO' | 'VIDEO';
  from_user_id?: RecordId | string;
  start_date?: string; // ISO date
  end_date?: string; // ISO date
  limit?: number;
  offset?: number;
}

class MessageService {
  private clientGetter: () => Promise<SurrealWorkerAPI> | null = null;
  
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
        throw new Error('SurrealDB client not available. Ensure MessageService is properly initialized with setClientGetter.');
      }
    }
    
    return await this.clientGetter();
  }
  /**
   * Create a new conversation
   */
  async createConversation(data: CreateConversationData) {
    try {
      const conversationData = {
        type: data.type,
        name: data.name,
        description: data.description,
        avatar_url: data.avatar_url,
        case_id: data.case_id ? new RecordId('case', String(data.case_id).split(':')[1]) : undefined,
        participants: data.participants.map(p => 
          typeof p === 'string' ? new RecordId('user', p.split(':')[1]) : p
        ),
        created_by: '$auth.id',
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const client = await this.getClient();
      const [conversation] = await client.create('conversation', conversationData);

      // Create conversation_participant records for each participant
      for (const participantId of data.participants) {
        const participantData = {
          conversation_id: conversation.id,
          user_id: typeof participantId === 'string' ? new RecordId('user', participantId.split(':')[1]) : participantId,
          role: 'MEMBER',
          joined_at: new Date().toISOString(),
          unread_count: 0,
          is_muted: false,
          notification_preference: 'ALL',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await client.create('conversation_participant', participantData);
      }

      return conversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(data: SendMessageData) {
    try {
      const client = await this.getClient();
      
      const messageData = {
        type: 'IM',
        conversation_id: typeof data.conversation_id === 'string' ? 
          new RecordId('conversation', data.conversation_id.split(':')[1]) : data.conversation_id,
        sender_id: '$auth.id',
        sender_name: '$auth.name',
        content: data.content,
        is_read: false,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const [message] = await client.create('message', messageData);

      // Create attachments if any
      if (data.attachments && data.attachments.length > 0) {
        for (const attachment of data.attachments) {
          await client.create('message_attachment', {
            message_id: message.id,
            ...attachment,
            created_at: new Date().toISOString()
          });
        }
      }

      // Update conversation's last_message_at
      await client.merge(String(data.conversation_id), {
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Update unread count for other participants
      const query = `
        UPDATE conversation_participant 
        SET unread_count = unread_count + 1, updated_at = time::now()
        WHERE conversation_id = $conversation_id 
        AND user_id != $auth.id
      `;
      await client.query(query, { conversation_id: data.conversation_id });

      return message;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Send a notification (system message)
   */
  async sendNotification(data: SendNotificationData) {
    try {
      const client = await this.getClient();
      
      // Get or create bot user for case robot reminders
      let senderId: RecordId | string = 'user:system';
      let senderName = data.sender_name;
      
      if (data.type === 'CASE_ROBOT_REMINDER' && data.case_id) {
        const caseBot = await this.getOrCreateCaseBot(data.case_id);
        senderId = caseBot.bot_user_id;
        senderName = caseBot.bot_name;
      }

      const messageData = {
        type: data.type,
        sender_id: senderId,
        sender_name: senderName,
        target_user_id: data.target_user_id ? 
          (typeof data.target_user_id === 'string' ? 
            new RecordId('user', data.target_user_id.split(':')[1]) : data.target_user_id) : undefined,
        case_id: data.case_id ? 
          (typeof data.case_id === 'string' ? 
            new RecordId('case', data.case_id.split(':')[1]) : data.case_id) : undefined,
        title: data.title,
        content: data.content,
        priority: data.priority || 'NORMAL',
        action_link: data.action_link,
        is_read: false,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const [message] = await client.create('message', messageData);
      return message;
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Mark messages as read
   */
  async markAsRead(data: MarkAsReadData) {
    try {
      const client = await this.getClient();
      
      const promises = data.message_ids.map(async (messageId) => {
        const id = typeof messageId === 'string' ? messageId : String(messageId);
        
        // Update message
        await client.merge(id, {
          is_read: true,
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        // Get message to find conversation
        const [message] = await client.query(`SELECT conversation_id FROM ${id}`);
        
        if (message?.conversation_id) {
          // Update unread count in conversation_participant
          const query = `
            UPDATE conversation_participant 
            SET unread_count = math::max(unread_count - 1, 0), 
                last_read_at = time::now(),
                updated_at = time::now()
            WHERE conversation_id = $conversation_id 
            AND user_id = $auth.id
          `;
          await client.query(query, { conversation_id: message.conversation_id });
        }
      });

      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }

  /**
   * Archive messages
   */
  async archiveMessages(messageIds: (RecordId | string)[]) {
    try {
      const client = await this.getClient();
      
      const promises = messageIds.map(async (messageId) => {
        const id = typeof messageId === 'string' ? messageId : String(messageId);
        
        await client.merge(id, {
          is_archived: true,
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      });

      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error('Error archiving messages:', error);
      throw error;
    }
  }

  /**
   * Delete messages
   */
  async deleteMessages(messageIds: (RecordId | string)[]) {
    try {
      const client = await this.getClient();
      
      const promises = messageIds.map(async (messageId) => {
        const id = typeof messageId === 'string' ? messageId : String(messageId);
        
        // Delete attachments first
        await client.query('DELETE message_attachment WHERE message_id = $message_id', {
          message_id: new RecordId('message', id.split(':')[1])
        });
        
        // Delete message
        await client.delete(id);
      });

      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error('Error deleting messages:', error);
      throw error;
    }
  }

  /**
   * Get or create case bot
   */
  private async getOrCreateCaseBot(caseId: RecordId | string) {
    try {
      const client = await this.getClient();
      const caseIdRecord = typeof caseId === 'string' ? 
        new RecordId('case', caseId.split(':')[1]) : caseId;
      
      // Check if bot already exists
      const [existingBot] = await client.query(
        'SELECT * FROM case_bot WHERE case_id = $case_id',
        { case_id: caseIdRecord }
      );

      if (existingBot) {
        return existingBot;
      }

      // Get case details
      const [caseData] = await client.query(`SELECT case_number, name FROM ${String(caseIdRecord)}`);
      
      // Create bot user
      const botUserData = {
        name: `案件机器人 (${caseData.case_number})`,
        username: `case_bot_${caseData.case_number}`,
        email: `case_bot_${caseData.case_number}@system.local`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const [botUser] = await client.create('user', botUserData);

      // Create case bot
      const caseBotData = {
        case_id: caseIdRecord,
        bot_user_id: botUser.id,
        bot_name: botUserData.name,
        avatar_url: '/images/case-bot-avatar.png',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const [caseBot] = await client.create('case_bot', caseBotData);
      return caseBot;
    } catch (error) {
      console.error('Error creating case bot:', error);
      throw error;
    }
  }

  /**
   * Subscribe to case bot
   */
  async subscribeToCaseBot(caseId: RecordId | string) {
    try {
      const client = await this.getClient();
      const caseBot = await this.getOrCreateCaseBot(caseId);
      
      const subscriptionData = {
        case_bot_id: caseBot.id,
        user_id: '$auth.id',
        subscribed_at: new Date().toISOString()
      };

      const [subscription] = await client.create('case_bot_subscription', subscriptionData);
      return subscription;
    } catch (error) {
      console.error('Error subscribing to case bot:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from case bot
   */
  async unsubscribeFromCaseBot(caseBotId: RecordId | string) {
    try {
      const client = await this.getClient();
      
      const query = `
        DELETE case_bot_subscription 
        WHERE case_bot_id = $case_bot_id 
        AND user_id = $auth.id
      `;
      
      await client.query(query, { 
        case_bot_id: typeof caseBotId === 'string' ? 
          new RecordId('case_bot', caseBotId.split(':')[1]) : caseBotId 
      });
      
      return true;
    } catch (error) {
      console.error('Error unsubscribing from case bot:', error);
      throw error;
    }
  }

  /**
   * Setup live query for messages
   */
  async setupMessageLiveQuery(
    conversationId: RecordId | string | null, 
    callback: (action: string, result: any) => void
  ): Promise<Uuid | null> {
    try {
      const client = await this.getClient();
      
      let query: string;
      const params: any = {};
      
      // FIXED: LIVE SELECT without parameters or ORDER BY (SurrealDB limitations)
      query = 'LIVE SELECT * FROM message;';
      
      // Create a filtering wrapper for the callback
      const originalCallback = callback;
      const filteredCallback = (action: string, data: any) => {
        // Client-side filtering based on the original query intent
        if (conversationId) {
          // Filter for specific conversation
          const targetConversationId = typeof conversationId === 'string' ? 
            new RecordId('conversation', conversationId.split(':')[1]) : conversationId;
          
          if (data && data.conversation_id && data.conversation_id.toString() === targetConversationId.toString()) {
            originalCallback(action, data);
          }
        } else {
          // Filter for user's notifications (simplified - would need auth context for full filtering)
          if (data && (data.type === 'CASE_ROBOT_REMINDER' || data.type === 'BUSINESS_NOTIFICATION' || data.type === 'CONFERENCE_INVITE')) {
            originalCallback(action, data);
          }
        }
      };
      
      callback = filteredCallback;
      
      const queryUuid = await client.live(query, callback); // No params for LIVE queries
      return queryUuid;
    } catch (error) {
      console.error('Error setting up message live query:', error);
      return null;
    }
  }

  // ====================== 会议邀请相关方法 ======================

  /**
   * Send a conference invitation
   */
  async sendConferenceInvite(data: SendConferenceInviteData) {
    try {
      const client = await this.getClient();
      
      // Generate unique conference ID
      const conferenceId = `conf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Calculate expiration time
      const expiresInMinutes = data.expires_in_minutes || 30;
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();
      
      // Prepare target user IDs
      const targetUserIds = data.target_user_ids.map(id => 
        typeof id === 'string' ? new RecordId('user', id.split(':')[1]) : id
      );

      const messageData = {
        type: 'CONFERENCE_INVITE',
        sender_id: '$auth.id',
        sender_name: '$auth.name',
        target_user_ids: targetUserIds,
        conference_id: conferenceId,
        conference_title: data.conference_title,
        conference_description: data.conference_description,
        call_type: data.call_type,
        scheduled_start_time: data.scheduled_start_time,
        scheduled_duration: data.scheduled_duration,
        is_immediate: data.is_immediate,
        case_id: data.case_id ? 
          (typeof data.case_id === 'string' ? 
            new RecordId('case', data.case_id.split(':')[1]) : data.case_id) : undefined,
        group_id: data.group_id ? 
          (typeof data.group_id === 'string' ? 
            new RecordId('group', data.group_id.split(':')[1]) : data.group_id) : undefined,
        invitation_status: 'pending',
        expires_at: expiresAt,
        metadata: data.metadata,
        content: this.generateConferenceInviteContent(data),
        is_read: false,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const [message] = await client.create('message', messageData);

      // Create individual conference invitation records for each target user
      for (const targetUserId of targetUserIds) {
        await client.create('conference_invitation', {
          message_id: message.id,
          conference_id: conferenceId,
          sender_id: '$auth.id',
          target_user_id: targetUserId,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      return { message, conference_id: conferenceId };
    } catch (error) {
      console.error('Error sending conference invitation:', error);
      throw error;
    }
  }

  /**
   * Respond to a conference invitation
   */
  async respondToConferenceInvite(data: RespondToConferenceInviteData) {
    try {
      const client = await this.getClient();
      
      // Get the original invitation message
      const messageId = typeof data.message_id === 'string' ? data.message_id : String(data.message_id);
      const [inviteMessage] = await client.query(`SELECT * FROM ${messageId}`);
      
      if (!inviteMessage) {
        throw new Error('Conference invitation not found');
      }

      if (inviteMessage.type !== 'CONFERENCE_INVITE') {
        throw new Error('Message is not a conference invitation');
      }

      // Check if invitation has expired
      if (inviteMessage.expires_at && new Date(inviteMessage.expires_at) < new Date()) {
        throw new Error('Conference invitation has expired');
      }

      // Update the invitation status in the conference_invitation record
      const updateQuery = `
        UPDATE conference_invitation 
        SET status = $status, 
            response_message = $response_message,
            responded_at = time::now(),
            updated_at = time::now()
        WHERE message_id = $message_id 
        AND target_user_id = $auth.id
      `;
      
      await client.query(updateQuery, {
        message_id: new RecordId('message', messageId.split(':')[1]),
        status: data.response,
        response_message: data.response_message
      });

      // Create a response message/notification
      const responseData = {
        type: 'BUSINESS_NOTIFICATION',
        sender_id: '$auth.id',
        sender_name: '$auth.name',
        target_user_id: inviteMessage.sender_id,
        title: `会议邀请${data.response === 'accepted' ? '已接受' : '已拒绝'}`,
        content: `${data.response === 'accepted' ? '接受了' : '拒绝了'}您的会议邀请：${inviteMessage.conference_title}${data.response_message ? `\n回复：${data.response_message}` : ''}`,
        case_id: inviteMessage.case_id,
        priority: 'NORMAL',
        is_read: false,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const [responseMessage] = await client.create('message', responseData);

      // If accepted and it's an immediate call, create the conference
      if (data.response === 'accepted' && inviteMessage.is_immediate) {
        // 这里可以触发会议创建逻辑
        // 可以通过事件系统通知CallManager创建会议
      }

      return {
        success: true,
        conference_id: inviteMessage.conference_id,
        response: data.response,
        response_message: responseMessage
      };
    } catch (error) {
      console.error('Error responding to conference invitation:', error);
      throw error;
    }
  }

  /**
   * Cancel a conference invitation
   */
  async cancelConferenceInvite(messageId: RecordId | string, reason?: string) {
    try {
      const client = await this.getClient();
      
      const id = typeof messageId === 'string' ? messageId : String(messageId);
      const [inviteMessage] = await client.query(`SELECT * FROM ${id}`);
      
      if (!inviteMessage) {
        throw new Error('Conference invitation not found');
      }

      if (inviteMessage.type !== 'CONFERENCE_INVITE') {
        throw new Error('Message is not a conference invitation');
      }

      // Update the message status
      await client.merge(id, {
        invitation_status: 'cancelled',
        updated_at: new Date().toISOString()
      });

      // Update all related conference_invitation records
      const updateQuery = `
        UPDATE conference_invitation 
        SET status = 'cancelled',
            response_message = $reason,
            updated_at = time::now()
        WHERE message_id = $message_id
      `;
      
      await client.query(updateQuery, {
        message_id: new RecordId('message', id.split(':')[1]),
        reason: reason || '会议已取消'
      });

      // Send cancellation notifications to all invitees
      for (const targetUserId of inviteMessage.target_user_ids) {
        const cancelNotificationData = {
          type: 'BUSINESS_NOTIFICATION',
          sender_id: '$auth.id',
          sender_name: '$auth.name',
          target_user_id: targetUserId,
          title: '会议已取消',
          content: `会议"${inviteMessage.conference_title}"已被取消${reason ? `\n原因：${reason}` : ''}`,
          case_id: inviteMessage.case_id,
          priority: 'NORMAL',
          is_read: false,
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await client.create('message', cancelNotificationData);
      }

      return true;
    } catch (error) {
      console.error('Error cancelling conference invitation:', error);
      throw error;
    }
  }

  /**
   * Get conference invitation status
   */
  async getConferenceInviteStatus(conferenceId: string) {
    try {
      const client = await this.getClient();
      
      const query = `
        SELECT 
          message.* as invitation,
          conference_invitation.status,
          conference_invitation.target_user_id,
          conference_invitation.responded_at,
          conference_invitation.response_message
        FROM message 
        JOIN conference_invitation ON conference_invitation.message_id = message.id
        WHERE message.conference_id = $conference_id
        AND message.type = 'CONFERENCE_INVITE'
      `;
      
      const results = await client.query(query, { conference_id: conferenceId });
      
      if (!results || results.length === 0) {
        return null;
      }

      const invitation = results[0].invitation;
      const responses = results.map(r => ({
        target_user_id: r.target_user_id,
        status: r.status,
        responded_at: r.responded_at,
        response_message: r.response_message
      }));

      return {
        invitation,
        responses,
        total_invites: responses.length,
        accepted_count: responses.filter(r => r.status === 'accepted').length,
        declined_count: responses.filter(r => r.status === 'declined').length,
        pending_count: responses.filter(r => r.status === 'pending').length
      };
    } catch (error) {
      console.error('Error getting conference invite status:', error);
      throw error;
    }
  }

  /**
   * Get user's pending conference invitations
   */
  async getPendingConferenceInvites(userId?: RecordId | string) {
    try {
      const client = await this.getClient();
      
      const query = `
        SELECT 
          message.*,
          conference_invitation.status,
          conference_invitation.responded_at
        FROM message 
        JOIN conference_invitation ON conference_invitation.message_id = message.id
        WHERE message.type = 'CONFERENCE_INVITE'
        AND conference_invitation.target_user_id = $user_id
        AND conference_invitation.status = 'pending'
        AND (message.expires_at IS NULL OR message.expires_at > time::now())
        ORDER BY message.created_at DESC
      `;
      
      const userIdRecord = userId ? 
        (typeof userId === 'string' ? new RecordId('user', userId.split(':')[1]) : userId) :
        '$auth.id';
      
      const results = await client.query(query, { user_id: userIdRecord });
      return results || [];
    } catch (error) {
      console.error('Error getting pending conference invites:', error);
      throw error;
    }
  }

  /**
   * Generate conference invitation content
   */
  private generateConferenceInviteContent(data: SendConferenceInviteData): string {
    let content = `📞 会议邀请：${data.conference_title}\n`;
    
    if (data.conference_description) {
      content += `📝 描述：${data.conference_description}\n`;
    }
    
    content += `🎥 类型：${data.call_type === 'video' ? '视频会议' : '语音会议'}\n`;
    
    if (data.is_immediate) {
      content += `⏰ 时间：立即开始\n`;
    } else if (data.scheduled_start_time) {
      const startTime = new Date(data.scheduled_start_time);
      content += `⏰ 时间：${startTime.toLocaleString()}\n`;
      
      if (data.scheduled_duration) {
        content += `⏱️ 时长：${data.scheduled_duration}分钟\n`;
      }
    }
    
    if (data.metadata?.max_participants) {
      content += `👥 最大参与者：${data.metadata.max_participants}人\n`;
    }
    
    content += `\n请点击接受或拒绝此邀请。`;
    
    return content;
  }

  // ========================================
  // GROUP MESSAGE FUNCTIONALITY
  // ========================================

  /**
   * 发送群组消息
   */
  async sendGroupMessage(data: SendGroupMessageData) {
    try {
      const client = await this.getClient();
      
      // 验证用户是否有发送消息的权限
      const memberQuery = `
        SELECT * FROM group_member 
        WHERE group_id = $group_id AND user_id = $auth.id
      `;
      
      const [member] = await client.query(memberQuery, {
        group_id: typeof data.group_id === 'string' ? data.group_id : String(data.group_id)
      });
      
      if (!member) {
        throw new Error('您不是此群组成员');
      }
      
      // 检查用户是否被静音
      if (member.is_muted) {
        throw new Error('您在此群组中被静音');
      }
      
      // 检查群组权限
      const hasPermission = await this.checkGroupMessagePermission(data.group_id, 'send_message');
      if (!hasPermission) {
        throw new Error('您没有在此群组中发送消息的权限');
      }
      
      const now = new Date().toISOString();
      
      // 处理@提及
      const processedContent = data.content;
      const mentionedUsers: string[] = [];
      
      if (data.mentions && data.mentions.length > 0) {
        // 验证被提及的用户都是群组成员
        const mentionQuery = `
          SELECT user_id FROM group_member 
          WHERE group_id = $group_id AND user_id IN $user_ids
        `;
        
        const mentionResults = await client.query(mentionQuery, {
          group_id: typeof data.group_id === 'string' ? data.group_id : String(data.group_id),
          user_ids: data.mentions.map(id => typeof id === 'string' ? id : String(id))
        });
        
        mentionedUsers.push(...mentionResults.map((r: any) => String(r.user_id)));
      }
      
      // 创建消息记录
      const messageData = {
        content: processedContent,
        message_type: data.message_type || 'TEXT',
        group_id: typeof data.group_id === 'string' ? new RecordId('message_group', data.group_id.split(':')[1]) : data.group_id,
        sender_id: '$auth.id',
        reply_to_message_id: data.reply_to_message_id ? 
          (typeof data.reply_to_message_id === 'string' ? new RecordId('message', data.reply_to_message_id.split(':')[1]) : data.reply_to_message_id) : undefined,
        mentions: mentionedUsers.length > 0 ? mentionedUsers : undefined,
        attachments: data.attachments,
        metadata: {
          ...data.metadata,
          is_group_message: true
        },
        created_at: now,
        updated_at: now,
        is_deleted: false
      };
      
      const [message] = await client.create('message', messageData);
      
      // 如果消息需要置顶，创建置顶记录
      if (data.metadata?.is_pinned) {
        await this.pinGroupMessage({
          message_id: message.id,
          group_id: data.group_id,
          pin_duration_hours: data.metadata.pin_expires_at ? 
            Math.ceil((new Date(data.metadata.pin_expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60)) : undefined
        });
      }
      
      // 发送提及通知
      if (mentionedUsers.length > 0) {
        await this.sendMentionNotifications(message.id, mentionedUsers, data.content);
      }
      
      return message;
    } catch (error) {
      console.error('Error sending group message:', error);
      throw error;
    }
  }
  
  /**
   * 置顶群组消息
   */
  async pinGroupMessage(data: PinMessageData) {
    try {
      const client = await this.getClient();
      
      // 检查置顶权限
      const hasPermission = await this.checkGroupMessagePermission(data.group_id, 'pin_message');
      if (!hasPermission) {
        throw new Error('您没有置顶消息的权限');
      }
      
      const now = new Date().toISOString();
      let expiresAt;
      
      if (data.pin_duration_hours) {
        const expiration = new Date();
        expiration.setHours(expiration.getHours() + data.pin_duration_hours);
        expiresAt = expiration.toISOString();
      }
      
      // 更新消息的置顶状态
      const updateQuery = `
        UPDATE message SET 
          metadata.is_pinned = true,
          metadata.pinned_at = $pinned_at,
          metadata.pinned_by = $auth.id,
          metadata.pin_expires_at = $expires_at,
          metadata.pin_reason = $reason,
          updated_at = $updated_at
        WHERE id = $message_id AND group_id = $group_id
        RETURN *
      `;
      
      const [pinnedMessage] = await client.query(updateQuery, {
        message_id: typeof data.message_id === 'string' ? data.message_id : String(data.message_id),
        group_id: typeof data.group_id === 'string' ? data.group_id : String(data.group_id),
        pinned_at: now,
        expires_at: expiresAt,
        reason: data.reason,
        updated_at: now
      });
      
      if (!pinnedMessage) {
        throw new Error('消息不存在或不属于此群组');
      }
      
      // 发送系统通知
      await this.sendGroupSystemMessage(data.group_id, `消息已被置顶${expiresAt ? ` (${data.pin_duration_hours}小时)` : ''}`);
      
      return pinnedMessage;
    } catch (error) {
      console.error('Error pinning group message:', error);
      throw error;
    }
  }
  
  /**
   * 取消置顶群组消息
   */
  async unpinGroupMessage(messageId: RecordId | string, groupId: RecordId | string) {
    try {
      const client = await this.getClient();
      
      // 检查取消置顶权限
      const hasPermission = await this.checkGroupMessagePermission(groupId, 'pin_message');
      if (!hasPermission) {
        throw new Error('您没有取消置顶消息的权限');
      }
      
      const updateQuery = `
        UPDATE message SET 
          metadata.is_pinned = false,
          metadata.unpinned_at = $unpinned_at,
          metadata.unpinned_by = $auth.id,
          updated_at = $updated_at
        WHERE id = $message_id AND group_id = $group_id
        RETURN *
      `;
      
      const [unpinnedMessage] = await client.query(updateQuery, {
        message_id: typeof messageId === 'string' ? messageId : String(messageId),
        group_id: typeof groupId === 'string' ? groupId : String(groupId),
        unpinned_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      if (!unpinnedMessage) {
        throw new Error('消息不存在或不属于此群组');
      }
      
      // 发送系统通知
      await this.sendGroupSystemMessage(groupId, '消息置顶已取消');
      
      return unpinnedMessage;
    } catch (error) {
      console.error('Error unpinning group message:', error);
      throw error;
    }
  }
  
  /**
   * 标记群组消息为已读
   */
  async markGroupMessagesAsRead(data: MarkGroupMessageAsReadData) {
    try {
      const client = await this.getClient();
      
      // 验证用户是否是群组成员
      const memberQuery = `
        SELECT * FROM group_member 
        WHERE group_id = $group_id AND user_id = $auth.id
      `;
      
      const [member] = await client.query(memberQuery, {
        group_id: typeof data.group_id === 'string' ? data.group_id : String(data.group_id)
      });
      
      if (!member) {
        throw new Error('您不是此群组成员');
      }
      
      const now = new Date().toISOString();
      const readTime = data.read_up_to_time || now;
      
      // 更新群组读取位置
      const upsertQuery = `
        UPDATE group_read_position 
        SET 
          last_read_message_id = $last_read_message_id,
          last_read_time = $read_time,
          unread_count = 0,
          updated_at = $updated_at
        WHERE group_id = $group_id AND user_id = $auth.id
        RETURN AFTER
      `;
      
      let result = await client.query(upsertQuery, {
        group_id: typeof data.group_id === 'string' ? data.group_id : String(data.group_id),
        last_read_message_id: data.last_read_message_id,
        read_time: readTime,
        updated_at: now
      });
      
      // 如果记录不存在，创建新记录
      if (!result || result.length === 0) {
        const createQuery = `
          CREATE group_read_position SET
            group_id = $group_id,
            user_id = $auth.id,
            last_read_message_id = $last_read_message_id,
            last_read_time = $read_time,
            unread_count = 0
        `;
        
        result = await client.query(createQuery, {
          group_id: typeof data.group_id === 'string' ? data.group_id : String(data.group_id),
          last_read_message_id: data.last_read_message_id,
          read_time: readTime
        });
      }
      
      // 更新群组成员的最后已读时间
      await client.query(`
        UPDATE group_member 
        SET last_read_at = $read_time, updated_at = $updated_at
        WHERE group_id = $group_id AND user_id = $auth.id
      `, {
        group_id: typeof data.group_id === 'string' ? data.group_id : String(data.group_id),
        read_time: readTime,
        updated_at: now
      });
      
      return result[0];
    } catch (error) {
      console.error('Error marking group messages as read:', error);
      throw error;
    }
  }
  
  /**
   * 搜索群组消息
   */
  async searchGroupMessages(data: SearchGroupMessagesData) {
    try {
      const client = await this.getClient();
      
      // 验证用户是否是群组成员
      const memberQuery = `
        SELECT * FROM group_member 
        WHERE group_id = $group_id AND user_id = $auth.id
      `;
      
      const [member] = await client.query(memberQuery, {
        group_id: typeof data.group_id === 'string' ? data.group_id : String(data.group_id)
      });
      
      if (!member) {
        throw new Error('您不是此群组成员');
      }
      
      // 构建搜索查询
      const whereConditions = [
        `group_id = $group_id`,
        `is_deleted = false`
      ];
      
      const queryParams: any = {
        group_id: typeof data.group_id === 'string' ? data.group_id : String(data.group_id),
        limit: data.limit || 50,
        offset: data.offset || 0
      };
      
      // 全文搜索条件
      if (data.query) {
        whereConditions.push(`content @@ $search_query`);
        queryParams.search_query = data.query;
      }
      
      // 消息类型过滤
      if (data.message_type) {
        whereConditions.push(`message_type = $message_type`);
        queryParams.message_type = data.message_type;
      }
      
      // 发送者过滤
      if (data.from_user_id) {
        whereConditions.push(`sender_id = $from_user_id`);
        queryParams.from_user_id = typeof data.from_user_id === 'string' ? data.from_user_id : String(data.from_user_id);
      }
      
      // 时间范围过滤
      if (data.start_date) {
        whereConditions.push(`created_at >= $start_date`);
        queryParams.start_date = data.start_date;
      }
      
      if (data.end_date) {
        whereConditions.push(`created_at <= $end_date`);
        queryParams.end_date = data.end_date;
      }
      
      const searchQuery = `
        SELECT 
          message.*,
          sender_id.name as sender_name,
          sender_id.avatar_url as sender_avatar
        FROM message
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $limit
        START $offset
      `;
      
      const results = await client.query(searchQuery, queryParams);
      
      return results || [];
    } catch (error) {
      console.error('Error searching group messages:', error);
      throw error;
    }
  }
  
  /**
   * 获取群组置顶消息
   */
  async getGroupPinnedMessages(groupId: RecordId | string) {
    try {
      const client = await this.getClient();
      
      // 验证用户是否是群组成员
      const memberQuery = `
        SELECT * FROM group_member 
        WHERE group_id = $group_id AND user_id = $auth.id
      `;
      
      const [member] = await client.query(memberQuery, {
        group_id: typeof groupId === 'string' ? groupId : String(groupId)
      });
      
      if (!member) {
        throw new Error('您不是此群组成员');
      }
      
      const query = `
        SELECT 
          message.*,
          sender_id.name as sender_name,
          sender_id.avatar_url as sender_avatar
        FROM message
        WHERE 
          group_id = $group_id AND 
          metadata.is_pinned = true AND
          (metadata.pin_expires_at IS NONE OR metadata.pin_expires_at > $now) AND
          is_deleted = false
        ORDER BY metadata.pinned_at DESC
      `;
      
      const pinnedMessages = await client.query(query, {
        group_id: typeof groupId === 'string' ? groupId : String(groupId),
        now: new Date().toISOString()
      });
      
      return pinnedMessages || [];
    } catch (error) {
      console.error('Error getting pinned messages:', error);
      throw error;
    }
  }
  
  /**
   * 获取群组未读消息数量
   */
  async getGroupUnreadCount(groupId: RecordId | string) {
    try {
      const client = await this.getClient();
      
      const query = `
        SELECT unread_count FROM group_read_position 
        WHERE group_id = $group_id AND user_id = $auth.id
      `;
      
      const [result] = await client.query(query, {
        group_id: typeof groupId === 'string' ? groupId : String(groupId)
      });
      
      return result?.unread_count || 0;
    } catch (error) {
      console.error('Error getting group unread count:', error);
      return 0;
    }
  }
  
  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================
  
  /**
   * 检查群组消息权限
   */
  private async checkGroupMessagePermission(groupId: RecordId | string, permission: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      
      const memberQuery = `
        SELECT role, permissions FROM group_member 
        WHERE group_id = $group_id AND user_id = $auth.id
      `;
      
      const [member] = await client.query(memberQuery, {
        group_id: typeof groupId === 'string' ? groupId : String(groupId)
      });
      
      if (!member) return false;
      
      // Owner和Admin有所有权限
      if (member.role === 'owner' || member.role === 'admin') {
        return true;
      }
      
      // 检查具体权限
      const permissions = member.permissions || {};
      
      switch (permission) {
        case 'send_message':
          return permissions.can_send_message !== false; // 默认允许
        case 'pin_message':
          return permissions.can_pin_message === true;
        case 'manage_settings':
          return permissions.can_manage_settings === true;
        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking group message permission:', error);
      return false;
    }
  }
  
  /**
   * 发送提及通知
   */
  private async sendMentionNotifications(messageId: RecordId | string, mentionedUsers: string[], content: string) {
    try {
      const client = await this.getClient();
      
      const notifications = mentionedUsers.map(userId => ({
        recipient_id: userId,
        type: 'GROUP_MENTION',
        title: '群组消息提及',
        content: `您在群组消息中被提及：${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
        data: {
          message_id: typeof messageId === 'string' ? messageId : String(messageId),
          mention_type: 'group_message'
        },
        created_at: new Date().toISOString()
      }));
      
      await Promise.all(
        notifications.map(notification => 
          client.create('notification', notification)
        )
      );
    } catch (error) {
      console.error('Error sending mention notifications:', error);
      // 不抛出错误，避免影响主流程
    }
  }
  
  /**
   * 发送群组系统消息
   */
  private async sendGroupSystemMessage(groupId: RecordId | string, content: string) {
    try {
      const client = await this.getClient();
      
      const systemMessage = {
        content,
        message_type: 'SYSTEM',
        group_id: typeof groupId === 'string' ? new RecordId('message_group', groupId.split(':')[1]) : groupId,
        sender_id: null, // 系统消息没有发送者
        metadata: {
          is_system_message: true,
          is_group_message: true
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false
      };
      
      await client.create('message', systemMessage);
    } catch (error) {
      console.error('Error sending group system message:', error);
      // 不抛出错误，避免影响主流程
    }
  }
}

export const messageService = new MessageService();