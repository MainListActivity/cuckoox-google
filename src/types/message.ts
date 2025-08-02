import { RecordId } from 'surrealdb'; // Assuming RecordId is used for IDs

// Base for all message types
export interface BaseMessage {
  id: RecordId | string; // Allow string for mock data flexibility, but DB uses RecordId
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
  is_read: boolean;
  case_id?: RecordId | string; // Optional link to a case
  content: string; // Main textual content
  priority?: 'high' | 'normal'; // generic priority, mainly for notifications
  title?: string; // optional title for notifications
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

// Specific type for Conference/Meeting Invitation Messages
export interface ConferenceInviteMessage extends BaseMessage {
  type: 'CONFERENCE_INVITE';
  sender_id: RecordId | string; // User who sent the invitation
  sender_name: string; // Name of the person sending the invitation
  target_user_ids: (RecordId | string)[]; // Users being invited
  conference_id: string; // Unique conference identifier
  conference_title: string; // Meeting title/subject
  conference_description?: string; // Optional meeting description
  call_type: 'audio' | 'video'; // Type of conference call
  scheduled_start_time?: string; // ISO datetime string for scheduled meetings
  scheduled_duration?: number; // Duration in minutes for scheduled meetings
  is_immediate: boolean; // Whether it's an immediate call or scheduled
  case_id?: RecordId | string; // Optional link to related case
  group_id?: RecordId | string; // Optional link to related group
  invitation_status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  expires_at?: string; // ISO datetime string when invitation expires
  metadata?: {
    max_participants?: number;
    require_audio?: boolean;
    require_video?: boolean;
    allow_screen_share?: boolean;
    record_meeting?: boolean;
    meeting_password?: string;
  };
}

// Conference invitation response data
export interface ConferenceInviteResponse {
  message_id: RecordId | string; // Original invitation message ID
  conference_id: string; // Conference identifier
  response: 'accepted' | 'declined';
  response_message?: string; // Optional message from responder
  responded_at: string; // ISO datetime string
}

// Union type for any kind of message
export type Message = IMMessage | CaseRobotReminderMessage | BusinessNotificationMessage | ConferenceInviteMessage;

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
