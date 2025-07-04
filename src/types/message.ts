import { RecordId } from 'surrealdb'; // Assuming RecordId is used for IDs

// Base for all message types
export interface BaseMessage {
  id: RecordId | string; // Allow string for mock data flexibility, but DB uses RecordId
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
  is_read: boolean;
  case_id?: RecordId | string; // Optional link to a case
  content: string; // Main textual content
}

// Specific type for IM (Instant Messaging) messages
export interface IMMessage extends BaseMessage {
  type: 'IM';
  conversation_id: RecordId | string; // Link to a conversation record
  sender_id: RecordId | string; // Link to the user record of the sender
  sender_name?: string; // Denormalized for display, or fetched separately
  // receiver_id could be inferred from conversation_id if it's a 1-on-1 chat, or not needed for group chats
  attachments?: { file_name: string; url: string; type: string; size?: number }[];
}

// Specific type for Case Robot Reminders
export interface CaseRobotReminderMessage extends BaseMessage {
  type: 'CASE_ROBOT_REMINDER';
  sender_name: string; // e.g., "案件机器人 (BK-2023-001)"
  // Reminder-specific structured content can be added here or parsed from 'content'
  // For example:
  // reminder_type: 'DEADLINE_APPROACHING' | 'NEW_DOCUMENT' | ...;
  // related_entity_id?: RecordId | string;
  // action_link?: string;
}

// Specific type for general Business/System Notifications
export interface BusinessNotificationMessage extends BaseMessage {
  type: 'BUSINESS_NOTIFICATION';
  sender_name: string; // e.g., "系统通知" or module name
  target_user_id: RecordId | string; // User this notification is intended for
  title?: string; // Optional title for the notification
  severity?: 'info' | 'warning' | 'error' | 'success';
  action_link?: string;
}

// Union type for any kind of message
export type Message = IMMessage | CaseRobotReminderMessage | BusinessNotificationMessage;

// Interface for an IM Conversation summary (for the left panel list)
export interface ConversationSummary {
  id: RecordId | string; // Conversation ID
  participants: { id: RecordId | string; name: string }[]; // Simplified participant info
  last_message_snippet: string;
  last_message_timestamp: string; // ISO datetime string
  last_message_sender_name?: string;
  unread_count: number;
  avatar_url?: string; // Or some other way to represent the conversation visually
  is_group_chat?: boolean; 
}
