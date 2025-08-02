import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecordId } from 'surrealdb';
import groupManager, { 
  Group, 
  GroupMember, 
  GroupSettings, 
  CreateGroupData, 
  UpdateGroupData,
  AddMemberData,
  UpdateMemberRoleData 
} from '@/src/services/groupManager';

// Mock SurrealProvider
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

describe('GroupManager', () => {
  const mockAuthResult = {
    id: new RecordId('user', 'test-user'),
    name: 'Test User'
  };

  const mockGroup: Group = {
    id: new RecordId('message_group', 'test-group'),
    name: '测试群组',
    description: '这是一个测试群组',
    type: 'normal',
    max_members: 50,
    is_public: false,
    require_approval: false,
    allow_member_invite: true,
    created_by: mockAuthResult.id,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  };

  const mockGroupSettings: GroupSettings = {
    group_id: mockGroup.id,
    allow_all_member_at: true,
    allow_member_edit_info: false,
    file_sharing_enabled: true,
    call_enabled: true,
    screen_share_enabled: true,
    member_join_notification: true,
    member_leave_notification: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  };

  const mockGroupMember: GroupMember = {
    id: new RecordId('group_member', 'test-member'),
    group_id: mockGroup.id,
    user_id: mockAuthResult.id,
    role: 'owner',
    joined_at: '2024-01-01T00:00:00.000Z',
    permissions: {
      can_send_message: true,
      can_add_member: true,
      can_remove_member: true,
      can_edit_info: true,
      can_pin_message: true,
      can_manage_settings: true
    },
    is_muted: false,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // 设置默认认证状态
    mockClient.query.mockImplementation((query: string) => {
      if (query.includes('return $auth;')) {
        return Promise.resolve([mockAuthResult]);
      }
      return Promise.resolve([]);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('群组创建', () => {
    it('应该成功创建群组', async () => {
      // Arrange
      const createData: CreateGroupData = {
        name: '测试群组',
        description: '这是一个测试群组',
        type: 'normal',
        max_members: 50,
        is_public: false,
        require_approval: false,
        allow_member_invite: true,
        initial_members: [new RecordId('user', 'member1')],
        settings: {
          allow_all_member_at: true,
          file_sharing_enabled: true,
          call_enabled: true
        }
      };

      mockClient.create
        .mockResolvedValueOnce([mockGroup])      // 创建群组
        .mockResolvedValueOnce([mockGroupSettings])  // 创建设置
        .mockResolvedValueOnce([mockGroupMember])    // 创建群主成员
        .mockResolvedValueOnce([{...mockGroupMember, role: 'member'}]); // 创建初始成员

      // Act
      const result = await groupManager.createGroup(createData);

      // Assert
      expect(result.group).toEqual(mockGroup);
      expect(result.settings).toEqual(mockGroupSettings);
      expect(result.members).toHaveLength(2); // 群主 + 1个初始成员
      expect(mockClient.create).toHaveBeenCalledTimes(4);
    });

    it('用户未认证时应该抛出错误', async () => {
      // Arrange
      mockClient.query.mockResolvedValue([null]); // 未认证
      
      const createData: CreateGroupData = {
        name: '测试群组',
        type: 'normal'
      };

      // Act & Assert
      await expect(groupManager.createGroup(createData))
        .rejects.toThrow('用户未认证');
    });

    it('应该正确设置案件相关群组', async () => {
      // Arrange
      const createData: CreateGroupData = {
        name: '案件群组',
        type: 'case_related',
        case_id: new RecordId('case', 'case123')
      };

      mockClient.create
        .mockResolvedValueOnce([{...mockGroup, type: 'case_related', case_id: createData.case_id}])
        .mockResolvedValueOnce([mockGroupSettings])
        .mockResolvedValueOnce([mockGroupMember]);

      // Act
      const result = await groupManager.createGroup(createData);

      // Assert
      expect(result.group.type).toBe('case_related');
      expect(result.group.case_id).toEqual(createData.case_id);
    });
  });

  describe('群组更新', () => {
    it('应该成功更新群组信息', async () => {
      // Arrange
      const groupId = mockGroup.id;
      const updateData: UpdateGroupData = {
        name: '更新后的群组名',
        description: '更新后的描述',
        max_members: 100
      };

      // Mock权限检查通过
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('check_permission')) {
          return Promise.resolve([{ has_permission: true }]);
        }
        return Promise.resolve([]);
      });

      mockClient.merge.mockResolvedValue([{...mockGroup, ...updateData}]);

      // Act
      const result = await groupManager.updateGroup(groupId, updateData);

      // Assert
      expect(result.name).toBe(updateData.name);
      expect(result.description).toBe(updateData.description);
      expect(result.max_members).toBe(updateData.max_members);
      expect(mockClient.merge).toHaveBeenCalled();
    });

    it('权限不足时应该抛出错误', async () => {
      // Arrange
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
      await expect(groupManager.updateGroup(mockGroup.id, { name: '新名称' }))
        .rejects.toThrow();
    });
  });

  describe('群组删除', () => {
    it('群主应该能删除群组', async () => {
      // Arrange
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('owner')) {
          return Promise.resolve([{ is_owner: true }]);
        }
        return Promise.resolve([]);
      });

      mockClient.delete.mockResolvedValue([true]);

      // Act
      const result = await groupManager.deleteGroup(mockGroup.id);

      // Assert
      expect(result).toBe(true);
      expect(mockClient.delete).toHaveBeenCalled();
    });

    it('非群主不能删除群组', async () => {
      // Arrange
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('owner')) {
          return Promise.resolve([{ is_owner: false }]);
        }
        return Promise.resolve([]);
      });

      // Act & Assert
      await expect(groupManager.deleteGroup(mockGroup.id))
        .rejects.toThrow();
    });
  });

  describe('成员管理', () => {
    it('应该成功添加成员', async () => {
      // Arrange
      const addData: AddMemberData = {
        user_ids: [new RecordId('user', 'new-user')],
        role: 'member',
        message: '欢迎加入群组'
      };

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('check_permission')) {
          return Promise.resolve([{ has_permission: true }]);
        }
        if (query.includes('already_member')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      mockClient.create.mockResolvedValue([{...mockGroupMember, role: 'member'}]);

      // Act
      const result = await groupManager.addMembers(mockGroup.id, addData);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('member');
      expect(mockClient.create).toHaveBeenCalled();
    });

    it('应该阻止添加已存在的成员', async () => {
      // Arrange
      const addData: AddMemberData = {
        user_ids: [new RecordId('user', 'existing-user')],
        role: 'member'
      };

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('check_permission')) {
          return Promise.resolve([{ has_permission: true }]);
        }
        if (query.includes('already_member')) {
          return Promise.resolve([{ user_id: addData.user_ids[0] }]);
        }
        return Promise.resolve([]);
      });

      // Act & Assert
      await expect(groupManager.addMembers(mockGroup.id, addData))
        .rejects.toThrow('用户已是群组成员');
    });

    it('应该成功移除成员', async () => {
      // Arrange
      const userIds = [new RecordId('user', 'user-to-remove')];

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('check_permission')) {
          return Promise.resolve([{ has_permission: true }]);
        }
        if (query.includes('DELETE')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await groupManager.removeMembers(mockGroup.id, userIds);

      // Assert
      expect(result).toBe(true);
    });

    it('应该成功更新成员角色', async () => {
      // Arrange
      const updateData: UpdateMemberRoleData = {
        user_id: new RecordId('user', 'user123'),
        role: 'admin',
        permissions: {
          can_send_message: true,
          can_add_member: true,
          can_remove_member: false
        }
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

      mockClient.merge.mockResolvedValue([{...mockGroupMember, role: 'admin'}]);

      // Act
      const result = await groupManager.updateMemberRole(mockGroup.id, updateData);

      // Assert
      expect(result.role).toBe('admin');
      expect(mockClient.merge).toHaveBeenCalled();
    });

    it('应该阻止移除群主', async () => {
      // Arrange
      const userIds = [mockAuthResult.id]; // 尝试移除群主

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('check_permission')) {
          return Promise.resolve([{ has_permission: true }]);
        }
        if (query.includes('role')) {
          return Promise.resolve([{ role: 'owner' }]);
        }
        return Promise.resolve([]);
      });

      // Act & Assert
      await expect(groupManager.removeMembers(mockGroup.id, userIds))
        .rejects.toThrow('不能移除群主');
    });
  });

  describe('群组查询', () => {
    it('应该成功获取群组信息', async () => {
      // Arrange
      mockClient.select.mockResolvedValue([mockGroup]);

      // Act
      const result = await groupManager.getGroupInfo(mockGroup.id);

      // Assert
      expect(result).toEqual(mockGroup);
      expect(mockClient.select).toHaveBeenCalledWith(String(mockGroup.id));
    });

    it('应该成功获取群组成员列表', async () => {
      // Arrange
      const membersWithUserInfo = [{
        ...mockGroupMember,
        user_info: {
          name: 'Test User',
          avatar: 'avatar.jpg',
          is_online: true
        }
      }];

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('group_member')) {
          return Promise.resolve(membersWithUserInfo);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await groupManager.getGroupMembers(mockGroup.id);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].user_info).toBeDefined();
    });

    it('应该成功获取用户所属群组', async () => {
      // Arrange
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('group')) {
          return Promise.resolve([mockGroup]);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await groupManager.getUserGroups();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockGroup);
    });

    it('应该正确检查成员权限', async () => {
      // Arrange
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('permission')) {
          return Promise.resolve([{ has_permission: true }]);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await groupManager.checkMemberPermission(mockGroup.id, 'can_edit_info');

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('消息已读状态管理', () => {
    it('应该成功标记消息为已读', async () => {
      // Arrange
      const messageId = new RecordId('message', 'msg123');

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        return Promise.resolve([]);
      });

      mockClient.create.mockResolvedValue([{
        message_id: messageId,
        user_id: mockAuthResult.id,
        group_id: mockGroup.id,
        read_at: new Date().toISOString()
      }]);

      // Act
      const result = await groupManager.markMessageAsRead(messageId, mockGroup.id);

      // Assert
      expect(result).toBe(true);
      expect(mockClient.create).toHaveBeenCalled();
    });

    it('应该成功获取未读消息数量', async () => {
      // Arrange
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('count')) {
          return Promise.resolve([{ count: 5 }]);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await groupManager.getUnreadCount(mockGroup.id);

      // Assert
      expect(result).toBe(5);
    });

    it('应该成功标记所有消息为已读', async () => {
      // Arrange
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await groupManager.markAllMessagesAsRead(mockGroup.id);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('消息置顶功能', () => {
    it('应该成功置顶消息', async () => {
      // Arrange
      const messageId = new RecordId('message', 'msg123');

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
        message_id: messageId,
        group_id: mockGroup.id,
        pinned_by: mockAuthResult.id,
        pinned_at: new Date().toISOString()
      }]);

      // Act
      const result = await groupManager.pinMessage(messageId, mockGroup.id);

      // Assert
      expect(result).toBe(true);
      expect(mockClient.create).toHaveBeenCalled();
    });

    it('应该成功取消置顶消息', async () => {
      // Arrange
      const messageId = new RecordId('message', 'msg123');

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('check_permission')) {
          return Promise.resolve([{ has_permission: true }]);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await groupManager.unpinMessage(messageId, mockGroup.id);

      // Assert
      expect(result).toBe(true);
    });

    it('应该成功获取置顶消息列表', async () => {
      // Arrange
      const pinnedMessages = [
        {
          id: new RecordId('message', 'msg1'),
          content: '置顶消息1',
          pinned_at: '2024-01-01T00:00:00.000Z'
        }
      ];

      mockClient.query.mockResolvedValue(pinnedMessages);

      // Act
      const result = await groupManager.getPinnedMessages(mockGroup.id);

      // Assert
      expect(result).toEqual(pinnedMessages);
    });
  });

  describe('批量操作', () => {
    it('应该成功批量添加成员', async () => {
      // Arrange
      const operations = [
        { groupId: mockGroup.id, userIds: [new RecordId('user', 'user1')] },
        { groupId: mockGroup.id, userIds: [new RecordId('user', 'user2')] }
      ];

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('check_permission')) {
          return Promise.resolve([{ has_permission: true }]);
        }
        if (query.includes('already_member')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      mockClient.create.mockResolvedValue([mockGroupMember]);

      // Act
      const result = await groupManager.batchAddMembers(operations);

      // Assert
      expect(result).toBe(true);
      expect(mockClient.create).toHaveBeenCalledTimes(2);
    });

    it('应该成功批量更新已读状态', async () => {
      // Arrange
      const messageIds = [
        new RecordId('message', 'msg1'),
        new RecordId('message', 'msg2')
      ];

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await groupManager.batchUpdateReadStatus(mockGroup.id, messageIds);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('客户端不可用时应该抛出错误', async () => {
      // Arrange
      const originalGroupManager = require('@/src/services/groupManager').default;
      originalGroupManager.setClientGetter(null);

      // Act & Assert
      await expect(originalGroupManager.createGroup({ name: 'test', type: 'normal' }))
        .rejects.toThrow('SurrealDB client not available');
    });

    it('数据库操作失败时应该抛出错误', async () => {
      // Arrange
      mockClient.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(groupManager.createGroup({ name: 'test', type: 'normal' }))
        .rejects.toThrow('Database error');
    });

    it('无效参数应该抛出错误', async () => {
      // Arrange
      const invalidData = { name: '', type: 'normal' } as CreateGroupData;

      // Act & Assert
      await expect(groupManager.createGroup(invalidData))
        .rejects.toThrow();
    });
  });

  describe('权限验证', () => {
    it('应该正确验证群主权限', async () => {
      // Arrange
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('owner')) {
          return Promise.resolve([{ is_owner: true }]);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await groupManager.checkOwnerPermission(mockGroup.id);

      // Assert
      expect(result).toBe(true);
    });

    it('应该正确验证管理员权限', async () => {
      // Arrange
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('admin')) {
          return Promise.resolve([{ is_admin: true }]);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await groupManager.checkAdminPermission(mockGroup.id);

      // Assert
      expect(result).toBe(true);
    });

    it('权限不足时应该抛出错误', async () => {
      // Arrange
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('permission')) {
          return Promise.resolve([{ has_permission: false }]);
        }
        return Promise.resolve([]);
      });

      // Act & Assert
      await expect(groupManager.checkPermission(mockGroup.id, 'can_edit_info'))
        .rejects.toThrow('权限不足');
    });
  });

  describe('数据验证', () => {
    it('应该验证群组名称长度', async () => {
      // Arrange
      const longName = 'a'.repeat(101); // 超过100字符限制
      const createData: CreateGroupData = {
        name: longName,
        type: 'normal'
      };

      // Act & Assert
      await expect(groupManager.createGroup(createData))
        .rejects.toThrow();
    });

    it('应该验证成员数量限制', async () => {
      // Arrange
      const tooManyMembers = Array.from({ length: 101 }, (_, i) => 
        new RecordId('user', `user${i}`)
      );
      
      const addData: AddMemberData = {
        user_ids: tooManyMembers,
        role: 'member'
      };

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth;')) {
          return Promise.resolve([mockAuthResult]);
        }
        if (query.includes('count')) {
          return Promise.resolve([{ count: 50 }]); // 当前50个成员
        }
        return Promise.resolve([]);
      });

      // Act & Assert
      await expect(groupManager.addMembers(mockGroup.id, addData))
        .rejects.toThrow();
    });
  });
});
