import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { 
  useWebRTCPermissions, 
  useWebRTCPermission, 
  useWebRTCPermissionGroup,
  WEBRTC_PERMISSIONS,
  PERMISSION_GROUPS,
  type WebRTCPermissionId
} from '@/src/hooks/useWebRTCPermissions';
import { useAuth } from '@/src/contexts/AuthContext';

// Mock AuthContext
vi.mock('@/src/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  PermissionCheckResult: {}
}));

describe('useWebRTCPermissions Hook', () => {
  // Mock数据
  let mockUseOperationPermission: ReturnType<typeof vi.fn>;
  let mockUseOperationPermissions: ReturnType<typeof vi.fn>;
  let mockPreloadOperationPermission: ReturnType<typeof vi.fn>;
  let mockPreloadOperationPermissions: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // 初始化Mock函数
    mockUseOperationPermission = vi.fn();
    mockUseOperationPermissions = vi.fn();
    mockPreloadOperationPermission = vi.fn();
    mockPreloadOperationPermissions = vi.fn();

    // 设置默认Mock返回值
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      useOperationPermission: mockUseOperationPermission,
      useOperationPermissions: mockUseOperationPermissions,
      preloadOperationPermission: mockPreloadOperationPermission,
      preloadOperationPermissions: mockPreloadOperationPermissions
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('基础权限检查', () => {
    it('应该正确检查单个WebRTC权限', () => {
      // 设置Mock返回值
      const mockPermissionResult = {
        hasPermission: true,
        isLoading: false,
        error: null,
        reason: null
      };
      mockUseOperationPermission.mockReturnValue(mockPermissionResult);

      const { result } = renderHook(() => useWebRTCPermissions());

      const permissionResult = result.current.checkPermission(WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE);

      expect(permissionResult).toEqual({
        ...mockPermissionResult,
        permissionId: WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE
      });
      expect(mockUseOperationPermission).toHaveBeenCalledWith(WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE);
    });

    it('应该正确检查多个WebRTC权限', () => {
      // 设置Mock返回值
      const mockPermissionsResult = {
        permissions: {
          [WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE]: true,
          [WEBRTC_PERMISSIONS.VIDEO_CALL_INITIATE]: false,
          [WEBRTC_PERMISSIONS.CALL_ANSWER]: true
        },
        isLoading: false,
        error: null
      };
      mockUseOperationPermissions.mockReturnValue(mockPermissionsResult);

      const { result } = renderHook(() => useWebRTCPermissions());

      const permissionIds = [
        WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE,
        WEBRTC_PERMISSIONS.VIDEO_CALL_INITIATE,
        WEBRTC_PERMISSIONS.CALL_ANSWER
      ] as WebRTCPermissionId[];

      const permissionsResult = result.current.checkPermissions(permissionIds);

      expect(permissionsResult).toEqual({
        permissions: mockPermissionsResult.permissions,
        hasAnyPermission: true, // 至少有一个权限为true
        hasAllPermissions: false, // 不是所有权限都为true
        isLoading: false,
        error: null
      });
      expect(mockUseOperationPermissions).toHaveBeenCalledWith(permissionIds);
    });

    it('应该正确处理所有权限都为true的情况', () => {
      const mockPermissionsResult = {
        permissions: {
          [WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE]: true,
          [WEBRTC_PERMISSIONS.VIDEO_CALL_INITIATE]: true,
          [WEBRTC_PERMISSIONS.CALL_ANSWER]: true
        },
        isLoading: false,
        error: null
      };
      mockUseOperationPermissions.mockReturnValue(mockPermissionsResult);

      const { result } = renderHook(() => useWebRTCPermissions());

      const permissionIds = [
        WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE,
        WEBRTC_PERMISSIONS.VIDEO_CALL_INITIATE,
        WEBRTC_PERMISSIONS.CALL_ANSWER
      ] as WebRTCPermissionId[];

      const permissionsResult = result.current.checkPermissions(permissionIds);

      expect(permissionsResult.hasAnyPermission).toBe(true);
      expect(permissionsResult.hasAllPermissions).toBe(true);
    });

    it('应该正确处理所有权限都为false的情况', () => {
      const mockPermissionsResult = {
        permissions: {
          [WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE]: false,
          [WEBRTC_PERMISSIONS.VIDEO_CALL_INITIATE]: false,
          [WEBRTC_PERMISSIONS.CALL_ANSWER]: false
        },
        isLoading: false,
        error: null
      };
      mockUseOperationPermissions.mockReturnValue(mockPermissionsResult);

      const { result } = renderHook(() => useWebRTCPermissions());

      const permissionIds = [
        WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE,
        WEBRTC_PERMISSIONS.VIDEO_CALL_INITIATE,
        WEBRTC_PERMISSIONS.CALL_ANSWER
      ] as WebRTCPermissionId[];

      const permissionsResult = result.current.checkPermissions(permissionIds);

      expect(permissionsResult.hasAnyPermission).toBe(false);
      expect(permissionsResult.hasAllPermissions).toBe(false);
    });
  });

  describe('权限组检查', () => {
    it('应该正确检查基础通话权限组', () => {
      const mockPermissionsResult = {
        permissions: {
          [WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE]: true,
          [WEBRTC_PERMISSIONS.VIDEO_CALL_INITIATE]: true,
          [WEBRTC_PERMISSIONS.CALL_ANSWER]: true,
          [WEBRTC_PERMISSIONS.CALL_REJECT]: false,
          [WEBRTC_PERMISSIONS.CALL_END]: true
        },
        isLoading: false,
        error: null
      };
      mockUseOperationPermissions.mockReturnValue(mockPermissionsResult);

      const { result } = renderHook(() => useWebRTCPermissions());

      const groupResult = result.current.checkPermissionGroup('BASIC_CALLING');

      expect(groupResult).toEqual({
        permissions: mockPermissionsResult.permissions,
        hasAnyPermission: true,
        hasAllPermissions: false,
        isLoading: false,
        error: null
      });
      expect(mockUseOperationPermissions).toHaveBeenCalledWith(PERMISSION_GROUPS.BASIC_CALLING);
    });

    it('应该正确检查媒体控制权限组', () => {
      const mockPermissionsResult = {
        permissions: {
          [WEBRTC_PERMISSIONS.CAMERA_TOGGLE]: true,
          [WEBRTC_PERMISSIONS.MICROPHONE_TOGGLE]: true,
          [WEBRTC_PERMISSIONS.SPEAKER_TOGGLE]: true,
          [WEBRTC_PERMISSIONS.SCREEN_SHARE]: true
        },
        isLoading: false,
        error: null
      };
      mockUseOperationPermissions.mockReturnValue(mockPermissionsResult);

      const { result } = renderHook(() => useWebRTCPermissions());

      const groupResult = result.current.checkPermissionGroup('MEDIA_CONTROLS');

      expect(groupResult.hasAllPermissions).toBe(true);
      expect(mockUseOperationPermissions).toHaveBeenCalledWith(PERMISSION_GROUPS.MEDIA_CONTROLS);
    });

    it('应该正确检查群组通话权限组', () => {
      const mockPermissionsResult = {
        permissions: {
          [WEBRTC_PERMISSIONS.GROUP_CALL_CREATE]: false,
          [WEBRTC_PERMISSIONS.GROUP_CALL_JOIN]: true,
          [WEBRTC_PERMISSIONS.GROUP_CALL_INVITE]: false,
          [WEBRTC_PERMISSIONS.GROUP_CALL_MANAGE]: false
        },
        isLoading: false,
        error: null
      };
      mockUseOperationPermissions.mockReturnValue(mockPermissionsResult);

      const { result } = renderHook(() => useWebRTCPermissions());

      const groupResult = result.current.checkPermissionGroup('GROUP_CALLING');

      expect(groupResult.hasAnyPermission).toBe(true);
      expect(groupResult.hasAllPermissions).toBe(false);
      expect(mockUseOperationPermissions).toHaveBeenCalledWith(PERMISSION_GROUPS.GROUP_CALLING);
    });

    it('应该正确检查文件传输权限组', () => {
      const mockPermissionsResult = {
        permissions: {
          [WEBRTC_PERMISSIONS.FILE_SEND]: true,
          [WEBRTC_PERMISSIONS.FILE_RECEIVE]: true,
          [WEBRTC_PERMISSIONS.MEDIA_UPLOAD]: false
        },
        isLoading: false,
        error: null
      };
      mockUseOperationPermissions.mockReturnValue(mockPermissionsResult);

      const { result } = renderHook(() => useWebRTCPermissions());

      const groupResult = result.current.checkPermissionGroup('FILE_TRANSFER');

      expect(groupResult.hasAnyPermission).toBe(true);
      expect(groupResult.hasAllPermissions).toBe(false);
      expect(mockUseOperationPermissions).toHaveBeenCalledWith(PERMISSION_GROUPS.FILE_TRANSFER);
    });

    it('应该正确检查消息权限组', () => {
      const mockPermissionsResult = {
        permissions: {
          [WEBRTC_PERMISSIONS.MESSAGE_SEND]: true,
          [WEBRTC_PERMISSIONS.MESSAGE_VIEW]: true,
          [WEBRTC_PERMISSIONS.MESSAGE_DELETE]: true
        },
        isLoading: false,
        error: null
      };
      mockUseOperationPermissions.mockReturnValue(mockPermissionsResult);

      const { result } = renderHook(() => useWebRTCPermissions());

      const groupResult = result.current.checkPermissionGroup('MESSAGING');

      expect(groupResult.hasAllPermissions).toBe(true);
      expect(mockUseOperationPermissions).toHaveBeenCalledWith(PERMISSION_GROUPS.MESSAGING);
    });

    it('应该正确检查管理员功能权限组', () => {
      const mockPermissionsResult = {
        permissions: {
          [WEBRTC_PERMISSIONS.RECORDING_START]: false,
          [WEBRTC_PERMISSIONS.RECORDING_STOP]: false,
          [WEBRTC_PERMISSIONS.QUALITY_CONTROL]: false,
          [WEBRTC_PERMISSIONS.NETWORK_MONITOR]: false
        },
        isLoading: false,
        error: null
      };
      mockUseOperationPermissions.mockReturnValue(mockPermissionsResult);

      const { result } = renderHook(() => useWebRTCPermissions());

      const groupResult = result.current.checkPermissionGroup('ADMIN_FEATURES');

      expect(groupResult.hasAnyPermission).toBe(false);
      expect(groupResult.hasAllPermissions).toBe(false);
      expect(mockUseOperationPermissions).toHaveBeenCalledWith(PERMISSION_GROUPS.ADMIN_FEATURES);
    });
  });

  describe('权限预加载', () => {
    it('应该正确预加载单个权限', async () => {
      mockPreloadOperationPermission.mockResolvedValue(undefined);

      const { result } = renderHook(() => useWebRTCPermissions());

      await act(async () => {
        await result.current.preloadPermission(WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE);
      });

      expect(mockPreloadOperationPermission).toHaveBeenCalledWith(WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE);
    });

    it('应该正确预加载多个权限', async () => {
      mockPreloadOperationPermissions.mockResolvedValue(undefined);

      const { result } = renderHook(() => useWebRTCPermissions());

      const permissionIds = [
        WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE,
        WEBRTC_PERMISSIONS.VIDEO_CALL_INITIATE
      ] as WebRTCPermissionId[];

      await act(async () => {
        await result.current.preloadPermissions(permissionIds);
      });

      expect(mockPreloadOperationPermissions).toHaveBeenCalledWith(permissionIds);
    });

    it('应该正确预加载权限组', async () => {
      mockPreloadOperationPermissions.mockResolvedValue(undefined);

      const { result } = renderHook(() => useWebRTCPermissions());

      await act(async () => {
        await result.current.preloadPermissionGroup('BASIC_CALLING');
      });

      expect(mockPreloadOperationPermissions).toHaveBeenCalledWith(PERMISSION_GROUPS.BASIC_CALLING);
    });

    it('应该处理预加载错误', async () => {
      const error = new Error('Preload failed');
      mockPreloadOperationPermission.mockRejectedValue(error);

      const { result } = renderHook(() => useWebRTCPermissions());

      await expect(
        result.current.preloadPermission(WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE)
      ).rejects.toThrow('Preload failed');
    });
  });

  describe('便捷权限检查方法', () => {
    beforeEach(() => {
      // 为便捷方法设置Mock
      mockUseOperationPermission.mockReturnValue({
        hasPermission: true,
        isLoading: false,
        error: null,
        reason: null
      });
    });

    it('应该提供基础通话权限检查方法', () => {
      const { result } = renderHook(() => useWebRTCPermissions());

      const voiceCallResult = result.current.permissions.canInitiateVoiceCall();
      const videoCallResult = result.current.permissions.canInitiateVideoCall();
      const answerCallResult = result.current.permissions.canAnswerCall();
      const rejectCallResult = result.current.permissions.canRejectCall();
      const endCallResult = result.current.permissions.canEndCall();

      expect(voiceCallResult.permissionId).toBe(WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE);
      expect(videoCallResult.permissionId).toBe(WEBRTC_PERMISSIONS.VIDEO_CALL_INITIATE);
      expect(answerCallResult.permissionId).toBe(WEBRTC_PERMISSIONS.CALL_ANSWER);
      expect(rejectCallResult.permissionId).toBe(WEBRTC_PERMISSIONS.CALL_REJECT);
      expect(endCallResult.permissionId).toBe(WEBRTC_PERMISSIONS.CALL_END);
    });

    it('应该提供媒体控制权限检查方法', () => {
      const { result } = renderHook(() => useWebRTCPermissions());

      const cameraResult = result.current.permissions.canToggleCamera();
      const micResult = result.current.permissions.canToggleMicrophone();
      const speakerResult = result.current.permissions.canToggleSpeaker();
      const screenShareResult = result.current.permissions.canShareScreen();

      expect(cameraResult.permissionId).toBe(WEBRTC_PERMISSIONS.CAMERA_TOGGLE);
      expect(micResult.permissionId).toBe(WEBRTC_PERMISSIONS.MICROPHONE_TOGGLE);
      expect(speakerResult.permissionId).toBe(WEBRTC_PERMISSIONS.SPEAKER_TOGGLE);
      expect(screenShareResult.permissionId).toBe(WEBRTC_PERMISSIONS.SCREEN_SHARE);
    });

    it('应该提供群组通话权限检查方法', () => {
      const { result } = renderHook(() => useWebRTCPermissions());

      const createResult = result.current.permissions.canCreateGroupCall();
      const joinResult = result.current.permissions.canJoinGroupCall();
      const inviteResult = result.current.permissions.canInviteToGroupCall();
      const manageResult = result.current.permissions.canManageGroupCall();

      expect(createResult.permissionId).toBe(WEBRTC_PERMISSIONS.GROUP_CALL_CREATE);
      expect(joinResult.permissionId).toBe(WEBRTC_PERMISSIONS.GROUP_CALL_JOIN);
      expect(inviteResult.permissionId).toBe(WEBRTC_PERMISSIONS.GROUP_CALL_INVITE);
      expect(manageResult.permissionId).toBe(WEBRTC_PERMISSIONS.GROUP_CALL_MANAGE);
    });

    it('应该提供文件传输权限检查方法', () => {
      const { result } = renderHook(() => useWebRTCPermissions());

      const sendFileResult = result.current.permissions.canSendFile();
      const receiveFileResult = result.current.permissions.canReceiveFile();
      const uploadMediaResult = result.current.permissions.canUploadMedia();

      expect(sendFileResult.permissionId).toBe(WEBRTC_PERMISSIONS.FILE_SEND);
      expect(receiveFileResult.permissionId).toBe(WEBRTC_PERMISSIONS.FILE_RECEIVE);
      expect(uploadMediaResult.permissionId).toBe(WEBRTC_PERMISSIONS.MEDIA_UPLOAD);
    });

    it('应该提供消息权限检查方法', () => {
      const { result } = renderHook(() => useWebRTCPermissions());

      const sendResult = result.current.permissions.canSendMessage();
      const viewResult = result.current.permissions.canViewMessage();  
      const deleteResult = result.current.permissions.canDeleteMessage();

      expect(sendResult.permissionId).toBe(WEBRTC_PERMISSIONS.MESSAGE_SEND);
      expect(viewResult.permissionId).toBe(WEBRTC_PERMISSIONS.MESSAGE_VIEW);
      expect(deleteResult.permissionId).toBe(WEBRTC_PERMISSIONS.MESSAGE_DELETE);
    });

    it('应该提供高级功能权限检查方法', () => {
      const { result } = renderHook(() => useWebRTCPermissions());

      const startRecordingResult = result.current.permissions.canStartRecording();
      const stopRecordingResult = result.current.permissions.canStopRecording();
      const qualityControlResult = result.current.permissions.canControlQuality();
      const networkMonitorResult = result.current.permissions.canMonitorNetwork();

      expect(startRecordingResult.permissionId).toBe(WEBRTC_PERMISSIONS.RECORDING_START);
      expect(stopRecordingResult.permissionId).toBe(WEBRTC_PERMISSIONS.RECORDING_STOP);
      expect(qualityControlResult.permissionId).toBe(WEBRTC_PERMISSIONS.QUALITY_CONTROL);
      expect(networkMonitorResult.permissionId).toBe(WEBRTC_PERMISSIONS.NETWORK_MONITOR);
    });

    it('应该提供权限组便捷检查方法', () => {
      // Mock权限组结果
      mockUseOperationPermissions.mockReturnValue({
        permissions: {},
        isLoading: false,
        error: null
      });

      const { result } = renderHook(() => useWebRTCPermissions());

      const basicCallingResult = result.current.permissions.basicCalling();
      result.current.permissions.mediaControls();
      result.current.permissions.groupCalling();
      result.current.permissions.fileTransfer();
      result.current.permissions.messaging();
      result.current.permissions.adminFeatures();

      expect(basicCallingResult).toEqual(expect.objectContaining({
        hasAnyPermission: expect.any(Boolean),
        hasAllPermissions: expect.any(Boolean),
        isLoading: false,
        error: null
      }));
    });
  });

  describe('错误处理', () => {
    it('应该处理权限检查中的错误', () => {
      const mockErrorResult = {
        hasPermission: false,
        isLoading: false,
        error: 'Permission denied',
        reason: 'Insufficient privileges'
      };
      mockUseOperationPermission.mockReturnValue(mockErrorResult);

      const { result } = renderHook(() => useWebRTCPermissions());

      const permissionResult = result.current.checkPermission(WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE);

      expect(permissionResult.error).toBe('Permission denied');
      expect(permissionResult.reason).toBe('Insufficient privileges');
      expect(permissionResult.hasPermission).toBe(false);
    });

    it('应该处理多权限检查中的错误', () => {
      const mockErrorResult = {
        permissions: {
          [WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE]: false
        },
        isLoading: false,
        error: 'Multiple permissions failed'
      };
      mockUseOperationPermissions.mockReturnValue(mockErrorResult);

      const { result } = renderHook(() => useWebRTCPermissions());

      const permissionsResult = result.current.checkPermissions([WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE]);

      expect(permissionsResult.error).toBe('Multiple permissions failed');
      expect(permissionsResult.hasAnyPermission).toBe(false);
    });

    it('应该处理加载状态', () => {
      const mockLoadingResult = {
        hasPermission: false,
        isLoading: true,
        error: null,
        reason: null
      };
      mockUseOperationPermission.mockReturnValue(mockLoadingResult);

      const { result } = renderHook(() => useWebRTCPermissions());

      const permissionResult = result.current.checkPermission(WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE);

      expect(permissionResult.isLoading).toBe(true);
    });
  });

  describe('常量导出', () => {
    it('应该导出WebRTC权限常量', () => {
      const { result } = renderHook(() => useWebRTCPermissions());

      expect(result.current.WEBRTC_PERMISSIONS).toBeDefined();
      expect(result.current.WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE).toBe('webrtc_voice_call_initiate');
      expect(result.current.WEBRTC_PERMISSIONS.VIDEO_CALL_INITIATE).toBe('webrtc_video_call_initiate');
    });

    it('应该导出权限组常量', () => {
      const { result } = renderHook(() => useWebRTCPermissions());

      expect(result.current.PERMISSION_GROUPS).toBeDefined();
      expect(result.current.PERMISSION_GROUPS.BASIC_CALLING).toEqual([
        'webrtc_voice_call_initiate',
        'webrtc_video_call_initiate',
        'webrtc_call_answer',
        'webrtc_call_reject',
        'webrtc_call_end'
      ]);
    });
  });
});

