import { useCallback, useMemo } from 'react';
import { useAuth, PermissionCheckResult } from '@/src/contexts/AuthContext';

// WebRTC权限ID常量
export const WEBRTC_PERMISSIONS = {
  // 基础通话权限
  VOICE_CALL_INITIATE: 'webrtc_voice_call_initiate',
  VIDEO_CALL_INITIATE: 'webrtc_video_call_initiate',
  CALL_ANSWER: 'webrtc_call_answer',
  CALL_REJECT: 'webrtc_call_reject',
  CALL_END: 'webrtc_call_end',

  // 媒体控制权限
  CAMERA_TOGGLE: 'webrtc_camera_toggle',
  MICROPHONE_TOGGLE: 'webrtc_microphone_toggle',
  SPEAKER_TOGGLE: 'webrtc_speaker_toggle',
  SCREEN_SHARE: 'webrtc_screen_share',

  // 群组通话权限
  GROUP_CALL_CREATE: 'webrtc_group_call_create',
  GROUP_CALL_JOIN: 'webrtc_group_call_join',
  GROUP_CALL_INVITE: 'webrtc_group_call_invite',
  GROUP_CALL_MANAGE: 'webrtc_group_call_manage',

  // 文件传输权限
  FILE_SEND: 'webrtc_file_send',
  FILE_RECEIVE: 'webrtc_file_receive',
  MEDIA_UPLOAD: 'webrtc_media_upload',

  // 消息系统权限
  MESSAGE_SEND: 'webrtc_message_send',
  MESSAGE_VIEW: 'webrtc_message_view',
  MESSAGE_DELETE: 'webrtc_message_delete',

  // 高级功能权限
  RECORDING_START: 'webrtc_recording_start',
  RECORDING_STOP: 'webrtc_recording_stop',
  QUALITY_CONTROL: 'webrtc_quality_control',
  NETWORK_MONITOR: 'webrtc_network_monitor'
} as const;

// WebRTC权限组合类型
export type WebRTCPermissionId = typeof WEBRTC_PERMISSIONS[keyof typeof WEBRTC_PERMISSIONS];

// 权限组合定义
export const PERMISSION_GROUPS = {
  // 基础通话功能
  BASIC_CALLING: [
    WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE,
    WEBRTC_PERMISSIONS.VIDEO_CALL_INITIATE,
    WEBRTC_PERMISSIONS.CALL_ANSWER,
    WEBRTC_PERMISSIONS.CALL_REJECT,
    WEBRTC_PERMISSIONS.CALL_END
  ],

  // 媒体控制功能
  MEDIA_CONTROLS: [
    WEBRTC_PERMISSIONS.CAMERA_TOGGLE,
    WEBRTC_PERMISSIONS.MICROPHONE_TOGGLE,
    WEBRTC_PERMISSIONS.SPEAKER_TOGGLE,
    WEBRTC_PERMISSIONS.SCREEN_SHARE
  ],

  // 群组通话功能
  GROUP_CALLING: [
    WEBRTC_PERMISSIONS.GROUP_CALL_CREATE,
    WEBRTC_PERMISSIONS.GROUP_CALL_JOIN,
    WEBRTC_PERMISSIONS.GROUP_CALL_INVITE,
    WEBRTC_PERMISSIONS.GROUP_CALL_MANAGE
  ],

  // 文件传输功能
  FILE_TRANSFER: [
    WEBRTC_PERMISSIONS.FILE_SEND,
    WEBRTC_PERMISSIONS.FILE_RECEIVE,
    WEBRTC_PERMISSIONS.MEDIA_UPLOAD
  ],

  // 消息功能
  MESSAGING: [
    WEBRTC_PERMISSIONS.MESSAGE_SEND,
    WEBRTC_PERMISSIONS.MESSAGE_VIEW,
    WEBRTC_PERMISSIONS.MESSAGE_DELETE
  ],

  // 管理员功能
  ADMIN_FEATURES: [
    WEBRTC_PERMISSIONS.RECORDING_START,
    WEBRTC_PERMISSIONS.RECORDING_STOP,
    WEBRTC_PERMISSIONS.QUALITY_CONTROL,
    WEBRTC_PERMISSIONS.NETWORK_MONITOR
  ]
} as const;

/**
 * WebRTC权限检查结果接口
 */
export interface WebRTCPermissionResult extends PermissionCheckResult {
  permissionId: WebRTCPermissionId;
}

/**
 * WebRTC权限组合检查结果接口
 */
