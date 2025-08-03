import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import callManager, { 
  CallType, 
  CallState, 
  CallDirection, 
  MediaState, 
  CallSession, 
  CallParticipant,
  ConferenceRole,
  ConferenceState,
  ParticipantConnectionState
} from '@/src/services/callManager';
import webrtcManager from '@/src/services/webrtcManager';
import signalingService, { 
  SignalType, 
  CallRequestSignalData, 
  CallResponseSignalData,
  GroupCallSignalData 
} from '@/src/services/signalingService';
import rtcConfigManager from '@/src/services/rtcConfigManager';

// Mock dependencies
vi.mock('@/src/services/webrtcManager', () => ({
  default: {
    initialize: vi.fn(),
    isInitialized: vi.fn(),
    createPeerConnection: vi.fn(),
    closePeerConnection: vi.fn(),
    createOffer: vi.fn(),
    createAnswer: vi.fn(),
    addIceCandidate: vi.fn(),
    getUserMedia: vi.fn(),
    getDisplayMedia: vi.fn(),
    addLocalStream: vi.fn(),
    removeLocalStream: vi.fn(),
    setEventListeners: vi.fn(),
    switchCamera: vi.fn(),
    adjustVideoQuality: vi.fn(),
    autoAdjustVideoQuality: vi.fn(),
    detectNetworkQuality: vi.fn(),
    getCameraDevices: vi.fn(),
    startScreenShare: vi.fn(),
    stopScreenShare: vi.fn(),
    stopMediaStream: vi.fn(),
    cleanup: vi.fn(),
  },
}));

vi.mock('@/src/services/signalingService', () => ({
  default: {
    initialize: vi.fn(),
    isInitialized: vi.fn(),
    sendCallRequest: vi.fn(),
    sendCallAccept: vi.fn(),
    sendCallReject: vi.fn(),
    sendCallEnd: vi.fn(),
    sendOffer: vi.fn(),
    sendAnswer: vi.fn(),
    sendIceCandidate: vi.fn(),
    sendGroupCallRequest: vi.fn(),
    sendGroupCallJoin: vi.fn(),
    sendGroupCallLeave: vi.fn(),
    setEventListeners: vi.fn(),
    cleanup: vi.fn(),
  },
  SignalType: {
    OFFER: 'offer',
    ANSWER: 'answer',
    ICE_CANDIDATE: 'ice-candidate',
    CALL_REQUEST: 'call-request',
    CALL_ACCEPT: 'call-accept',
    CALL_REJECT: 'call-reject',
    CALL_END: 'call-end',
    GROUP_CALL_REQUEST: 'group-call-request',
    GROUP_CALL_JOIN: 'group-call-join',
    GROUP_CALL_LEAVE: 'group-call-leave',
  },
}));

vi.mock('@/src/services/rtcConfigManager', () => ({
  default: {
    getConfig: vi.fn(),
    isInitialized: vi.fn(),
    initialize: vi.fn(),
    isVoiceCallEnabled: vi.fn(),
    isVideoCallEnabled: vi.fn(),
    isGroupChatEnabled: vi.fn(),
  },
}));

const mockWebrtcManager = webrtcManager as {
  initialize: Mock;
  isInitialized: Mock;
  createPeerConnection: Mock;
  closePeerConnection: Mock;
  createOffer: Mock;
  createAnswer: Mock;
  addIceCandidate: Mock;
  getUserMedia: Mock;
  getDisplayMedia: Mock;
  addLocalStream: Mock;
  removeLocalStream: Mock;
  setEventListeners: Mock;
  switchCamera: Mock;
  adjustVideoQuality: Mock;
  autoAdjustVideoQuality: Mock;
  detectNetworkQuality: Mock;
  getCameraDevices: Mock;
  startScreenShare: Mock;
  stopScreenShare: Mock;
  stopMediaStream: Mock;
  cleanup: Mock;
};