describe('useWebRTCPermission Hook', () => {
  let mockUseOperationPermission: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseOperationPermission = vi.fn();
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      useOperationPermission: mockUseOperationPermission,
      useOperationPermissions: vi.fn(),
      preloadOperationPermission: vi.fn(),
      preloadOperationPermissions: vi.fn()
    });
  });

  it('应该正确检查单个权限', () => {
    const mockResult = {
      hasPermission: true,
      isLoading: false,
      error: null,
      reason: null
    };
    mockUseOperationPermission.mockReturnValue(mockResult);

    const { result } = renderHook(() => 
      useWebRTCPermission(WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE)
    );

    expect(result.current).toEqual({
      ...mockResult,
      permissionId: WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE
    });
  });

  it('应该处理权限检查错误', () => {
    const mockErrorResult = {
      hasPermission: false,
      isLoading: false,
      error: 'Access denied',
      reason: 'User not authorized'
    };
    mockUseOperationPermission.mockReturnValue(mockErrorResult);

    const { result } = renderHook(() => 
      useWebRTCPermission(WEBRTC_PERMISSIONS.RECORDING_START)
    );

    expect(result.current.hasPermission).toBe(false);
    expect(result.current.error).toBe('Access denied');
  });
});

describe('useWebRTCPermissionGroup Hook', () => {
  let mockUseOperationPermissions: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseOperationPermissions = vi.fn();
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      useOperationPermission: vi.fn(),
      useOperationPermissions: mockUseOperationPermissions,
      preloadOperationPermission: vi.fn(),
      preloadOperationPermissions: vi.fn()
    });
  });

  it('应该正确检查权限组', () => {
    const mockResult = {
      permissions: {
        [WEBRTC_PERMISSIONS.VOICE_CALL_INITIATE]: true,
        [WEBRTC_PERMISSIONS.VIDEO_CALL_INITIATE]: false,
        [WEBRTC_PERMISSIONS.CALL_ANSWER]: true,
        [WEBRTC_PERMISSIONS.CALL_REJECT]: true,
        [WEBRTC_PERMISSIONS.CALL_END]: false
      },
      isLoading: false,
      error: null
    };
    mockUseOperationPermissions.mockReturnValue(mockResult);

    const { result } = renderHook(() => 
      useWebRTCPermissionGroup('BASIC_CALLING')
    );

    expect(result.current.permissions).toEqual(mockResult.permissions);
    expect(result.current.hasAnyPermission).toBe(true);
    expect(result.current.hasAllPermissions).toBe(false);
  });

  it('应该处理权限组检查错误', () => {
    const mockErrorResult = {
      permissions: {
        [WEBRTC_PERMISSIONS.CAMERA_TOGGLE]: false,
        [WEBRTC_PERMISSIONS.MICROPHONE_TOGGLE]: false,
        [WEBRTC_PERMISSIONS.SPEAKER_TOGGLE]: false,
        [WEBRTC_PERMISSIONS.SCREEN_SHARE]: false
      },
      isLoading: false,
      error: 'Group permission check failed'
    };
    mockUseOperationPermissions.mockReturnValue(mockErrorResult);

    const { result } = renderHook(() => 
      useWebRTCPermissionGroup('MEDIA_CONTROLS')
    );

    expect(result.current.error).toBe('Group permission check failed');
    expect(result.current.hasAnyPermission).toBe(false);
    expect(result.current.hasAllPermissions).toBe(false);
  });

  it('应该处理加载状态', () => {
    const mockLoadingResult = {
      permissions: {},
      isLoading: true,
      error: null
    };
    mockUseOperationPermissions.mockReturnValue(mockLoadingResult);

    const { result } = renderHook(() => 
      useWebRTCPermissionGroup('ADMIN_FEATURES')
    );

    expect(result.current.isLoading).toBe(true);
  });
});

