import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecordId } from 'surrealdb';
import { messageService } from '@/src/services/messageService';
import type {
  CreateConversationData,
  SendMessageData,
  SendNotificationData,
  MarkAsReadData,
  SendConferenceInviteData,
  SendGroupMessageData,
  PinMessageData,
  MarkGroupMessageAsReadData,
  SearchGroupMessagesData
} from '@/src/services/messageService';

// Mock dependencies
const mockClient = {
  query: vi.fn(),
  create: vi.fn(),
  merge: vi.fn(),
  delete: vi.fn(),
  select: vi.fn()
};

vi.mock('@/src/contexts/SurrealProvider', () => ({
  useSurrealClientSingleton: () => ({
    surrealClient: () => Promise.resolve(mockClient)
  })
}));

vi.mock('@/src/services/signalingService');
vi.mock('@/src/services/p2pFileTransferService');

describe('MessageService', () => {
  const mockAuthResult = {
    id: new RecordId('user', 'test-user'),
    name: 'Test User'
  };

  const mockConversation = {
    id: new RecordId('conversation', 'test-conversation'),
    type: 'DIRECT',
    name: '测试对话',
    participants: [mockAuthResult.id, new RecordId('user', 'target-user')],
    created_by: mockAuthResult.id,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  };

  const mockMessage = {
    id: new RecordId('message', 'test-message'),
    conversation_id: mockConversation.id,
    content: '测试消息内容',
    sender_id: mockAuthResult.id,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    is_deleted: false,
    is_read: false
  };

  const mockGroupMessage = {
    id: new RecordId('group_message', 'group-message'),
    group_id: new RecordId('message_group', 'test-group'),
    content: '群组消息内容',
    sender_id: mockAuthResult.id,
    message_type: 'TEXT',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  };

  const mockNotification = {
    id: new RecordId('notification', 'test-notification'),
    type: 'SYSTEM_NOTIFICATION',
    title: '系统通知',
    content: '这是一条系统通知',
    target_user_id: mockAuthResult.id,
    priority: 'NORMAL',
    created_at: '2024-01-01T00:00:00.000Z',
    is_read: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // 设置默认认证状态和数据库查询响应
    mockClient.query.mockImplementation((query: string, _params?: any) => {
      if (query.includes('return $auth;')) {
        return Promise.resolve([mockAuthResult]);
      }
      // 模拟用户存在检查
      if (query.includes('SELECT * FROM user:')) {
        return Promise.resolve([{ id: new RecordId('user', 'target-user') }]);
      }
      // 模拟群组成员检查
      if (query.includes('SELECT * FROM message_group_member WHERE') || 
          query.includes('SELECT * FROM group_member WHERE')) {
        return Promise.resolve([{ 
          id: new RecordId('message_group_member', 'test-member'),
          group_id: new RecordId('message_group', 'test-group'),
          user_id: mockAuthResult.id,
          role: 'ADMIN',
          permissions: ['send_message', 'pin_message']
        }]);
      }
      // 模拟会话参与者检查
      if (query.includes('SELECT * FROM conversation_participant WHERE')) {
        return Promise.resolve([{
          id: new RecordId('conversation_participant', 'test-participant'),
          conversation_id: mockConversation.id,
          user_id: mockAuthResult.id,
          role: 'MEMBER'
        }]);
      }
      // 模拟会话存在检查
      if (query.includes('SELECT * FROM conversation WHERE')) {
        return Promise.resolve([mockConversation]);
      }
      // 模拟消息查询
      if (query.includes('SELECT * FROM message WHERE')) {
        return Promise.resolve([mockMessage]);
      }
      // 模拟群组消息查询
      if (query.includes('SELECT * FROM group_message WHERE')) {
        return Promise.resolve([mockGroupMessage]);
      }
      // 模拟案例数据查询
      if (query.includes('SELECT * FROM case WHERE')) {
        return Promise.resolve([{ 
          id: new RecordId('case', 'test-case'),
          case_number: 'CASE-001',
          title: '测试案例'
        }]);
      }
      return Promise.resolve([]);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('会话管理', () => {
    it('应该成功创建直接对话', async () => {
      // Arrange
      const conversationData: CreateConversationData = {
        type: 'DIRECT',
        participants: [new RecordId('user', 'target-user')]
      };

      mockClient.create.mockResolvedValueOnce([mockConversation]);
      mockClient.create.mockResolvedValueOnce([{
        id: new RecordId('conversation_participant', 'test-participant'),
        conversation_id: mockConversation.id,
        user_id: new RecordId('user', 'target-user'),
        role: 'MEMBER'
      }]);

      // Act
      const result = await messageService.createConversation(conversationData);

      // Assert
      expect(result).toEqual(mockConversation);
      expect(mockClient.create).toHaveBeenCalledTimes(2);
      expect(mockClient.create).toHaveBeenNthCalledWith(1, 'conversation', expect.objectContaining({
        type: 'DIRECT',
        created_by: '$auth.id'
      }));
      expect(mockClient.create).toHaveBeenNthCalledWith(2, 'conversation_participant', expect.objectContaining({
        conversation_id: mockConversation.id,
        user_id: new RecordId('user', 'target-user'),
        role: 'MEMBER'
      }));
    });

    it('应该成功创建群组对话', async () => {
      // Arrange
      const conversationData: CreateConversationData = {
        type: 'GROUP',
        name: '测试群组',
        description: '这是一个测试群组',
        participants: [
          new RecordId('user', 'user1'),
          new RecordId('user', 'user2')
        ]
      };

      const groupConversation = {
        ...mockConversation,
        type: 'GROUP',
        name: '测试群组',
        description: '这是一个测试群组'
      };

      mockClient.create.mockResolvedValue([groupConversation]);

      // Act
      const result = await messageService.createConversation(conversationData);

      // Assert
      expect(result.type).toBe('GROUP');
      expect(result.name).toBe('测试群组');
      expect(mockClient.create).toHaveBeenCalled();
    });

    it('用户未认证时应该抛出错误', async () => {
      // Arrange
      mockClient.query.mockResolvedValue([null]); // 未认证
      
      const conversationData: CreateConversationData = {
        type: 'DIRECT',
        participants: [new RecordId('user', 'target-user')]
      };

      // Act & Assert
      await expect(messageService.createConversation(conversationData))
        .rejects.toThrow('用户未认证');
    });

    it('参与者列表为空时应该抛出错误', async () => {
      // Arrange
      const conversationData: CreateConversationData = {
        type: 'DIRECT',
        participants: []
      };

      // Act & Assert
      await expect(messageService.createConversation(conversationData))
        .rejects.toThrow('参与者列表不能为空');
    });
  });

  describe('消息发送', () => {
    it('应该成功发送消息', async () => {
      // Arrange
      const messageData: SendMessageData = {
        conversation_id: mockConversation.id,
        content: '这是一条测试消息'
      };

      mockClient.create.mockResolvedValue([mockMessage]);

      // Act
      const result = await messageService.sendMessage(messageData);

      // Assert
      expect(result).toEqual(mockMessage);
      expect(mockClient.create).toHaveBeenCalledWith('message', expect.objectContaining({
        conversation_id: mockConversation.id,
        content: '这是一条测试消息',
        sender_id: '$auth.id'
      }));
    });

    it('应该成功发送带附件的消息', async () => {
      // Arrange
      const messageData: SendMessageData = {
        conversation_id: mockConversation.id,
        content: '带附件的消息',
        attachments: [{
          file_name: 'test.pdf',
          file_type: 'pdf',
          file_size: 1024000,
          mime_type: 'application/pdf',
          s3_object_key: 'attachments/test.pdf'
        }]
      };

      const messageWithAttachment = {
        ...mockMessage,
        content: '带附件的消息',
        attachments: messageData.attachments
      };

      mockClient.create.mockResolvedValue([messageWithAttachment]);

      // Act
      const result = await messageService.sendMessage(messageData);

      // Assert
      expect(result.attachments).toBeDefined();
      expect(result.attachments[0].file_name).toBe('test.pdf');
    });

    it('消息内容为空时应该抛出错误', async () => {
      // Arrange
      const messageData: SendMessageData = {
        conversation_id: mockConversation.id,
        content: ''
      };

      // Act & Assert
      await expect(messageService.sendMessage(messageData))
        .rejects.toThrow('消息内容不能为空');
    });

    it('会话不存在时应该抛出错误', async () => {
      // Arrange
      const messageData: SendMessageData = {
        conversation_id: new RecordId('conversation', 'nonexistent'),
        content: '测试消息'
      };

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('conversation')) {
          return Promise.resolve([]); // 会话不存在
        }
        return Promise.resolve([]);
      });

      // Act & Assert
      await expect(messageService.sendMessage(messageData))
        .rejects.toThrow('会话不存在');
    });
  });

  describe('群组消息', () => {
    it('应该成功发送群组消息', async () => {
      // Arrange
      const messageData: SendGroupMessageData = {
        group_id: new RecordId('message_group', 'test-group'),
        content: '群组消息内容',
        message_type: 'TEXT'
      };

      mockClient.create.mockResolvedValue([mockGroupMessage]);

      // Act
      const result = await messageService.sendGroupMessage(messageData);

      // Assert
      expect(result).toEqual(mockGroupMessage);
      expect(mockClient.create).toHaveBeenCalledWith('group_message', expect.objectContaining({
        group_id: messageData.group_id,
        content: messageData.content,
        message_type: 'TEXT',
        sender_id: '$auth.id'
      }));
    });

    it('应该成功发送带@提及的群组消息', async () => {
      // Arrange
      const messageData: SendGroupMessageData = {
        group_id: new RecordId('message_group', 'test-group'),
        content: '@user1 @user2 大家好！',
        mentions: [
          new RecordId('user', 'user1'),
          new RecordId('user', 'user2')
        ]
      };

      const mentionMessage = {
        ...mockGroupMessage,
        content: messageData.content,
        mentions: messageData.mentions
      };

      mockClient.create.mockResolvedValue([mentionMessage]);

      // Act
      const result = await messageService.sendGroupMessage(messageData);

      // Assert
      expect(result.mentions).toEqual(messageData.mentions);
    });

    it('应该成功回复群组消息', async () => {
      // Arrange
      const messageData: SendGroupMessageData = {
        group_id: new RecordId('message_group', 'test-group'),
        content: '这是回复消息',
        reply_to_message_id: new RecordId('group_message', 'original-message')
      };

      const replyMessage = {
        ...mockGroupMessage,
        content: messageData.content,
        reply_to_message_id: messageData.reply_to_message_id
      };

      mockClient.create.mockResolvedValue([replyMessage]);

      // Act
      const result = await messageService.sendGroupMessage(messageData);

      // Assert
      expect(result.reply_to_message_id).toEqual(messageData.reply_to_message_id);
    });
  });

  describe('消息置顶', () => {
    it('应该成功置顶消息', async () => {
      // Arrange
      const pinData: PinMessageData = {
        message_id: new RecordId('group_message', 'message-to-pin'),
        group_id: new RecordId('message_group', 'test-group'),
        pin_duration_hours: 24,
        reason: '重要通知'
      };

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('check_permission')) {
          return Promise.resolve([{ has_permission: true }]);
        }
        return Promise.resolve([]);
      });

      mockClient.create.mockResolvedValue([{
        message_id: pinData.message_id,
        group_id: pinData.group_id,
        pinned_by: mockAuthResult.id,
        pinned_at: new Date().toISOString(),
        pin_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        reason: pinData.reason
      }]);

      // Act
      const result = await messageService.pinGroupMessage(pinData);

      // Assert
      expect(result).toBe(true);
      expect(mockClient.create).toHaveBeenCalledWith('pinned_message', expect.objectContaining({
        message_id: pinData.message_id,
        group_id: pinData.group_id,
        reason: pinData.reason
      }));
    });

    it('权限不足时不能置顶消息', async () => {
      // Arrange
      const pinData: PinMessageData = {
        message_id: new RecordId('group_message', 'message-to-pin'),
        group_id: new RecordId('message_group', 'test-group')
      };

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('check_permission')) {
          return Promise.resolve([{ has_permission: false }]);
        }
        return Promise.resolve([]);
      });

      // Act & Assert
      await expect(messageService.pinGroupMessage(pinData))
        .rejects.toThrow('权限不足，无法置顶消息');
    });
  });

  describe('消息已读状态', () => {
    it('应该成功标记消息为已读', async () => {
      // Arrange
      const readData: MarkAsReadData = {
        message_ids: [
          new RecordId('message', 'msg1'),
          new RecordId('message', 'msg2')
        ]
      };

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await messageService.markAsRead(readData);

      // Assert
      expect(result).toBe(true);
    });

    it('应该成功标记群组消息为已读', async () => {
      // Arrange
      const readData: MarkGroupMessageAsReadData = {
        group_id: new RecordId('message_group', 'test-group'),
        last_read_message_id: new RecordId('group_message', 'last-message'),
        read_up_to_time: new Date().toISOString()
      };

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await messageService.markGroupMessagesAsRead(readData);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('通知管理', () => {
    it('应该成功发送系统通知', async () => {
      // Arrange
      const notificationData: SendNotificationData = {
        type: 'SYSTEM_NOTIFICATION',
        target_user_id: new RecordId('user', 'target-user'),
        title: '系统通知',
        content: '这是一条系统通知',
        priority: 'NORMAL',
        sender_name: '系统'
      };

      mockClient.create.mockResolvedValue([mockNotification]);

      // Act
      const result = await messageService.sendNotification(notificationData);

      // Assert
      expect(result).toEqual(mockNotification);
      expect(mockClient.create).toHaveBeenCalledWith('message', expect.objectContaining({
        type: 'SYSTEM_NOTIFICATION',
        title: '系统通知',
        content: '这是一条系统通知',
        priority: 'NORMAL'
      }));
    });

    it('应该成功发送案件机器人提醒', async () => {
      // Arrange
      const reminderData: SendNotificationData = {
        type: 'CASE_ROBOT_REMINDER',
        case_id: new RecordId('case', 'case123'),
        content: '案件状态更新提醒',
        priority: 'HIGH',
        sender_name: '案件机器人'
      };

      const reminderNotification = {
        ...mockNotification,
        type: 'CASE_ROBOT_REMINDER',
        case_id: reminderData.case_id,
        content: reminderData.content,
        priority: 'HIGH'
      };

      mockClient.create.mockResolvedValue([reminderNotification]);

      // Act
      const result = await messageService.sendNotification(reminderData);

      // Assert
      expect(result.type).toBe('CASE_ROBOT_REMINDER');
      expect(result.case_id).toEqual(reminderData.case_id);
      expect(result.priority).toBe('HIGH');
    });
  });

  describe('会议邀请', () => {
    it('应该成功发送会议邀请', async () => {
      // Arrange
      const inviteData: SendConferenceInviteData = {
        target_user_ids: [
          new RecordId('user', 'user1'),
          new RecordId('user', 'user2')
        ],
        conference_title: '项目讨论会议',
        conference_description: '讨论项目进展',
        call_type: 'video',
        is_immediate: true,
        expires_in_minutes: 30
      };

      const inviteMessage = {
        id: new RecordId('message', 'invite-message'),
        type: 'CONFERENCE_INVITE',
        content: JSON.stringify(inviteData),
        sender_id: mockAuthResult.id,
        created_at: new Date().toISOString()
      };

      mockClient.create.mockResolvedValue([inviteMessage]);

      // Act
      const result = await messageService.sendConferenceInvite(inviteData);

      // Assert
      expect(result).toEqual(inviteMessage);
      expect(mockClient.create).toHaveBeenCalled();
    });

    it('应该成功响应会议邀请', async () => {
      // Arrange
      const responseData = {
        message_id: new RecordId('message', 'invite-message'),
        response: 'accepted' as const,
        response_message: '我会参加会议'
      };

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('invitation')) {
          return Promise.resolve([{ 
            id: responseData.message_id,
            sender_id: new RecordId('user', 'inviter')
          }]);
        }
        return Promise.resolve([]);
      });

      mockClient.create.mockResolvedValue([{
        invitation_id: responseData.message_id,
        responder_id: mockAuthResult.id,
        response: responseData.response,
        response_message: responseData.response_message,
        responded_at: new Date().toISOString()
      }]);

      // Act
      const result = await messageService.respondToConferenceInvite(responseData);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('消息搜索', () => {
    it('应该成功搜索群组消息', async () => {
      // Arrange
      const searchData: SearchGroupMessagesData = {
        group_id: new RecordId('message_group', 'test-group'),
        query: '测试',
        message_type: 'TEXT',
        limit: 20
      };

      const searchResults = [mockGroupMessage];

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('search')) {
          return Promise.resolve([searchResults]);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await messageService.searchGroupMessages(searchData);

      // Assert
      expect(result).toEqual(searchResults);
    });

    it('应该支持按用户搜索消息', async () => {
      // Arrange
      const searchData: SearchGroupMessagesData = {
        group_id: new RecordId('message_group', 'test-group'),
        query: '重要',
        from_user_id: new RecordId('user', 'specific-user'),
        limit: 10
      };

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('search') && query.includes('sender_id')) {
          return Promise.resolve([[mockGroupMessage]]);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await messageService.searchGroupMessages(searchData);

      // Assert
      expect(result).toEqual([mockGroupMessage]);
    });
  });

  describe('错误处理', () => {
    it('客户端不可用时应该抛出错误', async () => {
      // Arrange
      const originalMessageService = require('@/src/services/messageService').messageService;
      originalMessageService.setClientGetter(null);

      // Act & Assert
      await expect(originalMessageService.createConversation({
        type: 'DIRECT',
        participants: [new RecordId('user', 'target')]
      })).rejects.toThrow('SurrealDB client not available');
    });

    it('数据库操作失败时应该抛出错误', async () => {
      // Arrange
      mockClient.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(messageService.sendMessage({
        conversation_id: mockConversation.id,
        content: '测试消息'
      })).rejects.toThrow('Database error');
    });

    it('无效的会话类型应该抛出错误', async () => {
      // Act & Assert
      await expect(messageService.createConversation({
        type: 'INVALID' as any,
        participants: [new RecordId('user', 'target')]
      })).rejects.toThrow('无效的会话类型');
    });
  });

  describe('权限验证', () => {
    it('应该验证用户是否有权限发送群组消息', async () => {
      // Arrange
      const messageData: SendGroupMessageData = {
        group_id: new RecordId('message_group', 'restricted-group'),
        content: '测试消息'
      };

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('check_permission')) {
          return Promise.resolve([{ has_permission: false }]);
        }
        return Promise.resolve([]);
      });

      // Act & Assert
      await expect(messageService.sendGroupMessage(messageData))
        .rejects.toThrow('权限不足，无法在此群组发送消息');
    });

    it('应该验证用户是否为会话参与者', async () => {
      // Arrange
      const messageData: SendMessageData = {
        conversation_id: new RecordId('conversation', 'private-conversation'),
        content: '测试消息'
      };

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('participant')) {
          return Promise.resolve([]); // 不是参与者
        }
        return Promise.resolve([]);
      });

      // Act & Assert
      await expect(messageService.sendMessage(messageData))
        .rejects.toThrow('您不是此会话的参与者');
    });
  });

  describe('群组消息高级功能', () => {
    it('应该成功获取群组消息历史', async () => {
      // Arrange
      const groupId = new RecordId('message_group', 'test-group');
      const mockMessages = [mockGroupMessage];
      
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('group_message') && query.includes('ORDER BY')) {
          return Promise.resolve([mockMessages]);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await messageService.getGroupMessages(groupId, 50, 0);

      // Assert
      expect(result).toEqual(mockMessages);
    });

    it('应该成功获取群组未读消息数量', async () => {
      // Arrange
      const groupId = new RecordId('message_group', 'test-group');
      
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('unread_count')) {
          return Promise.resolve([{ unread_count: 5 }]);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await messageService.getGroupUnreadCount(groupId);

      // Assert
      expect(result).toBe(5);
    });

    it('应该成功获取群组置顶消息', async () => {
      // Arrange
      const groupId = new RecordId('message_group', 'test-group');
      const pinnedMessage = {
        ...mockGroupMessage,
        is_pinned: true,
        pinned_by: mockAuthResult.id,
        pinned_at: new Date().toISOString(),
      };
      
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('pinned_message')) {
          return Promise.resolve([[pinnedMessage]]);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await messageService.getGroupPinnedMessages(groupId);

      // Assert
      expect(result).toEqual([pinnedMessage]);
    });

    it('应该成功发送多媒体群组消息', async () => {
      // Arrange
      const messageData: SendGroupMessageData = {
        group_id: new RecordId('message_group', 'test-group'),
        content: '分享一张图片',
        message_type: 'IMAGE',
        attachments: [
          {
            file_name: 'image.jpg',
            file_type: 'image',
            file_size: 1024000,
            mime_type: 'image/jpeg',
            s3_object_key: 'images/image.jpg',
            thumbnail_url: 'https://example.com/thumb.jpg'
          }
        ]
      };

      const mediaMessage = {
        ...mockGroupMessage,
        message_type: 'IMAGE',
        attachments: messageData.attachments,
      };

      mockClient.create.mockResolvedValue([mediaMessage]);

      // Act
      const result = await messageService.sendGroupMessage(messageData);

      // Assert
      expect(result.message_type).toBe('IMAGE');
      expect(result.attachments).toEqual(messageData.attachments);
    });

    it('应该记录群组通话结束', async () => {
      // Arrange
      const messageData: SendGroupMessageData = {
        group_id: new RecordId('message_group', 'test-group'),
        content: '通话已结束',
        message_type: 'SYSTEM',
        metadata: {
          system_message_type: 'CALL_END',
          call_duration: 300,
          participants: [
            new RecordId('user', 'user1'),
            new RecordId('user', 'user2')
          ]
        }
      };

      const callEndMessage = {
        ...mockGroupMessage,
        message_type: 'SYSTEM',
        metadata: messageData.metadata,
      };

      mockClient.create.mockResolvedValue([callEndMessage]);

      // Act
      const result = await messageService.sendGroupMessage(messageData);

      // Assert
      expect(result.message_type).toBe('SYSTEM');
      expect(result.metadata?.system_message_type).toBe('CALL_END');
      expect(result.metadata?.call_duration).toBe(300);
    });
  });

  describe('消息编辑和撤回', () => {
    it('应该成功编辑群组消息', async () => {
      // Arrange
      const messageId = new RecordId('group_message', 'editable-message');
      const newContent = '这是编辑后的内容';
      
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('sender_id = $auth.id')) {
          return Promise.resolve([{ id: messageId, sender_id: mockAuthResult.id }]);
        }
        return Promise.resolve([]);
      });

      mockClient.merge.mockResolvedValue([{
        ...mockGroupMessage,
        id: messageId,
        content: newContent,
        is_edited: true,
        edited_at: new Date().toISOString(),
      }]);

      // Act
      const result = await messageService.editGroupMessage(messageId, newContent);

      // Assert
      expect(result).toBe(true);
      expect(mockClient.merge).toHaveBeenCalledWith(messageId, expect.objectContaining({
        content: newContent,
        is_edited: true,
      }));
    });

    it('应该成功撤回群组消息', async () => {
      // Arrange
      const messageId = new RecordId('group_message', 'recallable-message');
      const reason = '发送错误';
      
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('sender_id = $auth.id')) {
          return Promise.resolve([{ 
            id: messageId, 
            sender_id: mockAuthResult.id,
            created_at: new Date(Date.now() - 60000).toISOString() // 1分钟前
          }]);
        }
        return Promise.resolve([]);
      });

      mockClient.merge.mockResolvedValue([{
        ...mockGroupMessage,
        id: messageId,
        is_recalled: true,
        recalled_at: new Date().toISOString(),
        recall_reason: reason,
      }]);

      // Act
      const result = await messageService.recallGroupMessage(messageId, reason);

      // Assert
      expect(result).toBe(true);
      expect(mockClient.merge).toHaveBeenCalledWith(messageId, expect.objectContaining({
        is_recalled: true,
        recall_reason: reason,
      }));
    });

    it('超过撤回时间限制时应该抛出错误', async () => {
      // Arrange
      const messageId = new RecordId('group_message', 'old-message');
      
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('sender_id = $auth.id')) {
          return Promise.resolve([{ 
            id: messageId, 
            sender_id: mockAuthResult.id,
            created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString() // 3分钟前，超过2分钟限制
          }]);
        }
        return Promise.resolve([]);
      });

      // Act & Assert
      await expect(messageService.recallGroupMessage(messageId))
        .rejects.toThrow('消息发送时间超过2分钟，无法撤回');
    });
  });

  describe('消息转发功能', () => {
    it('应该成功转发消息到群组', async () => {
      // Arrange
      const originalMessageId = new RecordId('group_message', 'original-message');
      const targetGroupId = new RecordId('message_group', 'target-group');
      
      const originalMessage = {
        ...mockGroupMessage,
        id: originalMessageId,
        content: '原始消息内容',
      };

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('SELECT') && query.includes(originalMessageId.toString())) {
          return Promise.resolve([originalMessage]);
        }
        return Promise.resolve([]);
      });

      const forwardedMessage = {
        ...mockGroupMessage,
        group_id: targetGroupId,
        content: originalMessage.content,
        forwarded_from: originalMessageId,
        is_forwarded: true,
      };

      mockClient.create.mockResolvedValue([forwardedMessage]);

      // Act
      const result = await messageService.forwardMessageToGroup(originalMessageId, targetGroupId);

      // Assert
      expect(result).toEqual(forwardedMessage);
      expect(mockClient.create).toHaveBeenCalledWith('group_message', expect.objectContaining({
        group_id: targetGroupId,
        content: originalMessage.content,
        forwarded_from: originalMessageId,
        is_forwarded: true,
      }));
    });

    it('应该成功批量转发消息', async () => {
      // Arrange
      const messageIds = [
        new RecordId('group_message', 'msg1'),
        new RecordId('group_message', 'msg2'),
      ];
      const targetGroupId = new RecordId('message_group', 'target-group');

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('SELECT') && query.includes('IN')) {
          return Promise.resolve([
            { id: messageIds[0], content: '消息1' },
            { id: messageIds[1], content: '消息2' },
          ]);
        }
        return Promise.resolve([]);
      });

      mockClient.create.mockResolvedValue([
        { id: 'forwarded1', content: '消息1', is_forwarded: true },
        { id: 'forwarded2', content: '消息2', is_forwarded: true },
      ]);

      // Act
      const result = await messageService.batchForwardMessages(messageIds, targetGroupId);

      // Assert
      expect(result).toHaveLength(2);
      expect(mockClient.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('消息草稿功能', () => {
    it('应该成功保存群组消息草稿', async () => {
      // Arrange
      const groupId = new RecordId('message_group', 'test-group');
      const draftContent = '这是草稿内容';

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        return Promise.resolve([]);
      });

      // Act
      await messageService.saveGroupMessageDraft(groupId, draftContent);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPSERT'),
        expect.objectContaining({
          group_id: groupId,
          draft_content: draftContent,
        })
      );
    });

    it('应该成功获取群组消息草稿', async () => {
      // Arrange
      const groupId = new RecordId('message_group', 'test-group');
      const draftContent = '保存的草稿内容';

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('draft_content')) {
          return Promise.resolve([{ draft_content: draftContent }]);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await messageService.getGroupMessageDraft(groupId);

      // Assert
      expect(result).toBe(draftContent);
    });

    it('应该成功清除群组消息草稿', async () => {
      // Arrange
      const groupId = new RecordId('message_group', 'test-group');

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        return Promise.resolve([]);
      });

      // Act
      await messageService.clearGroupMessageDraft(groupId);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        expect.objectContaining({
          group_id: groupId,
        })
      );
    });
  });

  describe('数据验证', () => {
    it('应该验证消息内容长度', async () => {
      // Arrange
      const longContent = 'a'.repeat(10001); // 超过10000字符限制
      const messageData: SendMessageData = {
        conversation_id: mockConversation.id,
        content: longContent
      };

      // Act & Assert
      await expect(messageService.sendMessage(messageData))
        .rejects.toThrow('消息内容过长');
    });

    it('应该验证附件大小', async () => {
      // Arrange
      const messageData: SendMessageData = {
        conversation_id: mockConversation.id,
        content: '带大文件的消息',
        attachments: [{
          file_name: 'large-file.zip',
          file_type: 'zip',
          file_size: 101 * 1024 * 1024, // 超过100MB限制
          mime_type: 'application/zip',
          s3_object_key: 'attachments/large-file.zip'
        }]
      };

      // Act & Assert
      await expect(messageService.sendMessage(messageData))
        .rejects.toThrow('附件大小超过限制');
    });

    it('应该验证@提及用户是否存在', async () => {
      // Arrange
      const messageData: SendGroupMessageData = {
        group_id: new RecordId('message_group', 'test-group'),
        content: '@nonexistent 你好',
        mentions: [new RecordId('user', 'nonexistent')]
      };

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('user') && query.includes('nonexistent')) {
          return Promise.resolve([]); // 用户不存在
        }
        return Promise.resolve([]);
      });

      // Act & Assert
      await expect(messageService.sendGroupMessage(messageData))
        .rejects.toThrow('提及的用户不存在');
    });

    it('应该验证群组消息类型', async () => {
      // Arrange
      const messageData: SendGroupMessageData = {
        group_id: new RecordId('message_group', 'test-group'),
        content: '测试消息',
        message_type: 'INVALID_TYPE' as any,
      };

      // Act & Assert
      await expect(messageService.sendGroupMessage(messageData))
        .rejects.toThrow('无效的消息类型');
    });

    it('应该验证文件元数据完整性', async () => {
      // Arrange
      const messageData: SendGroupMessageData = {
        group_id: new RecordId('message_group', 'test-group'),
        content: '文件消息',
        message_type: 'FILE',
        attachments: [
          {
            file_name: 'test.pdf',
            file_size: 1024000,
            // 缺少必需的字段
          } as any,
        ],
      };

      // Act & Assert
      await expect(messageService.sendGroupMessage(messageData))
        .rejects.toThrow('文件元数据不完整');
    });
  });
});