const mockSignalingService = signalingService as {
  initialize: Mock;
  isInitialized: Mock;
  sendCallRequest: Mock;
  sendCallAccept: Mock;
  sendCallReject: Mock;
  sendCallEnd: Mock;
  sendOffer: Mock;
  sendAnswer: Mock;
  sendIceCandidate: Mock;
  sendGroupCallRequest: Mock;
  sendGroupCallJoin: Mock;
  sendGroupCallLeave: Mock;
  setEventListeners: Mock;
  cleanup: Mock;
};

const mockRtcConfigManager = rtcConfigManager as {
  getConfig: Mock;
  isInitialized: Mock;
  initialize: Mock;
  isVoiceCallEnabled: Mock;
  isVideoCallEnabled: Mock;
  isGroupChatEnabled: Mock;
};

// Mock MediaStream
const mockMediaStream = {
  getTracks: vi.fn().mockReturnValue([]),
  getVideoTracks: vi.fn().mockReturnValue([]),
  getAudioTracks: vi.fn().mockReturnValue([]),
  id: 'mock-stream-id',
};

// Mock console
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
vi.stubGlobal('console', mockConsole);

// Mock config
const mockConfig = {
  call_timeout: 30000,
  enable_voice_call: true,
  enable_video_call: true,
  enable_group_call: true,
  max_conference_participants: 8,
};

