import { useState, useEffect, useCallback } from 'react';
import { RecordId, Uuid } from 'surrealdb';
import { useSurrealClient } from '@/src/contexts/SurrealProvider';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import groupManager from '@/src/services/groupManager';
import type { 
  ExtendedGroup, 
  ExtendedGroupMember, 
  GroupListItem, 
  GroupSettings,
  CreateGroupRequest,
  UpdateGroupRequest,
  GroupMemberRole
} from '@/src/types/group';
import { WEBRTC_PERMISSION_GROUPS } from '@/src/types/group';

// 用户群组列表Hook
export function useUserGroups(userId?: RecordId | string) {
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const _client = useSurrealClient();

  const loadGroups = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const targetUserId = userId || user?.id;
      if (!targetUserId) {
        throw new Error('未找到用户信息');
      }

      const rawGroups = await groupManager.getUserGroups(targetUserId);
      
      // 转换为GroupListItem格式并获取扩展信息
      const groupListItems: GroupListItem[] = await Promise.all(
        rawGroups.map(async (group) => {
          try {
            // 获取成员数量
            const members = await groupManager.getGroupMembers(group.id);
            const memberCount = members.length;
            
            // 获取当前用户角色
            const currentMember = members.find(m => 
              String(m.user_id) === String(targetUserId)
            );
            const currentUserRole = currentMember?.role || 'member';

            // TODO: 获取最后一条消息信息
            // 这里可以后续集成消息服务获取群组最后消息
            
            return {
              id: group.id,
              name: group.name,
              avatar_url: group.avatar_url,
              type: group.type,
              member_count: memberCount,
              last_message_content: undefined,
              last_message_time: undefined,
              last_message_sender: undefined,
              unread_count: 0, // TODO: 集成消息未读数
              is_muted: currentMember?.is_muted || false,
              current_user_role: currentUserRole
            };
          } catch (err) {
            console.error(`Error processing group ${group.id}:`, err);
            // 返回基础信息，避免整个列表加载失败
            return {
              id: group.id,
              name: group.name,
              avatar_url: group.avatar_url,
              type: group.type,
              member_count: 0,
              unread_count: 0,
              is_muted: false,
              current_user_role: 'member' as const
            };
          }
        })
      );

      setGroups(groupListItems);
    } catch (err) {
      console.error('Error loading user groups:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, user?.id]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const refetch = useCallback(() => {
    loadGroups();
  }, [loadGroups]);

  return {
    groups,
    isLoading,
    error,
    refetch,
    setGroups // 用于乐观更新
  };
}

