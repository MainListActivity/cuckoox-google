import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { groupManager } from '@/src/services/groupManager';
import type { CreateGroupData, UpdateGroupData, AddMemberData, UpdateMemberRoleData } from '@/src/services/groupManager';

// Mock SurrealProvider
const mockClient = {
  create: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  query: vi.fn(),
  merge: vi.fn(),
  live: vi.fn(),
  kill: vi.fn(),
};

vi.mock('@/src/contexts/SurrealProvider', () => ({
  useSurrealClientSingleton: vi.fn(() => mockClient),
  TenantCodeMissingError: class extends Error {},
}));

describe('GroupManager - Fixed Tests', () => {
  const mockUserId = 'user:123';
  const mockGroupId = 'group:456';

  const mockGroup = {
    id: mockGroupId,
    name: 'Test Group',
    description: 'Test Description',
    type: 'normal' as const,
    created_by: mockUserId,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  const mockOwnerMember = {
    id: 'member:owner',
    group_id: mockGroupId,
    user_id: mockUserId,
    role: 'owner' as const,
    joined_at: '2023-01-01T00:00:00Z',
    is_muted: false,
    permissions: {
      can_send_message: true,
      can_add_member: true,
      can_remove_member: true,
      can_edit_info: true,
      can_pin_message: true,
      can_manage_settings: true,
    },
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    groupManager.setClientGetter(async () => mockClient as any);
    
    // Default mock implementations
    mockClient.create.mockResolvedValue([{ id: mockGroupId }]);
    mockClient.select.mockResolvedValue([mockGroup]);
    mockClient.merge.mockResolvedValue([mockGroup]);
    mockClient.delete.mockResolvedValue([]);
    mockClient.live.mockResolvedValue('live-query-uuid');
    
    // Default query mock - return owner member for permission checks
    mockClient.query.mockImplementation((query: string) => {
      if (query.includes('return $auth')) {
        return Promise.resolve([{ id: mockUserId, name: 'Test User' }]);
      }
      if (query.includes('SELECT * FROM group_member WHERE')) {
        return Promise.resolve([mockOwnerMember]);
      }
      return Promise.resolve([[]]);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Operations', () => {
    it('should create group successfully', async () => {
      // Arrange
      const groupData: CreateGroupData = {
        name: 'New Group',
        description: 'Group Description',
        type: 'normal',
      };

      const mockGroupSettings = {
        id: 'settings:123',
        group_id: mockGroupId,
        allow_all_member_at: true,
        call_enabled: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockClient.create.mockResolvedValueOnce([mockGroup])
        .mockResolvedValueOnce([mockGroupSettings])
        .mockResolvedValueOnce([mockOwnerMember]);

      // Act
      const result = await groupManager.createGroup(groupData);

      // Assert
      expect(result).toEqual({
        group: mockGroup,
        settings: mockGroupSettings,
        members: [mockOwnerMember],
      });
    });

    it('should update group successfully with owner permissions', async () => {
      // Arrange
      const updates: UpdateGroupData = {
        name: 'Updated Group Name',
        description: 'Updated Description',
      };

      // Act
      const result = await groupManager.updateGroup(mockGroupId, updates);

      // Assert
      expect(result).toEqual(mockGroup);
      expect(mockClient.merge).toHaveBeenCalledWith(mockGroupId, expect.objectContaining(updates));
    });

    it('should delete group successfully with owner permissions', async () => {
      // Act
      const result = await groupManager.deleteGroup(mockGroupId);

      // Assert
      expect(result).toBe(true);
      expect(mockClient.delete).toHaveBeenCalledWith(mockGroupId);
    });

    it('should get group info successfully', async () => {
      // Arrange
      mockClient.query.mockResolvedValue([mockGroup]);

      // Act
      const groupInfo = await groupManager.getGroup(mockGroupId);

      // Assert
      expect(groupInfo).toEqual(mockGroup);
    });

    it('should add members successfully with owner permissions', async () => {
      // Arrange
      const addMemberData: AddMemberData = {
        user_ids: ['user:456', 'user:789'],
        role: 'member',
      };

      const mockNewMember = {
        id: 'member:new',
        group_id: mockGroupId,
        user_id: 'user:456',
        role: 'member' as const,
        permissions: {
          can_send_message: true,
          can_add_member: false,
        },
      };

      // Mock group exists and member count check
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth')) {
          return Promise.resolve([{ id: mockUserId, name: 'Test User' }]);
        }
        if (query.includes('SELECT * FROM group_member WHERE')) {
          // For permission check, return owner
          if (query.includes('user_id = $auth.id')) {
            return Promise.resolve([mockOwnerMember]);
          }
          // For existing member check, return empty (user is not already a member)
          return Promise.resolve([]);
        }
        if (query.includes('SELECT * FROM message_group')) {
          return Promise.resolve([[{ ...mockGroup, max_members: 500 }]]);
        }
        if (query.includes('SELECT count()')) {
          return Promise.resolve([[{ total: 1 }]]);
        }
        return Promise.resolve([[]]);
      });

      mockClient.create.mockResolvedValue([mockNewMember]);

      // Act
      const result = await groupManager.addMembers(mockGroupId, addMemberData);

      // Assert
      expect(result).toHaveLength(2);
      expect(mockClient.create).toHaveBeenCalledWith('group_member', expect.objectContaining({
        role: 'member',
      }));
    });

    it('should handle permission denied for non-owner', async () => {
      // Arrange
      const memberWithoutPermission = {
        ...mockOwnerMember,
        role: 'member' as const,
        permissions: {
          can_edit_info: false,
        },
      };

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth')) {
          return Promise.resolve([{ id: mockUserId, name: 'Test User' }]);
        }
        if (query.includes('SELECT * FROM group_member WHERE')) {
          return Promise.resolve([memberWithoutPermission]);
        }
        return Promise.resolve([[]]);
      });

      const updates: UpdateGroupData = {
        name: 'Updated Group Name',
      };

      // Act & Assert
      await expect(groupManager.updateGroup(mockGroupId, updates))
        .rejects.toThrow('权限不足');
    });

    it('should handle WebRTC integration', async () => {
      // Arrange
      const groupData: CreateGroupData = {
        name: 'Video Call Group',
        description: 'Group for video calls',
        type: 'normal',
        settings: {
          call_enabled: true,
          screen_share_enabled: true,
        },
      };

      const mockGroupSettings = {
        id: 'settings:123',
        group_id: mockGroupId,
        call_enabled: true,
        screen_share_enabled: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockClient.create.mockResolvedValueOnce([mockGroup])
        .mockResolvedValueOnce([mockGroupSettings])
        .mockResolvedValueOnce([mockOwnerMember]);

      // Act
      const result = await groupManager.createGroup(groupData);

      // Assert
      expect(result.settings.call_enabled).toBe(true);
      expect(result.settings.screen_share_enabled).toBe(true);
    });

    it('should handle file transfer settings', async () => {
      // Arrange
      const groupData: CreateGroupData = {
        name: 'File Sharing Group',
        description: 'Group for file sharing',
        type: 'normal',
        settings: {
          file_sharing_enabled: true,
        },
      };

      const mockGroupSettings = {
        id: 'settings:123',
        group_id: mockGroupId,
        file_sharing_enabled: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockClient.create.mockResolvedValueOnce([mockGroup])
        .mockResolvedValueOnce([mockGroupSettings])
        .mockResolvedValueOnce([mockOwnerMember]);

      // Act
      const result = await groupManager.createGroup(groupData);

      // Assert
      expect(result.settings.file_sharing_enabled).toBe(true);
    });

    it('should handle message auto-delete settings', async () => {
      // Arrange
      const groupData: CreateGroupData = {
        name: 'Auto Delete Group',
        description: 'Group with auto-delete messages',
        type: 'normal',
        settings: {
          message_auto_delete_days: 30,
        },
      };

      const mockGroupSettings = {
        id: 'settings:123',
        group_id: mockGroupId,
        message_auto_delete_days: 30,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockClient.create.mockResolvedValueOnce([mockGroup])
        .mockResolvedValueOnce([mockGroupSettings])
        .mockResolvedValueOnce([mockOwnerMember]);

      // Act
      const result = await groupManager.createGroup(groupData);

      // Assert
      expect(result.settings.message_auto_delete_days).toBe(30);
    });

    it('should handle member notification settings', async () => {
      // Arrange
      const groupData: CreateGroupData = {
        name: 'Notification Group',
        description: 'Group with notification settings',
        type: 'normal',
        settings: {
          member_join_notification: false,
          member_leave_notification: false,
        },
      };

      const mockGroupSettings = {
        id: 'settings:123',
        group_id: mockGroupId,
        member_join_notification: false,
        member_leave_notification: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockClient.create.mockResolvedValueOnce([mockGroup])
        .mockResolvedValueOnce([mockGroupSettings])
        .mockResolvedValueOnce([mockOwnerMember]);

      // Act
      const result = await groupManager.createGroup(groupData);

      // Assert
      expect(result.settings.member_join_notification).toBe(false);
      expect(result.settings.member_leave_notification).toBe(false);
    });

    it('should handle role-based permissions correctly', async () => {
      // Arrange
      const addMemberData: AddMemberData = {
        user_ids: ['user:456'],
        role: 'admin',
      };

      const adminMember = {
        id: 'member:admin',
        group_id: mockGroupId,
        user_id: 'user:456',
        role: 'admin' as const,
        permissions: {
          can_send_message: true,
          can_add_member: true,
          can_remove_member: true,
          can_edit_info: true,
          can_pin_message: true,
          can_manage_settings: false, // Admin cannot manage settings
        },
      };

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('return $auth')) {
          return Promise.resolve([{ id: mockUserId, name: 'Test User' }]);
        }
        if (query.includes('SELECT * FROM group_member WHERE')) {
          if (query.includes('user_id = $auth.id')) {
            return Promise.resolve([mockOwnerMember]);
          }
          return Promise.resolve([]);
        }
        if (query.includes('SELECT * FROM message_group')) {
          return Promise.resolve([[{ ...mockGroup, max_members: 500 }]]);
        }
        if (query.includes('SELECT count()')) {
          return Promise.resolve([[{ total: 1 }]]);
        }
        return Promise.resolve([[]]);
      });

      mockClient.create.mockResolvedValue([adminMember]);

      // Act
      const result = await groupManager.addMembers(mockGroupId, addMemberData);

      // Assert
      expect(result[0].role).toBe('admin');
      expect(result[0].permissions?.can_add_member).toBe(true);
      expect(result[0].permissions?.can_manage_settings).toBe(false);
    });

    it('should handle error cases gracefully', async () => {
      // Arrange
      mockClient.create.mockRejectedValue(new Error('Database connection failed'));

      const groupData: CreateGroupData = {
        name: 'Test Group',
        type: 'normal',
      };

      // Act & Assert
      await expect(groupManager.createGroup(groupData))
        .rejects.toThrow('Database connection failed');
    });
  });
});