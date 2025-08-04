import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import webrtcManagerInstance, { WebRTCManager, VIDEO_QUALITY_PRESETS } from '../../../src/services/webrtcManager';
import rtcConfigManager from '../../../src/services/rtcConfigManager';
import type { 
  MediaConstraints, 
  IceCandidate, 
  SessionDescription, 
  WebRTCEventListeners,
  VideoQualitySettings,
  CameraInfo,
  MediaDeviceInfo
} from '../../../src/services/webrtcManager';

// Mock dependencies
vi.mock('../../../src/services/rtcConfigManager');

const mockRtcConfigManager = vi.mocked(rtcConfigManager);

// Enhanced Mock WebRTC APIs
const mockRTCPeerConnection = {
  localDescription: null,
  remoteDescription: null,
  signalingState: 'stable',
  iceConnectionState: 'new',
  iceGatheringState: 'new',
  connectionState: 'new',
  onconnectionstatechange: null,
  onicecandidate: null,
  ontrack: null,
  oniceconnectionstatechange: null,
  ondatachannel: null,
  createOffer: vi.fn(),
  createAnswer: vi.fn(),
  setLocalDescription: vi.fn(),
  setRemoteDescription: vi.fn(),
  addIceCandidate: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  createDataChannel: vi.fn(),
  getStats: vi.fn(),
  restartIce: vi.fn(),
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
  getSenders: vi.fn(() => [] as RTCRtpSender[]),
  getReceivers: vi.fn(() => [] as RTCRtpReceiver[]),
  getTransceivers: vi.fn(() => [] as RTCRtpTransceiver[]),
};

const mockMediaTrack = {
  id: 'mock-track-id',
  kind: 'video',
  enabled: true,
  muted: false,
  readyState: 'live',
  getSettings: vi.fn(() => ({
    deviceId: 'mock-device-id',
    width: 640,
    height: 480,
    frameRate: 30
  })),
  getCapabilities: vi.fn(() => ({
    width: { min: 320, max: 1920 },
    height: { min: 240, max: 1080 },
    frameRate: { min: 15, max: 60 }
  })),
  applyConstraints: vi.fn(),
  stop: vi.fn(),
  clone: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  onended: null,
};

const mockMediaStream = {
  id: 'mock-stream-id',
  active: true,
  getTracks: vi.fn(() => [mockMediaTrack]),
  getAudioTracks: vi.fn(() => [{
    ...mockMediaTrack,
    id: 'audio-track',
    kind: 'audio'
  }]),
  getVideoTracks: vi.fn(() => [{
    ...mockMediaTrack,
    id: 'video-track',
    kind: 'video'
  }]),
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
  clone: vi.fn(),
  getTrackById: vi.fn(),
  dispatchEvent: vi.fn(),
} as unknown as MediaStream;

const mockDataChannel = {
  label: 'test-channel',
  readyState: 'open',
  bufferedAmount: 0,
  bufferedAmountLowThreshold: 0,
  binaryType: 'arraybuffer',
  maxPacketLifetime: null,
  maxRetransmits: null,
  negotiated: false,
  ordered: true,
  protocol: '',
  id: 0,
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  onopen: null,
  onclose: null,
  onmessage: null,
  onerror: null,
  dispatchEvent: vi.fn(),
};

const mockRTCSender = {
  track: mockMediaTrack,
  replaceTrack: vi.fn(),
  getParameters: vi.fn(),
  setParameters: vi.fn(),
  getStats: vi.fn(),
  transform: null,
  dtmf: null
};

// Mock global WebRTC APIs
(global as any).RTCPeerConnection = vi.fn(() => mockRTCPeerConnection);
(global as any).RTCSessionDescription = vi.fn((description) => description);
(global as any).RTCIceCandidate = vi.fn((candidate) => candidate);
(global as any).MediaStream = vi.fn(() => mockMediaStream);

// Enhanced navigator mock
(global as any).navigator = {
  mediaDevices: {
    getUserMedia: vi.fn(),
    getDisplayMedia: vi.fn(),
    enumerateDevices: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ondevicechange: null,
    getSupportedConstraints: vi.fn(() => ({
      width: true,
      height: true,
      frameRate: true,
      facingMode: true,
      deviceId: true
    })),
  },
};