export interface WebRTCPermissionGroupResult {
  permissions: Record<WebRTCPermissionId, boolean>;
  hasAnyPermission: boolean;
  hasAllPermissions: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * WebRTC权限检查hook
 * 提供WebRTC功能的统一权限检查接口
 */
export const useWebRTCPermissions = () => {
  const { 
    useOperationPermission, 
    useOperationPermissions, 
    preloadOperationPermission, 
    preloadOperationPermissions 
  } = useAuth();

  /**
   * 检查单个WebRTC权限
   */
  const checkPermission = useCallback((permissionId: WebRTCPermissionId): WebRTCPermissionResult => {
    const result = useOperationPermission(permissionId);
    return {
      ...result,
      permissionId
    };
  }, [useOperationPermission]);

  /**
   * 检查多个WebRTC权限
   */
  const checkPermissions = useCallback((permissionIds: WebRTCPermissionId[]): WebRTCPermissionGroupResult => {
    const result = useOperationPermissions(permissionIds);
    
    const hasAnyPermission = Object.values(result.permissions).some(hasPermission => hasPermission);
    const hasAllPermissions = Object.values(result.permissions).every(hasPermission => hasPermission);

    return {
      permissions: result.permissions as Record<WebRTCPermissionId, boolean>,
      hasAnyPermission,
      hasAllPermissions,
      isLoading: result.isLoading,
      error: result.error
    };
  }, [useOperationPermissions]);

  /**
   * 检查权限组
   */
  const checkPermissionGroup = useCallback((groupKey: keyof typeof PERMISSION_GROUPS): WebRTCPermissionGroupResult => {
    const permissionIds = PERMISSION_GROUPS[groupKey] as WebRTCPermissionId[];
    return checkPermissions(permissionIds);
  }, [checkPermissions]);

  /**
   * 预加载WebRTC权限
   */
  const preloadPermission = useCallback(async (permissionId: WebRTCPermissionId): Promise<void> => {
    return preloadOperationPermission(permissionId);
  }, [preloadOperationPermission]);

  /**
   * 批量预加载WebRTC权限
   */
  const preloadPermissions = useCallback(async (permissionIds: WebRTCPermissionId[]): Promise<void> => {
    return preloadOperationPermissions(permissionIds);
  }, [preloadOperationPermissions]);

  /**
   * 预加载权限组
   */
  const preloadPermissionGroup = useCallback(async (groupKey: keyof typeof PERMISSION_GROUPS): Promise<void> => {
    const permissionIds = PERMISSION_GROUPS[groupKey] as WebRTCPermissionId[];
    return preloadPermissions(permissionIds);
  }, [preloadPermissions]);

  // 便捷的权限检查方法
  const permissions = useMemo(() => ({
    // 基础通话权限
    canInitiateVoiceCall: () => checkPermission(WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE),
    canInitiateVideoCall: () => checkPermission(WEBRTC_PERMISSIONS.VIDEO_CALL_INITIATE),
    canAnswerCall: () => checkPermission(WEBRTC_PERMISSIONS.CALL_ANSWER),
    canRejectCall: () => checkPermission(WEBRTC_PERMISSIONS.CALL_REJECT),
    canEndCall: () => checkPermission(WEBRTC_PERMISSIONS.CALL_END),

    // 媒体控制权限
    canToggleCamera: () => checkPermission(WEBRTC_PERMISSIONS.CAMERA_TOGGLE),
    canToggleMicrophone: () => checkPermission(WEBRTC_PERMISSIONS.MICROPHONE_TOGGLE),
    canToggleSpeaker: () => checkPermission(WEBRTC_PERMISSIONS.SPEAKER_TOGGLE),
    canShareScreen: () => checkPermission(WEBRTC_PERMISSIONS.SCREEN_SHARE),

    // 群组通话权限
    canCreateGroupCall: () => checkPermission(WEBRTC_PERMISSIONS.GROUP_CALL_CREATE),
    canJoinGroupCall: () => checkPermission(WEBRTC_PERMISSIONS.GROUP_CALL_JOIN),
    canInviteToGroupCall: () => checkPermission(WEBRTC_PERMISSIONS.GROUP_CALL_INVITE),
    canManageGroupCall: () => checkPermission(WEBRTC_PERMISSIONS.GROUP_CALL_MANAGE),

    // 文件传输权限
    canSendFile: () => checkPermission(WEBRTC_PERMISSIONS.FILE_SEND),
    canReceiveFile: () => checkPermission(WEBRTC_PERMISSIONS.FILE_RECEIVE),
    canUploadMedia: () => checkPermission(WEBRTC_PERMISSIONS.MEDIA_UPLOAD),

    // 消息权限
    canSendMessage: () => checkPermission(WEBRTC_PERMISSIONS.MESSAGE_SEND),
    canViewMessage: () => checkPermission(WEBRTC_PERMISSIONS.MESSAGE_VIEW),
    canDeleteMessage: () => checkPermission(WEBRTC_PERMISSIONS.MESSAGE_DELETE),

    // 高级功能权限
    canStartRecording: () => checkPermission(WEBRTC_PERMISSIONS.RECORDING_START),
    canStopRecording: () => checkPermission(WEBRTC_PERMISSIONS.RECORDING_STOP),
    canControlQuality: () => checkPermission(WEBRTC_PERMISSIONS.QUALITY_CONTROL),
    canMonitorNetwork: () => checkPermission(WEBRTC_PERMISSIONS.NETWORK_MONITOR),

    // 权限组检查
    basicCalling: () => checkPermissionGroup('BASIC_CALLING'),
    mediaControls: () => checkPermissionGroup('MEDIA_CONTROLS'),
    groupCalling: () => checkPermissionGroup('GROUP_CALLING'),
    fileTransfer: () => checkPermissionGroup('FILE_TRANSFER'),
    messaging: () => checkPermissionGroup('MESSAGING'),
    adminFeatures: () => checkPermissionGroup('ADMIN_FEATURES')
  }), [checkPermission, checkPermissionGroup]);

  return {
    // 基础权限检查方法
    checkPermission,
    checkPermissions,
    checkPermissionGroup,

    // 权限预加载方法
    preloadPermission,
    preloadPermissions,
    preloadPermissionGroup,

    // 便捷的权限检查方法
    permissions,

    // 权限常量
    WEBRTC_PERMISSIONS,
    PERMISSION_GROUPS
  };
};

/**
 * 便捷的单个权限检查hook
 */
export const useWebRTCPermission = (permissionId: WebRTCPermissionId): WebRTCPermissionResult => {
  const { checkPermission } = useWebRTCPermissions();
  return checkPermission(permissionId);
};

/**
 * 便捷的权限组检查hook
 */
export const useWebRTCPermissionGroup = (groupKey: keyof typeof PERMISSION_GROUPS): WebRTCPermissionGroupResult => {
  const { checkPermissionGroup } = useWebRTCPermissions();
  return checkPermissionGroup(groupKey);
};

export default useWebRTCPermissions;