describe('权限常量验证', () => {
  it('应该包含所有必需的WebRTC权限ID', () => {
    const expectedPermissions = [
      'webrtc_voice_call_initiate',
      'webrtc_video_call_initiate',
      'webrtc_call_answer',
      'webrtc_call_reject',
      'webrtc_call_end',
      'webrtc_camera_toggle',
      'webrtc_microphone_toggle',
      'webrtc_speaker_toggle',
      'webrtc_screen_share',
      'webrtc_group_call_create',
      'webrtc_group_call_join',
      'webrtc_group_call_invite',
      'webrtc_group_call_manage',
      'webrtc_file_send',
      'webrtc_file_receive',
      'webrtc_media_upload',
      'webrtc_message_send',
      'webrtc_message_view',
      'webrtc_message_delete',
      'webrtc_recording_start',
      'webrtc_recording_stop',
      'webrtc_quality_control',
      'webrtc_network_monitor'
    ];

    const actualPermissions = Object.values(WEBRTC_PERMISSIONS);
    
    expectedPermissions.forEach(permission => {
      expect(actualPermissions).toContain(permission);
    });
  });

  it('应该包含所有必需的权限组', () => {
    const expectedGroups = [
      'BASIC_CALLING',
      'MEDIA_CONTROLS',
      'GROUP_CALLING',
      'FILE_TRANSFER',
      'MESSAGING',
      'ADMIN_FEATURES'
    ];

    const actualGroups = Object.keys(PERMISSION_GROUPS);
    
    expectedGroups.forEach(group => {
      expect(actualGroups).toContain(group);
    });
  });

  it('应该确保权限组包含正确的权限数量', () => {
    expect(PERMISSION_GROUPS.BASIC_CALLING).toHaveLength(5);
    expect(PERMISSION_GROUPS.MEDIA_CONTROLS).toHaveLength(4);
    expect(PERMISSION_GROUPS.GROUP_CALLING).toHaveLength(4);
    expect(PERMISSION_GROUPS.FILE_TRANSFER).toHaveLength(3);
    expect(PERMISSION_GROUPS.MESSAGING).toHaveLength(3);
    expect(PERMISSION_GROUPS.ADMIN_FEATURES).toHaveLength(4);
  });
});