// 群组详情Hook
export function useGroupDetails(groupId: RecordId | string | null) {
  const [group, setGroup] = useState<ExtendedGroup | null>(null);
  const [members, setMembers] = useState<ExtendedGroupMember[]>([]);
  const [settings, setSettings] = useState<GroupSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const client = useSurrealClient();
  const { user } = useAuth();

  const loadGroupDetails = useCallback(async () => {
    if (!groupId || !client) return;
    
    try {
      setIsLoading(true);
      setError(null);

      // 并行加载群组信息、成员列表、设置
      const [groupData, membersData] = await Promise.all([
        groupManager.getGroup(groupId),
        groupManager.getGroupMembers(groupId)
      ]);

      if (!groupData) {
        throw new Error('群组不存在');
      }

      // 获取群组设置
      const settingsQuery = `SELECT * FROM group_settings WHERE group_id = $group_id`;
      const [settingsData] = await client.query(settingsQuery, {
        group_id: typeof groupId === 'string' ? groupId : String(groupId)
      });

      // 扩展群组信息
      const currentMember = membersData.find(m => String(m.user_id) === String(user?.id));
      const extendedGroup: ExtendedGroup = {
        ...groupData,
        settings: settingsData || undefined,
        member_count: membersData.length,
        current_user_role: currentMember?.role,
        current_user_permissions: currentMember?.permissions
      };

      // 扩展成员信息（获取用户详细信息）
      const extendedMembers: ExtendedGroupMember[] = await Promise.all(
        membersData.map(async (member) => {
          try {
            // 获取用户信息
            const userQuery = `SELECT name, avatar_url, email FROM user WHERE id = $user_id`;
            const [userData] = await client.query(userQuery, {
              user_id: member.user_id
            });

            return {
              ...member,
              user_name: userData?.name || '未知用户',
              user_avatar: userData?.avatar_url,
              user_email: userData?.email,
              is_online: false // TODO: 集成在线状态
            };
          } catch (err) {
            console.error(`Error loading user data for member ${member.user_id}:`, err);
            return {
              ...member,
              user_name: '未知用户',
              is_online: false
            };
          }
        })
      );

      setGroup(extendedGroup);
      setMembers(extendedMembers);
      setSettings(settingsData);
    } catch (err) {
      console.error('Error loading group details:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [groupId, client, user?.id]);

  useEffect(() => {
    loadGroupDetails();
  }, [loadGroupDetails]);

  const refetch = useCallback(() => {
    loadGroupDetails();
  }, [loadGroupDetails]);

  return {
    group,
    members,
    settings,
    isLoading,
    error,
    refetch,
    setGroup,
    setMembers,
    setSettings
  };
}

// 群组操作Hook
export function useGroupOperations() {
  const { showSuccess, showError } = useSnackbar();
  const [isLoading, setIsLoading] = useState(false);

  const createGroup = useCallback(async (data: CreateGroupRequest) => {
    try {
      setIsLoading(true);
      const result = await groupManager.createGroup(data);
      showSuccess('群组创建成功');
      return result;
    } catch (error) {
      console.error('Error creating group:', error);
      showError(`创建群组失败: ${(error as Error).message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError]);

  const updateGroup = useCallback(async (groupId: RecordId | string, data: UpdateGroupRequest) => {
    try {
      setIsLoading(true);
      const result = await groupManager.updateGroup(groupId, data);
      showSuccess('群组信息更新成功');
      return result;
    } catch (error) {
      console.error('Error updating group:', error);
      showError(`更新群组失败: ${(error as Error).message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError]);

  const deleteGroup = useCallback(async (groupId: RecordId | string) => {
    try {
      setIsLoading(true);
      await groupManager.deleteGroup(groupId);
      showSuccess('群组删除成功');
      return true;
    } catch (error) {
      console.error('Error deleting group:', error);
      showError(`删除群组失败: ${(error as Error).message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError]);

  const addMembers = useCallback(async (groupId: RecordId | string, userIds: (RecordId | string)[], role?: 'admin' | 'member') => {
    try {
      setIsLoading(true);
      const result = await groupManager.addMembers(groupId, { user_ids: userIds, role });
      showSuccess(`成功添加 ${result.length} 名成员`);
      return result;
    } catch (error) {
      console.error('Error adding members:', error);
      showError(`添加成员失败: ${(error as Error).message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError]);

  const removeMember = useCallback(async (groupId: RecordId | string, userId: RecordId | string) => {
    try {
      setIsLoading(true);
      await groupManager.removeMember(groupId, userId);
      showSuccess('成员移除成功');
      return true;
    } catch (error) {
      console.error('Error removing member:', error);
      showError(`移除成员失败: ${(error as Error).message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError]);

  const updateMemberRole = useCallback(async (groupId: RecordId | string, userId: RecordId | string, role: 'admin' | 'member') => {
    try {
      setIsLoading(true);
      const result = await groupManager.updateMemberRole(groupId, { user_id: userId, role });
      showSuccess('成员角色更新成功');
      return result;
    } catch (error) {
      console.error('Error updating member role:', error);
      showError(`更新成员角色失败: ${(error as Error).message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError]);

  const transferOwnership = useCallback(async (groupId: RecordId | string, newOwnerId: RecordId | string) => {
    try {
      setIsLoading(true);
      await groupManager.transferOwnership(groupId, newOwnerId);
      showSuccess('群主转让成功');
      return true;
    } catch (error) {
      console.error('Error transferring ownership:', error);
      showError(`转让群主失败: ${(error as Error).message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError]);

  const leaveGroup = useCallback(async (groupId: RecordId | string) => {
    try {
      setIsLoading(true);
      await groupManager.leaveGroup(groupId);
      showSuccess('已退出群组');
      return true;
    } catch (error) {
      console.error('Error leaving group:', error);
      showError(`退出群组失败: ${(error as Error).message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError]);

  return {
    createGroup,
    updateGroup,
    deleteGroup,
    addMembers,
    removeMember,
    updateMemberRole,
    transferOwnership,
    leaveGroup,
    isLoading
  };
}

// 群组实时更新Hook（使用SurrealDB的Live Query）
export function useGroupLiveUpdates(groupId: RecordId | string | null) {
  const [liveQueryId, setLiveQueryId] = useState<Uuid | null>(null);
  const client = useSurrealClient();

  const setupLiveQuery = useCallback(async () => {
    if (!groupId || !client) return;

    try {
      // 验证 groupId 格式: 应该是 'group:UUID' 形式
      const groupIdStr = typeof groupId === 'string' ? groupId : String(groupId);
      const match = groupIdStr.match(/^group:([0-9a-fA-F-]{36})$/);
      if (!match) {
        console.error('Invalid groupId format for live query:', groupId);
        return;
      }
      const groupUuid = match[1];

      // 监听群组成员变化
      const query = `LIVE SELECT * FROM group_member WHERE group_id = type::thing('group', '${groupUuid}')`;
      
      const queryId = await client.live(query, (action: string, data: unknown) => {
        // 处理实时更新
        console.log('Group member update:', action, data);
        // 这里可以触发组件重新加载或更新状态
        // 例如通过事件系统通知其他组件
        window.dispatchEvent(new CustomEvent('groupMemberUpdate', { 
          detail: { action, data, groupId } 
        }));
      });

      setLiveQueryId(queryId);
    } catch (error) {
      console.error('Error setting up group live query:', error);
    }
  }, [groupId, client]);

  const cleanup = useCallback(async () => {
    if (liveQueryId && client) {
      try {
        await client.kill(liveQueryId);
        setLiveQueryId(null);
      } catch (error) {
        console.error('Error cleaning up live query:', error);
      }
    }
  }, [liveQueryId, client]);

  useEffect(() => {
    setupLiveQuery();
    return () => {
      cleanup();
    };
  }, [setupLiveQuery, cleanup]);

  return { liveQueryId, cleanup };
}

// 群组权限检查Hook
export function useGroupPermissions(groupId: RecordId | string | null, userId?: RecordId | string) {
  const [permissions, setPermissions] = useState<{
    canSendMessage: boolean;
    canAddMember: boolean;
    canRemoveMember: boolean;
    canEditInfo: boolean;
    canPinMessage: boolean;
    canManageSettings: boolean;
    isOwner: boolean;
    isAdmin: boolean;
  }>({
    canSendMessage: false,
    canAddMember: false,
    canRemoveMember: false,
    canEditInfo: false,
    canPinMessage: false,
    canManageSettings: false,
    isOwner: false,
    isAdmin: false
  });

  const { user } = useAuth();
  const client = useSurrealClient();

  const checkPermissions = useCallback(async () => {
    if (!groupId || !client) return;

    try {
      const targetUserId = userId || user?.id;
      if (!targetUserId) return;

      const memberQuery = `SELECT * FROM group_member WHERE group_id = $group_id AND user_id = $user_id`;
      const [member] = await client.query(memberQuery, {
        group_id: typeof groupId === 'string' ? groupId : String(groupId),
        user_id: targetUserId
      });

      if (!member) {
        // 用户不是群组成员，所有权限为false
        return;
      }

      const isOwner = member.role === 'owner';
      const isAdmin = member.role === 'admin' || isOwner;
      const memberPermissions = member.permissions || {};

      setPermissions({
        canSendMessage: isOwner || memberPermissions.can_send_message || false,
        canAddMember: isOwner || memberPermissions.can_add_member || false,
        canRemoveMember: isOwner || memberPermissions.can_remove_member || false,
        canEditInfo: isOwner || memberPermissions.can_edit_info || false,
        canPinMessage: isOwner || memberPermissions.can_pin_message || false,
        canManageSettings: isOwner || memberPermissions.can_manage_settings || false,
        isOwner,
        isAdmin
      });
    } catch (error) {
      console.error('Error checking group permissions:', error);
    }
  }, [groupId, userId, user?.id, client]);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  return permissions;
}

// 群组WebRTC权限检查Hook
export function useGroupWebRTCPermissions(groupId: RecordId | string | null, userId?: RecordId | string) {
  const [webrtcPermissions, setWebRTCPermissions] = useState<{
    // 语音通话权限
    canInitiateVoiceCall: boolean;
    canAnswerVoiceCall: boolean;
    
    // 视频通话权限  
    canInitiateVideoCall: boolean;
    canAnswerVideoCall: boolean;
    
    // 群组通话权限
    canCreateGroupCall: boolean;
    canJoinGroupCall: boolean;
    canManageGroupCall: boolean;
    
    // 媒体控制权限
    canControlMicrophone: boolean;
    canControlCamera: boolean;
    canShareScreen: boolean;
    canRecordCall: boolean;
    
    // 通话管理权限
    canEndCall: boolean;
    canRejectCall: boolean;
    canInviteToCall: boolean;
    canControlOthersMedia: boolean;
    
    // 角色信息
    isOwner: boolean;
    isAdmin: boolean;
    role: GroupMemberRole | null;
  }>({
    canInitiateVoiceCall: false,
    canAnswerVoiceCall: false,
    canInitiateVideoCall: false,
    canAnswerVideoCall: false,
    canCreateGroupCall: false,
    canJoinGroupCall: false,
    canManageGroupCall: false,
    canControlMicrophone: false,
    canControlCamera: false,
    canShareScreen: false,
    canRecordCall: false,
    canEndCall: false,
    canRejectCall: false,
    canInviteToCall: false,
    canControlOthersMedia: false,
    isOwner: false,
    isAdmin: false,
    role: null
  });

  const { user } = useAuth();
  const client = useSurrealClient();

  const checkWebRTCPermissions = useCallback(async () => {
    if (!groupId || !client) return;

    try {
      const targetUserId = userId || user?.id;
      if (!targetUserId) return;

      // 查询群组成员信息和群组设置
      const [memberResult, settingsResult] = await Promise.all([
        client.query(`SELECT * FROM group_member WHERE group_id = $group_id AND user_id = $user_id`, {
          group_id: typeof groupId === 'string' ? groupId : String(groupId),
          user_id: targetUserId
        }),
        client.query(`SELECT * FROM group_settings WHERE group_id = $group_id`, {
          group_id: typeof groupId === 'string' ? groupId : String(groupId)
        })
      ]);

      const [member] = memberResult;
      const [groupSettings] = settingsResult;

      if (!member) {
        // 用户不是群组成员，所有权限为false
        return;
      }

      const isOwner = member.role === 'owner';
      const isAdmin = member.role === 'admin' || isOwner;
      const memberPermissions = member.permissions || {};

      // 检查群组级别的WebRTC设置
      const groupWebRTCEnabled = {
        voiceCalls: groupSettings?.webrtc_voice_calls_enabled !== false,
        videoCalls: groupSettings?.webrtc_video_calls_enabled !== false,
        groupCalls: groupSettings?.webrtc_group_calls_enabled !== false,
        screenSharing: groupSettings?.webrtc_screen_sharing_enabled !== false,
        callRecording: groupSettings?.webrtc_call_recording_enabled === true
      };

      // 设置WebRTC权限（群组设置 && 个人权限）
      setWebRTCPermissions({
        // 语音通话权限
        canInitiateVoiceCall: groupWebRTCEnabled.voiceCalls && (isOwner || memberPermissions.can_initiate_voice_call || false),
        canAnswerVoiceCall: groupWebRTCEnabled.voiceCalls && (isOwner || memberPermissions.can_answer_voice_call || false),
        
        // 视频通话权限
        canInitiateVideoCall: groupWebRTCEnabled.videoCalls && (isOwner || memberPermissions.can_initiate_video_call || false),
        canAnswerVideoCall: groupWebRTCEnabled.videoCalls && (isOwner || memberPermissions.can_answer_video_call || false),
        
        // 群组通话权限
        canCreateGroupCall: groupWebRTCEnabled.groupCalls && (isOwner || memberPermissions.can_create_group_call || false),
        canJoinGroupCall: groupWebRTCEnabled.groupCalls && (isOwner || memberPermissions.can_join_group_call || false),
        canManageGroupCall: groupWebRTCEnabled.groupCalls && (isOwner || memberPermissions.can_manage_group_call || false),
        
        // 媒体控制权限
        canControlMicrophone: (isOwner || memberPermissions.can_control_microphone || false),
        canControlCamera: (isOwner || memberPermissions.can_control_camera || false),
        canShareScreen: groupWebRTCEnabled.screenSharing && (isOwner || memberPermissions.can_share_screen || false),
        canRecordCall: groupWebRTCEnabled.callRecording && (isOwner || memberPermissions.can_record_call || false),
        
        // 通话管理权限
        canEndCall: (isOwner || memberPermissions.can_end_call || false),
        canRejectCall: (isOwner || memberPermissions.can_reject_call || false),
        canInviteToCall: (isOwner || memberPermissions.can_invite_to_call || false),
        canControlOthersMedia: (isOwner || memberPermissions.can_control_others_media || false),
        
        // 角色信息
        isOwner,
        isAdmin,
        role: member.role as GroupMemberRole
      });
    } catch (error) {
      console.error('Error checking group WebRTC permissions:', error);
    }
  }, [groupId, userId, user?.id, client]);

  useEffect(() => {
    checkWebRTCPermissions();
  }, [checkWebRTCPermissions]);

  // 提供权限检查的便捷方法
  const hasPermission = useCallback((permission: keyof typeof webrtcPermissions) => {
    return webrtcPermissions[permission] as boolean;
  }, [webrtcPermissions]);

  // 提供权限组检查方法
  const hasPermissionGroup = useCallback((group: keyof typeof WEBRTC_PERMISSION_GROUPS) => {
    const permissions = WEBRTC_PERMISSION_GROUPS[group];
    return permissions.every(permission => {
      // 映射权限名称到状态名称
      const stateKey = permission.replace(/^can_/, '').replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      const camelCaseKey = `can${stateKey.charAt(0).toUpperCase()}${stateKey.slice(1)}` as keyof typeof webrtcPermissions;
      return webrtcPermissions[camelCaseKey] as boolean;
    });
  }, [webrtcPermissions]);

  return {
    ...webrtcPermissions,
    hasPermission,
    hasPermissionGroup,
    refetch: checkWebRTCPermissions
  };
}