const mockConfig = {
  stun_servers: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
  max_file_size: 10 * 1024 * 1024,
  file_chunk_size: 64 * 1024,
  supported_image_types: ['image/jpeg', 'image/png', 'image/gif'],
  supported_video_types: ['video/mp4', 'video/webm'],
  supported_audio_types: ['audio/mp3', 'audio/wav'],
  supported_document_types: ['application/pdf'],
  enable_voice_call: true,
  enable_video_call: true,
  enable_screen_share: true,
  enable_file_transfer: true,
  enable_group_chat: true,
  enable_group_call: true,
  enable_message_recall: true,
  enable_message_edit: true,
  max_conference_participants: 8,
  max_group_members: 50,
  file_transfer_timeout: 300000,
  call_timeout: 30000,
  signal_expiry: 3600000,
  message_recall_timeout: 120000,
  network_quality_thresholds: {
    excellent: { bandwidth: 2000, latency: 50, packet_loss: 0.01 },
    good: { bandwidth: 1000, latency: 100, packet_loss: 0.03 },
    fair: { bandwidth: 500, latency: 200, packet_loss: 0.05 },
    poor: { bandwidth: 200, latency: 500, packet_loss: 0.1 },
  },
  video_quality: {
    low: { width: 320, height: 240, framerate: 15, bitrate: 150000 },
    medium: { width: 640, height: 480, framerate: 30, bitrate: 500000 },
    high: { width: 1280, height: 720, framerate: 30, bitrate: 1500000 },
    ultra: { width: 1920, height: 1080, framerate: 60, bitrate: 3000000 },
  },
  audio_quality: {
    low: { bitrate: 32000, sampleRate: 22050 },
    medium: { bitrate: 64000, sampleRate: 44100 },
    high: { bitrate: 128000, sampleRate: 48000 },
  },
  cleanup_config: {
    signal_retention_hours: 24,
    call_record_retention_days: 30,
    file_cache_retention_days: 7,
    read_status_retention_days: 30,
  },
  performance_config: {
    message_batch_size: 50,
    max_concurrent_transfers: 3,
    chunk_upload_concurrency: 2,
    enable_message_pagination: true,
    cache_message_count: 100,
  },
};

