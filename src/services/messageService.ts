import { RecordId, Uuid } from 'surrealdb';
import { surrealClient } from '@/src/lib/surrealClient';

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

class MessageService {
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

      const client = await surrealClient();
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
      const client = await surrealClient();
      
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
      const client = await surrealClient();
      
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
      const client = await surrealClient();
      
      const promises = data.message_ids.map(async (messageId) => {
        const id = typeof messageId === 'string' ? messageId : String(messageId);
        
        // Update message
        await client.merge(id, {
          is_read: true,
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        // Get message to find conversation
        const [[message]] = await client.query(`SELECT conversation_id FROM ${id}`);
        
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
      const client = await surrealClient();
      
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
      const client = await surrealClient();
      
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
      const client = await surrealClient();
      const caseIdRecord = typeof caseId === 'string' ? 
        new RecordId('case', caseId.split(':')[1]) : caseId;
      
      // Check if bot already exists
      const [[existingBot]] = await client.query(
        'SELECT * FROM case_bot WHERE case_id = $case_id',
        { case_id: caseIdRecord }
      );

      if (existingBot) {
        return existingBot;
      }

      // Get case details
      const [[caseData]] = await client.query(`SELECT case_number, name FROM ${String(caseIdRecord)}`);
      
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
      const client = await surrealClient();
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
      const client = await surrealClient();
      
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
      const client = await surrealClient();
      
      let query: string;
      const params: any = {};
      
      if (conversationId) {
        // Live query for specific conversation
        query = 'LIVE SELECT * FROM message WHERE conversation_id = $conversation_id ORDER BY created_at DESC';
        params.conversation_id = typeof conversationId === 'string' ? 
          new RecordId('conversation', conversationId.split(':')[1]) : conversationId;
      } else {
        // Live query for all user's messages (notifications)
        query = `LIVE SELECT * FROM message WHERE 
          target_user_id = $auth.id OR 
          (type = 'CASE_ROBOT_REMINDER' AND case_id IN (
            SELECT case_id FROM case_bot_subscription WHERE user_id = $auth.id
          ))
          ORDER BY created_at DESC`;
      }
      
      const queryUuid = await client.live(query, callback, params);
      return queryUuid;
    } catch (error) {
      console.error('Error setting up message live query:', error);
      return null;
    }
  }
}

export const messageService = new MessageService();