describe('CallManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset manager state
    (callManager as any).activeCalls.clear();
    (callManager as any).listeners = {};
    (callManager as any).currentUserId = null;
    (callManager as any).isInitialized = false;
    (callManager as any).stats = {
      totalCalls: 0,
      completedCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      averageDuration: 0,
      successRate: 0,
    };

    // Setup default mocks
    mockRtcConfigManager.getConfig.mockResolvedValue(mockConfig);
    mockRtcConfigManager.isInitialized.mockReturnValue(true);
    mockRtcConfigManager.isVoiceCallEnabled.mockResolvedValue(true);
    mockRtcConfigManager.isVideoCallEnabled.mockResolvedValue(true);
    mockRtcConfigManager.isGroupChatEnabled.mockResolvedValue(true);
    mockWebrtcManager.isInitialized.mockReturnValue(true);
    mockWebrtcManager.setEventListeners.mockImplementation(() => {});
    mockSignalingService.isInitialized.mockReturnValue(true);
    mockSignalingService.setEventListeners.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should set current user ID successfully', () => {
      // Act
      callManager.setCurrentUserId('user123');

      // Assert
      expect(mockWebrtcManager.setEventListeners).toHaveBeenCalled();
      expect(mockSignalingService.setEventListeners).toHaveBeenCalled();
    });

    it('should set event listeners correctly', () => {
      // Arrange
      const listeners = {
        onIncomingCall: vi.fn(),
        onCallStateChanged: vi.fn(),
      };

      // Act
      callManager.setEventListeners(listeners);

      // Assert
      expect((callManager as any).listeners.onIncomingCall).toBe(listeners.onIncomingCall);
      expect((callManager as any).listeners.onCallStateChanged).toBe(listeners.onCallStateChanged);
    });
  });

  describe('startCall', () => {
    beforeEach(() => {
      callManager.setCurrentUserId('user123');
    });

    it('should start audio call successfully', async () => {
      // Arrange
      const targetUserId = 'user456';
      const callType: CallType = 'audio';
      
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      mockWebrtcManager.createPeerConnection.mockReturnValue({});
      mockSignalingService.sendCallRequest.mockResolvedValue({});

      // Act
      const callId = await callManager.startCall(targetUserId, callType);

      // Assert
      expect(callId).toBeDefined();
      expect(mockWebrtcManager.getUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: false,
      });
      expect(mockWebrtcManager.createPeerConnection).toHaveBeenCalledWith(targetUserId, {
        createDataChannel: false,
      });
      expect(mockSignalingService.sendCallRequest).toHaveBeenCalledWith(
        targetUserId,
        expect.objectContaining({
          callType,
          callId,
          initiatorName: expect.any(String),
        })
      );

      const callSession = callManager.getCallSession(callId);
      expect(callSession).toBeDefined();
      expect(callSession!.callType).toBe(callType);
      expect(callSession!.direction).toBe('outgoing');
      expect(callSession!.state).toBe('initiating');
    });

    it('should start video call successfully', async () => {
      // Arrange
      const targetUserId = 'user456';
      const callType: CallType = 'video';
      
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      mockWebrtcManager.createPeerConnection.mockReturnValue({});
      mockSignalingService.sendCallRequest.mockResolvedValue({});

      // Act
      const callId = await callManager.startCall(targetUserId, callType);

      // Assert
      expect(mockWebrtcManager.getUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: true,
      });

      const callSession = callManager.getCallSession(callId);
      expect(callSession!.callType).toBe(callType);
    });

    it('should throw error when not initialized', async () => {
      // Arrange
      (callManager as any).isInitialized = false;

      // Act & Assert
      await expect(callManager.startCall('user456', 'audio'))
        .rejects.toThrow('通话管理器未初始化');
    });

    it('should throw error when feature is disabled', async () => {
      // Arrange
      const disabledConfig = { ...mockConfig, enable_voice_call: false };
      mockRtcConfigManager.getConfig.mockReturnValue(disabledConfig);

      // Act & Assert
      await expect(callManager.startCall('user456', 'audio'))
        .rejects.toThrow('语音通话功能已禁用');
    });

    it('should handle media access errors', async () => {
      // Arrange
      mockWebrtcManager.getUserMedia.mockRejectedValue(new Error('Permission denied'));

      // Act & Assert
      await expect(callManager.startCall('user456', 'audio'))
        .rejects.toThrow('获取媒体设备失败');
    });

    it('should set call timeout', async () => {
      // Arrange
      const targetUserId = 'user456';
      
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      mockWebrtcManager.createPeerConnection.mockReturnValue({});
      mockSignalingService.sendCallRequest.mockResolvedValue({});

      vi.spyOn(global, 'setTimeout');

      // Act
      const callId = await callManager.startCall(targetUserId, 'audio');

      // Assert
      expect(setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        mockConfig.call_timeout
      );
    });
  });

  describe('acceptCall', () => {
    beforeEach(async () => {
      mockWebrtcManager.initialize.mockResolvedValue(undefined);
      mockSignalingService.initialize.mockResolvedValue(undefined);
      await callManager.initialize('user123');
    });

    it('should accept incoming call successfully', async () => {
      // Arrange
      const callId = 'call_123';
      const fromUserId = 'user456';
      
      // Simulate incoming call
      const callRequestData: CallRequestSignalData = {
        callType: 'audio',
        callId,
        initiatorName: 'John Doe',
      };
      
      (callManager as any).handleIncomingCall(fromUserId, callRequestData);
      
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      mockWebrtcManager.createPeerConnection.mockReturnValue({});
      mockSignalingService.sendCallResponse.mockResolvedValue({});

      // Act
      await callManager.acceptCall(callId);

      // Assert
      expect(mockWebrtcManager.getUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: false,
      });
      expect(mockWebrtcManager.createPeerConnection).toHaveBeenCalledWith(fromUserId, {
        createDataChannel: false,
      });
      expect(mockSignalingService.sendCallResponse).toHaveBeenCalledWith(
        fromUserId,
        expect.objectContaining({
          callId,
          accepted: true,
        }),
        true
      );

      const callSession = callManager.getCallSession(callId);
      expect(callSession!.state).toBe('connecting');
    });

    it('should throw error for non-existent call', async () => {
      // Act & Assert
      await expect(callManager.acceptCall('nonexistent'))
        .rejects.toThrow('通话不存在');
    });

    it('should throw error for outgoing call', async () => {
      // Arrange
      const targetUserId = 'user456';
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      mockWebrtcManager.createPeerConnection.mockReturnValue({});
      mockSignalingService.sendCallRequest.mockResolvedValue({});

      const callId = await callManager.startCall(targetUserId, 'audio');

      // Act & Assert
      await expect(callManager.acceptCall(callId))
        .rejects.toThrow('无法接听非来电通话');
    });
  });

  describe('rejectCall', () => {
    beforeEach(async () => {
      mockWebrtcManager.initialize.mockResolvedValue(undefined);
      mockSignalingService.initialize.mockResolvedValue(undefined);
      await callManager.initialize('user123');
    });

    it('should reject incoming call successfully', async () => {
      // Arrange
      const callId = 'call_123';
      const fromUserId = 'user456';
      const reason = 'User is busy';
      
      // Simulate incoming call
      const callRequestData: CallRequestSignalData = {
        callType: 'audio',
        callId,
        initiatorName: 'John Doe',
      };
      
      (callManager as any).handleIncomingCall(fromUserId, callRequestData);
      
      mockSignalingService.sendCallResponse.mockResolvedValue({});

      // Act
      await callManager.rejectCall(callId, reason);

      // Assert
      expect(mockSignalingService.sendCallResponse).toHaveBeenCalledWith(
        fromUserId,
        expect.objectContaining({
          callId,
          accepted: false,
          reason,
        }),
        false
      );

      const callSession = callManager.getCallSession(callId);
      expect(callSession!.state).toBe('rejected');
    });

    it('should throw error for non-existent call', async () => {
      // Act & Assert
      await expect(callManager.rejectCall('nonexistent'))
        .rejects.toThrow('通话不存在');
    });
  });

  describe('endCall', () => {
    beforeEach(async () => {
      mockWebrtcManager.initialize.mockResolvedValue(undefined);
      mockSignalingService.initialize.mockResolvedValue(undefined);
      await callManager.initialize('user123');
    });

    it('should end active call successfully', async () => {
      // Arrange
      const targetUserId = 'user456';
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      mockWebrtcManager.createPeerConnection.mockReturnValue({});
      mockSignalingService.sendCallRequest.mockResolvedValue({});

      const callId = await callManager.startCall(targetUserId, 'audio');
      
      // Simulate call connected
      const callSession = callManager.getCallSession(callId)!;
      callSession.state = 'connected';
      callSession.startTime = Date.now() - 60000; // 1 minute ago

      // Act
      await callManager.endCall(callId);

      // Assert
      expect(mockWebrtcManager.closePeerConnection).toHaveBeenCalledWith(targetUserId);
      
      const endedCallSession = callManager.getCallSession(callId);
      expect(endedCallSession!.state).toBe('ended');
      expect(endedCallSession!.endTime).toBeDefined();
      expect(endedCallSession!.duration).toBeGreaterThan(0);
    });

    it('should throw error for non-existent call', async () => {
      // Act & Assert
      await expect(callManager.endCall('nonexistent'))
        .rejects.toThrow('通话不存在');
    });

    it('should clean up media streams', async () => {
      // Arrange
      const targetUserId = 'user456';
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      mockWebrtcManager.createPeerConnection.mockReturnValue({});
      mockSignalingService.sendCallRequest.mockResolvedValue({});

      const callId = await callManager.startCall(targetUserId, 'audio');
      mockWebrtcManager.removeLocalStream.mockImplementation(() => {});

      // Act
      await callManager.endCall(callId);

      // Assert
      expect(mockWebrtcManager.removeLocalStream).toHaveBeenCalledWith(targetUserId);
    });
  });

  describe('toggleMicrophone', () => {
    beforeEach(async () => {
      mockWebrtcManager.initialize.mockResolvedValue(undefined);
      mockSignalingService.initialize.mockResolvedValue(undefined);
      await callManager.initialize('user123');
    });

    it('should toggle microphone state successfully', async () => {
      // Arrange
      const targetUserId = 'user456';
      const mockAudioTrack = {
        enabled: true,
        kind: 'audio',
      };
      
      mockMediaStream.getAudioTracks.mockReturnValue([mockAudioTrack]);
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      mockWebrtcManager.createPeerConnection.mockReturnValue({});
      mockSignalingService.sendCallRequest.mockResolvedValue({});

      const callId = await callManager.startCall(targetUserId, 'audio');

      // Act
      const result = await callManager.toggleMicrophone(callId);

      // Assert
      expect(result).toBe(false); // Should be muted now
      expect(mockAudioTrack.enabled).toBe(false);
      
      const callSession = callManager.getCallSession(callId)!;
      expect(callSession.localParticipant.mediaState.micMuted).toBe(true);
    });

    it('should throw error for non-existent call', async () => {
      // Act & Assert
      await expect(callManager.toggleMicrophone('nonexistent'))
        .rejects.toThrow('通话不存在');
    });
  });

  describe('toggleCamera', () => {
    beforeEach(async () => {
      mockWebrtcManager.initialize.mockResolvedValue(undefined);
      mockSignalingService.initialize.mockResolvedValue(undefined);
      await callManager.initialize('user123');
    });

    it('should toggle camera state successfully', async () => {
      // Arrange
      const targetUserId = 'user456';
      const mockVideoTrack = {
        enabled: true,
        kind: 'video',
      };
      
      mockMediaStream.getVideoTracks.mockReturnValue([mockVideoTrack]);
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      mockWebrtcManager.createPeerConnection.mockReturnValue({});
      mockSignalingService.sendCallRequest.mockResolvedValue({});

      const callId = await callManager.startCall(targetUserId, 'video');

      // Act
      const result = await callManager.toggleCamera(callId);

      // Assert
      expect(result).toBe(false); // Should be off now
      expect(mockVideoTrack.enabled).toBe(false);
      
      const callSession = callManager.getCallSession(callId)!;
      expect(callSession.localParticipant.mediaState.cameraOff).toBe(true);
    });
  });

  describe('startScreenShare', () => {
    beforeEach(async () => {
      mockWebrtcManager.initialize.mockResolvedValue(undefined);
      mockSignalingService.initialize.mockResolvedValue(undefined);
      await callManager.initialize('user123');
    });

    it('should start screen sharing successfully', async () => {
      // Arrange
      const targetUserId = 'user456';
      const screenStream = { ...mockMediaStream, id: 'screen-stream' };
      
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      mockWebrtcManager.getDisplayMedia.mockResolvedValue(screenStream);
      mockWebrtcManager.createPeerConnection.mockReturnValue({});
      mockSignalingService.sendCallRequest.mockResolvedValue({});

      const callId = await callManager.startCall(targetUserId, 'video');

      // Act
      await callManager.startScreenShare(callId);

      // Assert
      expect(mockWebrtcManager.getDisplayMedia).toHaveBeenCalled();
      expect(mockWebrtcManager.addLocalStream).toHaveBeenCalledWith(targetUserId, screenStream);
      
      const callSession = callManager.getCallSession(callId)!;
      expect(callSession.localParticipant.mediaState.screenSharing).toBe(true);
    });

    it('should handle screen share errors', async () => {
      // Arrange
      const targetUserId = 'user456';
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      mockWebrtcManager.createPeerConnection.mockReturnValue({});
      mockSignalingService.sendCallRequest.mockResolvedValue({});
      mockWebrtcManager.getDisplayMedia.mockRejectedValue(new Error('User cancelled'));

      const callId = await callManager.startCall(targetUserId, 'video');

      // Act & Assert
      await expect(callManager.startScreenShare(callId))
        .rejects.toThrow('开始屏幕共享失败');
    });
  });

  describe('Group Call Management', () => {
    beforeEach(async () => {
      mockWebrtcManager.initialize.mockResolvedValue(undefined);
      mockSignalingService.initialize.mockResolvedValue(undefined);
      await callManager.initialize('user123');
    });

    it('should start group call successfully', async () => {
      // Arrange
      const groupId = 'group456';
      const callType: CallType = 'video';
      
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      mockSignalingService.sendGroupCallRequest.mockResolvedValue({});

      // Act
      const callId = await callManager.startGroupCall(groupId, callType);

      // Assert
      expect(callId).toBeDefined();
      expect(mockWebrtcManager.getUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: true,
      });
      expect(mockSignalingService.sendGroupCallRequest).toHaveBeenCalledWith(
        groupId,
        expect.objectContaining({
          callType,
          callId,
          groupName: groupId,
          initiatorName: 'user123',
        })
      );

      const callSession = callManager.getCallSession(callId);
      expect(callSession).toBeDefined();
      expect(callSession!.isGroup).toBe(true);
      expect(callSession!.groupId).toBe(groupId);
    });

    it('should create conference successfully', async () => {
      // Arrange
      const conferenceId = 'conf123';
      const callType: CallType = 'video';
      
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);

      // Act
      const callId = await callManager.createConference(conferenceId, callType);

      // Assert
      expect(callId).toBeDefined();
      const callSession = callManager.getCallSession(callId);
      expect(callSession!.localParticipant.role).toBe('host');
      expect(callSession!.metadata?.conferenceId).toBe(conferenceId);
    });

    it('should invite participants to conference', async () => {
      // Arrange
      const conferenceId = 'conf123';
      const userIds = ['user456', 'user789'];
      
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      const callId = await callManager.createConference(conferenceId, 'video');

      // Act
      await callManager.inviteToConference(callId, userIds);

      // Assert
      expect(mockSignalingService.sendGroupCallRequest).toHaveBeenCalledTimes(userIds.length);
      
      const callSession = callManager.getCallSession(callId);
      userIds.forEach(userId => {
        expect(callSession!.participants.has(userId)).toBe(true);
      });
    });

    it('should handle participant joining conference', async () => {
      // Arrange
      const conferenceId = 'conf123';
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      mockWebrtcManager.createPeerConnection.mockReturnValue({});
      
      const callId = await callManager.createConference(conferenceId, 'video');

      // Act
      await callManager.joinConference(callId, 'participant');

      // Assert
      const callSession = callManager.getCallSession(callId);
      expect(callSession!.localParticipant.role).toBe('participant');
      expect(callSession!.metadata?.conferenceState).toBe('active');
    });

    it('should leave conference successfully', async () => {
      // Arrange
      const conferenceId = 'conf123';
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      
      const callId = await callManager.createConference(conferenceId, 'video');
      await callManager.joinConference(callId, 'participant');

      // Act
      await callManager.leaveConference(callId, 'User left');

      // Assert
      expect(mockWebrtcManager.closePeerConnection).toHaveBeenCalled();
      const callSession = callManager.getCallSession(callId);
      expect(callSession!.state).toBe('ended');
    });
  });

  describe('Media Controls', () => {
    beforeEach(async () => {
      mockWebrtcManager.initialize.mockResolvedValue(undefined);
      mockSignalingService.initialize.mockResolvedValue(undefined);
      await callManager.initialize('user123');
    });

    it('should switch camera successfully', async () => {
      // Arrange
      const targetUserId = 'user456';
      const newStream = { ...mockMediaStream, id: 'new-stream' };
      
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      mockWebrtcManager.createPeerConnection.mockReturnValue({});
      mockSignalingService.sendCallRequest.mockResolvedValue({});
      mockWebrtcManager.switchCamera.mockResolvedValue(newStream);

      const callId = await callManager.startCall(targetUserId, 'video');

      // Act
      await callManager.switchCamera(callId, 'camera123');

      // Assert
      expect(mockWebrtcManager.switchCamera).toHaveBeenCalledWith(targetUserId, 'camera123');
    });

    it('should adjust video quality successfully', async () => {
      // Arrange
      const targetUserId = 'user456';
      
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      mockWebrtcManager.createPeerConnection.mockReturnValue({});
      mockSignalingService.sendCallRequest.mockResolvedValue({});

      const callId = await callManager.startCall(targetUserId, 'video');

      // Act
      await callManager.adjustVideoQuality(callId, 'high');

      // Assert
      expect(mockWebrtcManager.adjustVideoQuality).toHaveBeenCalledWith(targetUserId, 'high');
    });

    it('should get network quality successfully', async () => {
      // Arrange
      const targetUserId = 'user456';
      
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      mockWebrtcManager.createPeerConnection.mockReturnValue({});
      mockSignalingService.sendCallRequest.mockResolvedValue({});
      mockWebrtcManager.detectNetworkQuality.mockResolvedValue('good');

      const callId = await callManager.startCall(targetUserId, 'video');

      // Act
      const quality = await callManager.getNetworkQuality(callId);

      // Assert
      expect(quality).toEqual({ [targetUserId]: 'good' });
    });

    it('should get available cameras successfully', async () => {
      // Arrange
      const mockCameras = [
        { deviceId: 'cam1', label: 'Front Camera', facingMode: 'user' as const },
        { deviceId: 'cam2', label: 'Back Camera', facingMode: 'environment' as const }
      ];
      
      mockWebrtcManager.getCameraDevices.mockResolvedValue(mockCameras);

      // Act
      const cameras = await callManager.getAvailableCameras();

      // Assert
      expect(cameras).toEqual(mockCameras);
    });
  });

  describe('getCallStats', () => {
    beforeEach(async () => {
      mockWebrtcManager.initialize.mockResolvedValue(undefined);
      mockSignalingService.initialize.mockResolvedValue(undefined);
      await callManager.initialize('user123');
    });

    it('should return current call statistics', () => {
      // Act
      const stats = callManager.getCallStats();

      // Assert
      expect(stats).toEqual({
        totalCalls: 0,
        completedCalls: 0,
        failedCalls: 0,
        rejectedCalls: 0,
        averageDuration: 0,
        successRate: 0,
      });
    });

    it('should update statistics after calls', async () => {
      // Arrange
      const targetUserId = 'user456';
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      mockWebrtcManager.createPeerConnection.mockReturnValue({});
      mockSignalingService.sendCallRequest.mockResolvedValue({});

      // Start and end a call
      const callId = await callManager.startCall(targetUserId, 'audio');
      const callSession = callManager.getCallSession(callId)!;
      callSession.state = 'connected';
      callSession.startTime = Date.now() - 60000; // 1 minute ago
      
      await callManager.endCall(callId);

      // Act
      const stats = callManager.getCallStats();

      // Assert
      expect(stats.totalCalls).toBe(1);
      expect(stats.completedCalls).toBe(1);
      expect(stats.successRate).toBe(1);
      expect(stats.averageDuration).toBeGreaterThan(0);
    });
  });

  describe('addEventListener', () => {
    beforeEach(async () => {
      mockWebrtcManager.initialize.mockResolvedValue(undefined);
      mockSignalingService.initialize.mockResolvedValue(undefined);
      await callManager.initialize('user123');
    });

    it('should register event listeners correctly', () => {
      // Arrange
      const listeners = {
        onIncomingCall: vi.fn(),
        onCallStateChanged: vi.fn(),
        onCallStarted: vi.fn(),
        onCallEnded: vi.fn(),
        onCallFailed: vi.fn(),
      };

      // Act
      callManager.addEventListener(listeners);

      // Assert
      expect((callManager as any).listeners.onIncomingCall).toBe(listeners.onIncomingCall);
      expect((callManager as any).listeners.onCallStateChanged).toBe(listeners.onCallStateChanged);
      expect((callManager as any).listeners.onCallStarted).toBe(listeners.onCallStarted);
      expect((callManager as any).listeners.onCallEnded).toBe(listeners.onCallEnded);
      expect((callManager as any).listeners.onCallFailed).toBe(listeners.onCallFailed);
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      mockWebrtcManager.initialize.mockResolvedValue(undefined);
      mockSignalingService.initialize.mockResolvedValue(undefined);
      await callManager.initialize('user123');
    });

    it('should cleanup all resources and reset state', async () => {
      // Arrange
      const targetUserId = 'user456';
      mockWebrtcManager.getUserMedia.mockResolvedValue(mockMediaStream);
      mockWebrtcManager.createPeerConnection.mockReturnValue({});
      mockSignalingService.sendCallRequest.mockResolvedValue({});

      await callManager.startCall(targetUserId, 'audio');

      // Act
      await callManager.cleanup();

      // Assert
      expect(mockWebrtcManager.cleanup).toHaveBeenCalled();
      expect(mockSignalingService.cleanup).toHaveBeenCalled();
      expect((callManager as any).activeCalls.size).toBe(0);
      expect((callManager as any).isInitialized).toBe(false);
      expect((callManager as any).currentUserId).toBeNull();
    });
  });
});