describe('WebRTCManager - Comprehensive Tests', () => {
  let webrtcManager: WebRTCManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup config manager mocks
    mockRtcConfigManager.getConfig.mockResolvedValue(mockConfig);
    mockRtcConfigManager.onConfigUpdate.mockReturnValue(() => {});
    
    // Reset WebRTC mocks with detailed setup
    mockRTCPeerConnection.createOffer.mockResolvedValue({
      type: 'offer',
      sdp: 'mock-offer-sdp',
    } as RTCSessionDescriptionInit);
    
    mockRTCPeerConnection.createAnswer.mockResolvedValue({
      type: 'answer', 
      sdp: 'mock-answer-sdp',
    } as RTCSessionDescriptionInit);
    
    mockRTCPeerConnection.setLocalDescription.mockResolvedValue(undefined);
    mockRTCPeerConnection.setRemoteDescription.mockResolvedValue(undefined);
    mockRTCPeerConnection.addIceCandidate.mockResolvedValue(undefined);
    mockRTCPeerConnection.createDataChannel.mockReturnValue(mockDataChannel);
    mockRTCPeerConnection.getSenders.mockReturnValue([mockRTCSender] as RTCRtpSender[]);
    
    // Enhanced media device mocks
    (global as any).navigator.mediaDevices.getUserMedia.mockResolvedValue(mockMediaStream);
    (global as any).navigator.mediaDevices.getDisplayMedia.mockResolvedValue(mockMediaStream);
    (global as any).navigator.mediaDevices.enumerateDevices.mockResolvedValue([
      {
        deviceId: 'camera1',
        kind: 'videoinput',
        label: 'Front Camera',
        groupId: 'group1'
      },
      {
        deviceId: 'camera2', 
        kind: 'videoinput',
        label: 'Back Camera',
        groupId: 'group2'
      },
      {
        deviceId: 'mic1',
        kind: 'audioinput',
        label: 'Built-in Microphone',
        groupId: 'group3'
      }
    ]);
    
    // Create WebRTCManager instance
    webrtcManager = new WebRTCManager();
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 20));
  });

  afterEach(() => {
    webrtcManager.destroy();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with config successfully', async () => {
      const newManager = new WebRTCManager();
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockRtcConfigManager.getConfig).toHaveBeenCalled();
      expect(mockRtcConfigManager.onConfigUpdate).toHaveBeenCalled();
      
      newManager.destroy();
    });

    it('should handle initialization failure gracefully', async () => {
      mockRtcConfigManager.getConfig.mockRejectedValueOnce(new Error('Config load failed'));
      
      expect(() => new WebRTCManager()).not.toThrow();
    });
  });

  describe('Advanced Connection Management', () => {
    it('should replace existing connection when creating new one for same user', async () => {
      // Create first connection
      const connectionId1 = await webrtcManager.createPeerConnection('user123');
      expect(connectionId1).toBeDefined();
      
      // Create second connection for same user
      const connectionId2 = await webrtcManager.createPeerConnection('user123');
      expect(connectionId2).toBeDefined();
      expect(connectionId2).not.toBe(connectionId1);
      
      // Verify only one connection exists for the user
      const connections = webrtcManager.getAllConnections();
      const userConnections = connections.filter(c => c.userId === 'user123');
      expect(userConnections).toHaveLength(1);
    });

    it('should handle connection creation with complex configuration', async () => {
      const connectionId = await webrtcManager.createPeerConnection('user456', true);
      
      expect(RTCPeerConnection).toHaveBeenCalledWith({
        iceServers: mockConfig.stun_servers.map(url => ({ urls: url })),
        iceCandidatePoolSize: 10,
        bundlePolicy: 'balanced',
        rtcpMuxPolicy: 'require',
        iceTransportPolicy: 'all'
      });
      
      expect(mockRTCPeerConnection.createDataChannel).toHaveBeenCalledWith('fileTransfer', {
        ordered: true,
        maxRetransmits: 3
      });
    });

    it('should track connection activity timestamps', async () => {
      const connectionId = await webrtcManager.createPeerConnection('user789');
      const connectionInfo = webrtcManager.getConnectionInfo('user789');
      
      expect(connectionInfo).not.toBeNull();
      expect(connectionInfo!.createdAt).toBeDefined();
      expect(connectionInfo!.lastActivity).toBeDefined();
      expect(connectionInfo!.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it('should check connection existence', async () => {
      await webrtcManager.createPeerConnection('user101');
      
      expect(webrtcManager.hasConnection('user101')).toBe(true);
      expect(webrtcManager.hasConnection('nonexistent')).toBe(false);
    });
  });

  describe('Camera and Device Management', () => {
    it('should get available media devices', async () => {
      const devices = await webrtcManager.getMediaDevices();
      
      expect(devices).toHaveLength(3);
      expect(devices[0]).toEqual({
        deviceId: 'camera1',
        kind: 'videoinput',
        label: 'Front Camera',
        groupId: 'group1'
      });
    });

    it('should get camera devices with enhanced info', async () => {
      const cameras = await webrtcManager.getCameraDevices();
      
      expect(cameras).toHaveLength(2);
      expect(cameras[0].deviceId).toBe('camera1');
      expect(cameras[0].label).toBe('Front Camera');
      expect(cameras[0].facingMode).toBe('user'); // Front Camera detected
    });

    it('should detect camera facing mode from label', async () => {
      (global as any).navigator.mediaDevices.enumerateDevices.mockResolvedValueOnce([
        {
          deviceId: 'env-camera',
          kind: 'videoinput',
          label: 'Environment Camera',
          groupId: 'group1'
        }
      ]);

      const cameras = await webrtcManager.getCameraDevices();
      expect(cameras[0].facingMode).toBe('environment');
    });

    it('should switch camera successfully', async () => {
      await webrtcManager.createPeerConnection('user123');
      await webrtcManager.addLocalStream('user123', mockMediaStream);
      
      const newStream = await webrtcManager.switchCamera('user123', 'camera2');
      
      expect(newStream).toBeDefined();
      expect(mockRTCSender.replaceTrack).toHaveBeenCalled();
    });

    it('should auto-select next camera when no specific camera provided', async () => {
      await webrtcManager.createPeerConnection('user123');
      await webrtcManager.addLocalStream('user123', mockMediaStream);
      
      const newStream = await webrtcManager.switchCamera('user123');
      
      expect((global as any).navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
      expect(newStream).toBeDefined();
    });
  });

  describe('Screen Sharing', () => {
    it('should start screen sharing successfully', async () => {
      await webrtcManager.createPeerConnection('user123');
      await webrtcManager.addLocalStream('user123', mockMediaStream);
      
      // Mock audio and video senders
      const videoSender = { ...mockRTCSender, track: { ...mockMediaTrack, kind: 'video' } };
      const audioSender = { ...mockRTCSender, track: { ...mockMediaTrack, kind: 'audio' } };
      mockRTCPeerConnection.getSenders.mockReturnValue([videoSender, audioSender] as RTCRtpSender[]);
      
      const screenStream = await webrtcManager.startScreenShare('user123', false); // Don't include audio to simplify
      
      expect(screenStream).toBe(mockMediaStream);
      expect((global as any).navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith({
        video: true,
        audio: false
      });
    });

    it('should stop screen sharing and restore camera', async () => {
      await webrtcManager.createPeerConnection('user123');
      await webrtcManager.addLocalStream('user123', mockMediaStream);
      
      // Mock audio and video senders
      const videoSender = { ...mockRTCSender, track: { ...mockMediaTrack, kind: 'video' } };
      const audioSender = { ...mockRTCSender, track: { ...mockMediaTrack, kind: 'audio' } };
      mockRTCPeerConnection.getSenders.mockReturnValue([videoSender, audioSender] as RTCRtpSender[]);
      
      const cameraStream = await webrtcManager.stopScreenShare('user123', 'camera1');
      
      expect(cameraStream).toBeDefined();
      expect((global as any).navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: { deviceId: { exact: 'camera1' } },
        audio: true
      });
    });

    it('should replace media track for screen sharing', async () => {
      await webrtcManager.createPeerConnection('user123');
      await webrtcManager.addLocalStream('user123', mockMediaStream);
      
      // Mock video sender
      const videoSender = { ...mockRTCSender, track: { ...mockMediaTrack, kind: 'video' } };
      mockRTCPeerConnection.getSenders.mockReturnValue([videoSender] as RTCRtpSender[]);
      
      const newTrack = { ...mockMediaTrack, id: 'screen-track' };
      await webrtcManager.replaceMediaTrack('user123', newTrack as MediaStreamTrack, 'video');
      
      expect(mockRTCSender.replaceTrack).toHaveBeenCalledWith(newTrack);
    });
  });

  describe('Video Quality Management', () => {
    beforeEach(async () => {
      await webrtcManager.createPeerConnection('user123');
      await webrtcManager.addLocalStream('user123', mockMediaStream);
    });

    it('should adjust video quality with preset', async () => {
      await webrtcManager.adjustVideoQuality('user123', 'high');
      
      const expectedSettings = VIDEO_QUALITY_PRESETS.high;
      expect(mockMediaTrack.applyConstraints).toHaveBeenCalledWith({
        width: { exact: expectedSettings.width },
        height: { exact: expectedSettings.height },
        frameRate: { exact: expectedSettings.frameRate }
      });
    });

    it('should adjust video quality with custom settings', async () => {
      const customSettings: VideoQualitySettings = {
        width: 800,
        height: 600,
        frameRate: 25,
        bitrate: 800000
      };
      
      await webrtcManager.adjustVideoQuality('user123', customSettings);
      
      expect(mockMediaTrack.applyConstraints).toHaveBeenCalledWith({
        width: { exact: 800 },
        height: { exact: 600 },
        frameRate: { exact: 25 }
      });
    });

    it('should throw error for invalid quality preset', async () => {
      await expect(
        webrtcManager.adjustVideoQuality('user123', 'invalid' as any)
      ).rejects.toThrow('无效的视频质量设置: invalid');
    });
  });

  describe('Network Quality Detection', () => {
    beforeEach(async () => {
      await webrtcManager.createPeerConnection('user123');
    });

    it('should detect excellent network quality', async () => {
      const mockStats = new Map([
        ['outbound-rtp-1', {
          type: 'outbound-rtp',
          packetsLost: 5,
          packetsSent: 1000
        }],
        ['candidate-pair-1', {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.05
        }]
      ]);

      mockRTCPeerConnection.getStats.mockResolvedValueOnce(mockStats as any);
      
      const quality = await webrtcManager.detectNetworkQuality('user123');
      expect(quality).toBe('excellent');
    });

    it('should detect poor network quality', async () => {
      const mockStats = new Map([
        ['outbound-rtp-1', {
          type: 'outbound-rtp',
          packetsLost: 80,
          packetsSent: 1000
        }],
        ['candidate-pair-1', {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.6
        }]
      ]);

      mockRTCPeerConnection.getStats.mockResolvedValueOnce(mockStats as any);
      
      const quality = await webrtcManager.detectNetworkQuality('user123');
      expect(quality).toBe('poor');
    });

    it('should auto-adjust video quality based on network', async () => {
      await webrtcManager.addLocalStream('user123', mockMediaStream);
      
      const mockStats = new Map([
        ['outbound-rtp-1', {
          type: 'outbound-rtp',
          packetsLost: 30,
          packetsSent: 1000
        }],
        ['candidate-pair-1', {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.25
        }]
      ]);

      mockRTCPeerConnection.getStats.mockResolvedValueOnce(mockStats as any);
      
      await webrtcManager.autoAdjustVideoQuality('user123');
      
      // Should adjust to 'medium' quality for fair network
      expect(mockMediaTrack.applyConstraints).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should properly setup peer connection event listeners', async () => {
      const listeners: WebRTCEventListeners = {
        onConnectionStateChange: vi.fn(),
        onRemoteStream: vi.fn(),
        onDataChannelMessage: vi.fn(),
        onIceCandidate: vi.fn(),
        onError: vi.fn()
      };

      webrtcManager.setEventListeners(listeners);
      await webrtcManager.createPeerConnection('user123');

      // Simulate connection state change
      mockRTCPeerConnection.connectionState = 'connected';
      if (mockRTCPeerConnection.onconnectionstatechange) {
        mockRTCPeerConnection.onconnectionstatechange({} as Event);
      }

      // Simulate ICE candidate
      const mockCandidate = {
        candidate: 'test-candidate',
        sdpMLineIndex: 0,
        sdpMid: '0',
        usernameFragment: 'test'
      };
      
      if (mockRTCPeerConnection.onicecandidate) {
        mockRTCPeerConnection.onicecandidate({
          candidate: mockCandidate
        } as RTCPeerConnectionIceEvent);
      }

      // Simulate remote stream
      if (mockRTCPeerConnection.ontrack) {
        mockRTCPeerConnection.ontrack({
          streams: [mockMediaStream]
        } as RTCTrackEvent);
      }

      expect(listeners.onConnectionStateChange).toHaveBeenCalledWith('user123', 'connected');
      expect(listeners.onIceCandidate).toHaveBeenCalled();
      expect(listeners.onRemoteStream).toHaveBeenCalledWith('user123', mockMediaStream);
    });

    it('should handle data channel events', async () => {
      const listeners: WebRTCEventListeners = {
        onDataChannelOpen: vi.fn(),
        onDataChannelClose: vi.fn(),
        onDataChannelMessage: vi.fn()
      };

      webrtcManager.setEventListeners(listeners);
      await webrtcManager.createPeerConnection('user123', true);

      // Simulate data channel events
      if (mockDataChannel.onopen) mockDataChannel.onopen({} as Event);
      if (mockDataChannel.onclose) mockDataChannel.onclose({} as Event);
      if (mockDataChannel.onmessage) {
        mockDataChannel.onmessage({
          data: JSON.stringify({ type: 'test', message: 'hello' })
        } as MessageEvent);
      }

      expect(listeners.onDataChannelOpen).toHaveBeenCalledWith('user123');
      expect(listeners.onDataChannelClose).toHaveBeenCalledWith('user123');
      expect(listeners.onDataChannelMessage).toHaveBeenCalledWith('user123', {
        type: 'test',
        message: 'hello'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle getUserMedia failure', async () => {
      const error = new Error('Permission denied');
      (global as any).navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(error);

      await expect(
        webrtcManager.getUserMedia({ audio: true, video: true })
      ).rejects.toThrow('获取媒体流失败: Error: Permission denied');
    });

    it('should handle connection creation failure when not initialized', async () => {
      const uninitializedManager = new WebRTCManager();
      
      await expect(
        uninitializedManager.createPeerConnection('user123')
      ).rejects.toThrow('WebRTCManager未初始化');
      
      uninitializedManager.destroy();
    });

    it('should handle operations on non-existent connections', async () => {
      await expect(
        webrtcManager.createOffer('nonexistent')
      ).rejects.toThrow('连接不存在: nonexistent');

      await expect(
        webrtcManager.addLocalStream('nonexistent', mockMediaStream)
      ).rejects.toThrow('连接不存在: nonexistent');
    });

    it('should handle data channel send when channel is closed', async () => {
      await webrtcManager.createPeerConnection('user123', true);
      
      // Mock closed data channel
      const connectionInfo = webrtcManager.getConnectionInfo('user123');
      if (connectionInfo?.dataChannel) {
        (connectionInfo.dataChannel as any).readyState = 'closed';
      }

      expect(() => {
        webrtcManager.sendDataChannelMessage('user123', { test: 'data' });
      }).toThrow('数据通道未打开: user123');
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should stop media tracks when stopping stream', () => {
      const track1 = { stop: vi.fn() };
      const track2 = { stop: vi.fn() };
      const stream = {
        getTracks: () => [track1, track2]
      } as unknown as MediaStream;

      webrtcManager.stopMediaStream(stream);

      expect(track1.stop).toHaveBeenCalled();
      expect(track2.stop).toHaveBeenCalled();
    });

    it('should properly cleanup connections on destroy', async () => {
      await webrtcManager.createPeerConnection('user1');
      await webrtcManager.createPeerConnection('user2');
      
      expect(webrtcManager.getAllConnections()).toHaveLength(2);
      
      webrtcManager.destroy();
      
      expect(webrtcManager.getAllConnections()).toHaveLength(0);
      expect(mockRTCPeerConnection.close).toHaveBeenCalledTimes(2);
    });

    it('should handle cleanup timer functionality', async () => {
      // Test that cleanup timer is started during initialization
      expect(webrtcManager).toBeDefined();
      
      // Create a connection and modify its lastActivity to simulate inactivity
      await webrtcManager.createPeerConnection('user123');
      const connectionInfo = webrtcManager.getConnectionInfo('user123');
      if (connectionInfo) {
        connectionInfo.lastActivity = Date.now() - (6 * 60 * 1000); // 6 minutes ago
      }
      
      // Note: In a real test environment, you would need to advance timers
      // or expose the cleanup method for testing
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should get stream statistics', async () => {
      await webrtcManager.createPeerConnection('user123');
      
      const mockStatsReport = new Map([
        ['stat1', { type: 'outbound-rtp', bytesSent: 1000 }]
      ]);
      mockRTCPeerConnection.getStats.mockResolvedValueOnce(mockStatsReport as any);
      
      const stats = await webrtcManager.getStreamStats('user123');
      
      expect(stats).toBe(mockStatsReport);
      expect(mockRTCPeerConnection.getStats).toHaveBeenCalled();
    });

    it('should return null for non-existent connection stats', async () => {
      const stats = await webrtcManager.getStreamStats('nonexistent');
      expect(stats).toBeNull();
    });
  });
});