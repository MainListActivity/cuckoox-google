import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import webrtcManager from '../../../src/services/webrtcManager';
import rtcConfigManager from '../../../src/services/rtcConfigManager';
import signalingService from '../../../src/services/signalingService';

// Mock dependencies
vi.mock('../../../src/services/rtcConfigManager');
vi.mock('../../../src/services/signalingService');

const mockRtcConfigManager = vi.mocked(rtcConfigManager);
const mockSignalingService = vi.mocked(signalingService);

// Mock WebRTC APIs
const mockRTCPeerConnection = {
  localDescription: null,
  remoteDescription: null,
  signalingState: 'stable',
  iceConnectionState: 'new',
  iceGatheringState: 'new',
  connectionState: 'new',
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
  getSenders: vi.fn(() => []),
  getReceivers: vi.fn(() => []),
  getTransceivers: vi.fn(() => []),
};

const mockMediaStream = {
  id: 'mock-stream-id',
  active: true,
  getTracks: vi.fn(() => []),
  getAudioTracks: vi.fn(() => []),
  getVideoTracks: vi.fn(() => []),
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
  clone: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

const mockMediaDevices = {
  getUserMedia: vi.fn(),
  getDisplayMedia: vi.fn(),
  enumerateDevices: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  ondevicechange: null,
};

// Mock global WebRTC APIs
global.RTCPeerConnection = vi.fn(() => mockRTCPeerConnection) as any;
global.MediaStream = vi.fn(() => mockMediaStream) as any;

Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: mockMediaDevices,
});

describe('WebRTCManager', () => {
  const mockConfig = {
    stun_servers: ['stun:stun.l.google.com:19302'],
    max_file_size: 100 * 1024 * 1024,
    file_chunk_size: 16384,
    supported_image_types: ['image/jpeg', 'image/png'],
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

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup basic mocks
    mockRtcConfigManager.getConfig.mockReturnValue(mockConfig);
    mockRtcConfigManager.initialize.mockResolvedValue(undefined);
    
    // Reset WebRTC mocks
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
    
    // Clear event listeners
    mockRTCPeerConnection.addEventListener.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      // Act
      await webrtcManager.initialize();

      // Assert
      expect(mockRtcConfigManager.initialize).toHaveBeenCalled();
    });

    it('should handle initialization failure gracefully', async () => {
      // Arrange
      mockRtcConfigManager.initialize.mockRejectedValue(new Error('Config init failed'));

      // Act & Assert
      await expect(webrtcManager.initialize()).rejects.toThrow('Config init failed');
    });
  });

  describe('Peer Connection Management', () => {
    beforeEach(async () => {
      await webrtcManager.initialize();
    });

    it('should create peer connection successfully', () => {
      // Act
      webrtcManager.createPeerConnection('user456');

      // Assert
      expect(global.RTCPeerConnection).toHaveBeenCalledWith({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
    });

    it('should get connection info for existing peer', () => {
      // Arrange
      webrtcManager.createPeerConnection('user456');

      // Act
      const connectionInfo = webrtcManager.getConnectionInfo('user456');

      // Assert
      expect(connectionInfo).toBeDefined();
    });

    it('should return null for non-existent peer', () => {
      // Act
      const connectionInfo = webrtcManager.getConnectionInfo('nonexistent');

      // Assert
      expect(connectionInfo).toBeNull();
    });

    it('should close peer connection', () => {
      // Arrange
      webrtcManager.createPeerConnection('user456');

      // Act
      webrtcManager.closePeerConnection('user456');

      // Assert
      expect(mockRTCPeerConnection.close).toHaveBeenCalled();
    });
  });

  describe('Offer/Answer Handling', () => {
    beforeEach(async () => {
      await webrtcManager.initialize();
      webrtcManager.createPeerConnection('user456');
    });

    it('should create and handle offer', async () => {
      // Act
      await webrtcManager.createOffer('user456');

      // Assert
      expect(mockRTCPeerConnection.createOffer).toHaveBeenCalled();
      expect(mockRTCPeerConnection.setLocalDescription).toHaveBeenCalled();
    });

    it('should create and handle answer', async () => {
      // Arrange
      const offer = { type: 'offer' as RTCSdpType, sdp: 'mock-offer-sdp' };

      // Act
      await webrtcManager.setRemoteDescription('user456', offer);

      // Assert
      expect(mockRTCPeerConnection.setRemoteDescription).toHaveBeenCalledWith(offer);
    });

    it('should handle answer', async () => {
      // Arrange
      const answer = { type: 'answer' as RTCSdpType, sdp: 'mock-answer-sdp' };

      // Act
      await webrtcManager.setRemoteDescription('user456', answer);

      // Assert
      expect(mockRTCPeerConnection.setRemoteDescription).toHaveBeenCalledWith(answer);
    });
  });

  describe('ICE Candidate Handling', () => {
    beforeEach(async () => {
      await webrtcManager.initialize();
      webrtcManager.createPeerConnection('user456');
    });

    it('should handle ICE candidate', async () => {
      // Arrange
      const candidate = {
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
      };

      // Act
      await webrtcManager.addIceCandidate('user456', candidate);

      // Assert
      expect(mockRTCPeerConnection.addIceCandidate).toHaveBeenCalledWith(candidate);
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      await webrtcManager.initialize();
      webrtcManager.createPeerConnection('user456');
    });

    it('should cleanup all connections on destroy', async () => {
      // Act
      await webrtcManager.destroy();

      // Assert
      expect(mockRTCPeerConnection.close).toHaveBeenCalled();
    });
  });
});
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

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup basic mocks
    mockRtcConfigManager.getConfig.mockReturnValue(mockConfig);
    mockRtcConfigManager.initialize.mockResolvedValue(undefined);
    
    // Reset WebRTC mocks
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
    
    // Clear event listeners
    mockRTCPeerConnection.addEventListener.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      // Act
      await webrtcManager.initialize();

      // Assert
      expect(mockRtcConfigManager.initialize).toHaveBeenCalled();
    });

    it('should handle initialization failure gracefully', async () => {
      // Arrange
      mockRtcConfigManager.initialize.mockRejectedValue(new Error('Config init failed'));

      // Act & Assert
      await expect(webrtcManager.initialize()).rejects.toThrow('Config init failed');
    });
  });

  describe('Peer Connection Management', () => {
    beforeEach(async () => {
      await webrtcManager.initialize();
    });

    it('should create peer connection successfully', () => {
      // Act
      webrtcManager.createPeerConnection('user456');

      // Assert
      expect(global.RTCPeerConnection).toHaveBeenCalledWith({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
    });

    it('should get connection info for existing peer', () => {
      // Arrange
      webrtcManager.createPeerConnection('user456');

      // Act
      const connectionInfo = webrtcManager.getConnectionInfo('user456');

      // Assert
      expect(connectionInfo).toBeDefined();
      expect(connectionInfo?.peerId).toBe('user456');
    });

    it('should return null for non-existent peer', () => {
      // Act
      const connectionInfo = webrtcManager.getConnectionInfo('nonexistent');

      // Assert
      expect(connectionInfo).toBeNull();
    });

    it('should close peer connection', () => {
      // Arrange
      webrtcManager.createPeerConnection('user456');

      // Act
      webrtcManager.closePeerConnection('user456');

      // Assert
      expect(mockRTCPeerConnection.close).toHaveBeenCalled();
    });
  });

  describe('Offer/Answer Handling', () => {
    beforeEach(async () => {
      await webrtcManager.initialize();
      webrtcManager.createPeerConnection('user456');
    });

    it('should create and handle offer', async () => {
      // Act
      await webrtcManager.createOffer('user456');

      // Assert
      expect(mockRTCPeerConnection.createOffer).toHaveBeenCalled();
      expect(mockRTCPeerConnection.setLocalDescription).toHaveBeenCalled();
    });

    it('should create and handle answer', async () => {
      // Arrange
      const offer = { type: 'offer', sdp: 'mock-offer-sdp' } as RTCSessionDescriptionInit;

      // Act
      await webrtcManager.handleOffer('user456', offer);

      // Assert
      expect(mockRTCPeerConnection.setRemoteDescription).toHaveBeenCalledWith(offer);
      expect(mockRTCPeerConnection.createAnswer).toHaveBeenCalled();
      expect(mockRTCPeerConnection.setLocalDescription).toHaveBeenCalled();
    });

    it('should handle answer', async () => {
      // Arrange
      const answer = { type: 'answer', sdp: 'mock-answer-sdp' } as RTCSessionDescriptionInit;

      // Act
      await webrtcManager.handleAnswer('user456', answer);

      // Assert
      expect(mockRTCPeerConnection.setRemoteDescription).toHaveBeenCalledWith(answer);
    });
  });

  describe('ICE Candidate Handling', () => {
    beforeEach(async () => {
      await webrtcManager.initialize();
      webrtcManager.createPeerConnection('user456');
    });

    it('should handle ICE candidate', async () => {
      // Arrange
      const candidate = {
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
      } as RTCIceCandidateInit;

      // Act
      await webrtcManager.handleIceCandidate('user456', candidate);

      // Assert
      expect(mockRTCPeerConnection.addIceCandidate).toHaveBeenCalledWith(candidate);
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      await webrtcManager.initialize();
      webrtcManager.createPeerConnection('user456');
    });

    it('should cleanup all connections on destroy', async () => {
      // Act
      await webrtcManager.destroy();

      // Assert
      expect(mockRTCPeerConnection.close).toHaveBeenCalled();
    });
  });
});
  });
});
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  ondevicechange: null,
};

// Mock global objects
Object.defineProperty(window, 'RTCPeerConnection', {
  writable: true,
  value: vi.fn(() => mockRTCPeerConnection),
});

Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: mockMediaDevices,
});

describe('WebRTCManager', () => {
  const mockConfig = {
    stun_servers: ['stun:stun.l.google.com:19302'],
    max_file_size: 100 * 1024 * 1024,
    file_chunk_size: 16384,
    supported_image_types: ['image/jpeg', 'image/png'],
    supported_video_types: ['video/mp4', 'video/webm'],
    supported_audio_types: ['audio/mp3', 'audio/wav'],
    enable_voice_call: true,
    enable_video_call: true,
    enable_screen_share: true,
    enable_file_transfer: true,
    enable_group_chat: true,
    enable_group_call: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockRtcConfigManager.getConfig.mockResolvedValue(mockConfig);
    mockRtcConfigManager.onConfigUpdate.mockImplementation(() => {});
    
    mockMediaDevices.getUserMedia.mockResolvedValue(mockMediaStream);
    mockMediaDevices.getDisplayMedia.mockResolvedValue(mockMediaStream);
    mockMediaDevices.enumerateDevices.mockResolvedValue([]);
    
    mockRTCPeerConnection.createOffer.mockResolvedValue({
      type: 'offer',
      sdp: 'mock-offer-sdp',
    });
    
    mockRTCPeerConnection.createAnswer.mockResolvedValue({
      type: 'answer', 
      sdp: 'mock-answer-sdp',
    });
    
    mockRTCPeerConnection.createDataChannel.mockReturnValue({
      label: 'test-channel',
      readyState: 'open',
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Peer Connection Management', () => {
    it('should create peer connection successfully', async () => {
      // Act
      const connectionId = await webrtcManager.createPeerConnection('user456');

      // Assert
      expect(connectionId).toBeDefined();
      expect(webrtcManager.hasConnection('user456')).toBe(true);
    });

    it('should get connection information', async () => {
      // Arrange
      await webrtcManager.createPeerConnection('user456');

      // Act
      const connectionInfo = webrtcManager.getConnectionInfo('user456');

      // Assert
      expect(connectionInfo).toBeDefined();
      expect(connectionInfo?.userId).toBe('user456');
    });

    it('should return null for non-existent connection', () => {
      // Act
      const connectionInfo = webrtcManager.getConnectionInfo('nonexistent');

      // Assert
      expect(connectionInfo).toBeNull();
    });

    it('should close peer connection', async () => {
      // Arrange
      await webrtcManager.createPeerConnection('user456');
      
      // Act
      await webrtcManager.closePeerConnection('user456');

      // Assert
      expect(webrtcManager.hasConnection('user456')).toBe(false);
    });

    it('should get all connections', async () => {
      // Arrange
      await webrtcManager.createPeerConnection('user1');
      await webrtcManager.createPeerConnection('user2');

      // Act
      const connections = webrtcManager.getAllConnections();

      // Assert
      expect(connections).toHaveLength(2);
      expect(connections.map(c => c.userId)).toEqual(['user1', 'user2']);
    });
  });

  describe('Media Stream Management', () => {
    beforeEach(async () => {
      await webrtcManager.createPeerConnection('user456');
    });

    it('should get user media successfully', async () => {
      // Act
      const stream = await webrtcManager.getUserMedia({ audio: true, video: true });

      // Assert
      expect(stream).toBeDefined();
      expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: true,
      });
    });

    it('should get display media successfully', async () => {
      // Act
      const stream = await webrtcManager.getDisplayMedia();

      // Assert
      expect(stream).toBeDefined();
      expect(mockMediaDevices.getDisplayMedia).toHaveBeenCalled();
    });

    it('should add local stream to connection', async () => {
      // Act
      await webrtcManager.addLocalStream('user456', mockMediaStream as any);

      // Assert
      const connectionInfo = webrtcManager.getConnectionInfo('user456');
      expect(connectionInfo?.localStream).toBeDefined();
    });

    it('should remove local stream from connection', async () => {
      // Arrange
      await webrtcManager.addLocalStream('user456', mockMediaStream as any);

      // Act
      await webrtcManager.removeLocalStream('user456');

      // Assert
      const connectionInfo = webrtcManager.getConnectionInfo('user456');
      expect(connectionInfo?.localStream).toBeUndefined();
    });

    it('should stop media stream', () => {
      // Arrange
      const mockTrack = { stop: vi.fn() };
      mockMediaStream.getTracks.mockReturnValue([mockTrack] as any);

      // Act
      webrtcManager.stopMediaStream(mockMediaStream as any);

      // Assert
      expect(mockTrack.stop).toHaveBeenCalled();
    });
  });

  describe('Offer/Answer Exchange', () => {
    beforeEach(async () => {
      await webrtcManager.createPeerConnection('user456');
    });

    it('should create offer successfully', async () => {
      // Act
      const offer = await webrtcManager.createOffer('user456');

      // Assert
      expect(offer).toEqual({
        type: 'offer',
        sdp: 'mock-offer-sdp',
      });
      expect(mockRTCPeerConnection.createOffer).toHaveBeenCalled();
    });

    it('should create answer successfully', async () => {
      // Act
      const answer = await webrtcManager.createAnswer('user456');

      // Assert
      expect(answer).toEqual({
        type: 'answer',
        sdp: 'mock-answer-sdp',
      });
      expect(mockRTCPeerConnection.createAnswer).toHaveBeenCalled();
    });

    it('should set remote description', async () => {
      // Arrange
      const description = { type: 'offer' as const, sdp: 'remote-sdp' };

      // Act
      await webrtcManager.setRemoteDescription('user456', description);

      // Assert
      expect(mockRTCPeerConnection.setRemoteDescription).toHaveBeenCalledWith(description);
    });

    it('should add ICE candidate', async () => {
      // Arrange
      const candidate = {
        candidate: 'candidate:123 1 UDP 2113667326 192.168.1.100 54400 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
        usernameFragment: 'test',
      };

      // Act
      await webrtcManager.addIceCandidate('user456', candidate);

      // Assert
      expect(mockRTCPeerConnection.addIceCandidate).toHaveBeenCalled();
    });
  });

  describe('Data Channel Communication', () => {
    beforeEach(async () => {
      await webrtcManager.createPeerConnection('user456', true);
    });

    it('should send data channel message', () => {
      // Arrange
      const message = { type: 'test', data: 'hello' };

      // Act
      webrtcManager.sendDataChannelMessage('user456', message);

      // Assert - This tests that the method doesn't throw
      expect(() => webrtcManager.sendDataChannelMessage('user456', message)).not.toThrow();
    });
  });

  describe('Device Management', () => {
    it('should get media devices', async () => {
      // Arrange
      const mockDevices = [
        { deviceId: 'camera1', kind: 'videoinput', label: 'Camera 1', groupId: 'group1' },
        { deviceId: 'mic1', kind: 'audioinput', label: 'Microphone 1', groupId: 'group1' },
      ];
      mockMediaDevices.enumerateDevices.mockResolvedValue(mockDevices);

      // Act
      const devices = await webrtcManager.getMediaDevices();

      // Assert
      expect(devices).toEqual(mockDevices);
      expect(mockMediaDevices.enumerateDevices).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should set event listeners', () => {
      // Arrange
      const listeners = {
        onConnectionStateChange: vi.fn(),
        onDataChannelMessage: vi.fn(),
      };

      // Act
      webrtcManager.setEventListeners(listeners);

      // Assert - This tests that the method doesn't throw
      expect(() => webrtcManager.setEventListeners(listeners)).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should destroy manager and cleanup resources', () => {
      // Act
      webrtcManager.destroy();

      // Assert - This tests that the method doesn't throw
      expect(() => webrtcManager.destroy()).not.toThrow();
    });
  });
});
// Mock RTCPeerConnection
const mockRTCPeerConnection = {
  createOffer: vi.fn(),
  createAnswer: vi.fn(),
  setLocalDescription: vi.fn(),
  setRemoteDescription: vi.fn(),
  addIceCandidate: vi.fn(),
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
  createDataChannel: vi.fn(),
  close: vi.fn(),
  getStats: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  connectionState: 'new',
  iceConnectionState: 'new',
  signalingState: 'stable',
  localDescription: null,
  remoteDescription: null,
  iceGatheringState: 'new',
};

// Mock RTCDataChannel
const mockRTCDataChannel = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 'open',
  label: 'test-channel',
};

// Mock MediaStream
const mockMediaStream = {
  getTracks: vi.fn().mockReturnValue([]),
  getVideoTracks: vi.fn().mockReturnValue([]),
  getAudioTracks: vi.fn().mockReturnValue([]),
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  id: 'mock-stream-id',
};

// Mock getUserMedia
const mockGetUserMedia = vi.fn().mockResolvedValue(mockMediaStream);

// Mock getDisplayMedia
const mockGetDisplayMedia = vi.fn().mockResolvedValue(mockMediaStream);

// Mock enumerateDevices
const mockEnumerateDevices = vi.fn().mockResolvedValue([
  {
    deviceId: 'camera-1',
    kind: 'videoinput',
    label: 'Mock Camera',
    groupId: 'group-1',
  },
  {
    deviceId: 'mic-1', 
    kind: 'audioinput',
    label: 'Mock Microphone',
    groupId: 'group-2',
  },
]);

// Mock rtcConfigManager
vi.mock('@/src/services/rtcConfigManager', () => ({
  default: {
    getConfig: vi.fn(),
    initialize: vi.fn(),
    isInitialized: vi.fn(),
    onConfigUpdate: vi.fn(),
  },
}));

const mockRtcConfigManager = rtcConfigManager as {
  getConfig: Mock;
  initialize: Mock;
  isInitialized: Mock;
  onConfigUpdate: Mock;
};

// Setup global mocks
vi.stubGlobal('RTCPeerConnection', vi.fn(() => mockRTCPeerConnection));
vi.stubGlobal('navigator', {
  mediaDevices: {
    getUserMedia: mockGetUserMedia,
    getDisplayMedia: mockGetDisplayMedia,
    enumerateDevices: mockEnumerateDevices,
  },
});

// Mock console
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
vi.stubGlobal('console', mockConsole);

// Mock default config
const mockConfig = {
  stun_servers: ['stun:stun.l.google.com:19302'],
  max_file_size: 100 * 1024 * 1024,
  file_chunk_size: 16384,
  call_timeout: 30000,
  signal_expiry: 3600000,
  enable_voice_call: true,
  enable_video_call: true,
  enable_screen_share: true,
};

describe('WebRTCManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset manager state
    (webrtcManager as any).peerConnections.clear();
    (webrtcManager as any).listeners = {};
    (webrtcManager as any).isInitialized = false;
    (webrtcManager as any).currentUserId = null;
    
    // Setup default mocks
    mockRtcConfigManager.getConfig.mockReturnValue(mockConfig);
    mockRtcConfigManager.isInitialized.mockReturnValue(true);
    mockRTCPeerConnection.createDataChannel.mockReturnValue(mockRTCDataChannel);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully with valid config', async () => {
      // Arrange
      mockRtcConfigManager.initialize.mockResolvedValue(undefined);
      
      // Act
      await webrtcManager.initialize('user123');

      // Assert
      expect(mockRtcConfigManager.initialize).toHaveBeenCalled();
      expect(webrtcManager.isInitialized()).toBe(true);
      expect(webrtcManager.getCurrentUserId()).toBe('user123');
    });

    it('should throw error when config manager is not available', async () => {
      // Arrange
      mockRtcConfigManager.initialize.mockRejectedValue(new Error('Config not available'));

      // Act & Assert
      await expect(webrtcManager.initialize('user123'))
        .rejects.toThrow('WebRTC配置初始化失败');
    });

    it('should throw error when user ID is invalid', async () => {
      // Act & Assert
      await expect(webrtcManager.initialize(''))
        .rejects.toThrow('用户ID不能为空');
      
      await expect(webrtcManager.initialize(null as any))
        .rejects.toThrow('用户ID不能为空');
    });

    it('should not reinitialize if already initialized', async () => {
      // Arrange
      mockRtcConfigManager.initialize.mockResolvedValue(undefined);
      await webrtcManager.initialize('user123');
      vi.clearAllMocks();

      // Act
      await webrtcManager.initialize('user456');

      // Assert
      expect(mockRtcConfigManager.initialize).not.toHaveBeenCalled();
      expect(webrtcManager.getCurrentUserId()).toBe('user123'); // Should not change
    });
  });

  describe('createPeerConnection', () => {
    beforeEach(async () => {
      mockRtcConfigManager.initialize.mockResolvedValue(undefined);
      await webrtcManager.initialize('user123');
    });

    it('should create peer connection with proper configuration', () => {
      // Act
      const pc = webrtcManager.createPeerConnection('user456');

      // Assert
      expect(RTCPeerConnection).toHaveBeenCalledWith({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      expect(pc).toBe(mockRTCPeerConnection);
    });

    it('should store connection info correctly', () => {
      // Act
      webrtcManager.createPeerConnection('user456');

      // Assert
      const connectionInfo = webrtcManager.getPeerConnectionInfo('user456');
      expect(connectionInfo).toBeDefined();
      expect(connectionInfo!.userId).toBe('user456');
      expect(connectionInfo!.connection).toBe(mockRTCPeerConnection);
      expect(connectionInfo!.isInitiator).toBe(true);
      expect(connectionInfo!.state).toBe('new');
    });

    it('should setup event listeners for connection state changes', () => {
      // Act
      webrtcManager.createPeerConnection('user456');

      // Assert
      expect(mockRTCPeerConnection.addEventListener).toHaveBeenCalledWith(
        'connectionstatechange',
        expect.any(Function)
      );
      expect(mockRTCPeerConnection.addEventListener).toHaveBeenCalledWith(
        'icecandidate',
        expect.any(Function)
      );
      expect(mockRTCPeerConnection.addEventListener).toHaveBeenCalledWith(
        'track',
        expect.any(Function)
      );
    });

    it('should create data channel when specified', () => {
      // Act
      webrtcManager.createPeerConnection('user456', { createDataChannel: true });

      // Assert
      expect(mockRTCPeerConnection.createDataChannel).toHaveBeenCalledWith(
        'data',
        expect.objectContaining({
          ordered: true,
        })
      );
    });

    it('should not create duplicate connections', () => {
      // Act
      const pc1 = webrtcManager.createPeerConnection('user456');
      const pc2 = webrtcManager.createPeerConnection('user456');

      // Assert
      expect(pc1).toBe(pc2);
      expect(RTCPeerConnection).toHaveBeenCalledTimes(1);
    });
  });

  describe('closePeerConnection', () => {
    beforeEach(async () => {
      mockRtcConfigManager.initialize.mockResolvedValue(undefined);
      await webrtcManager.initialize('user123');
    });

    it('should close existing peer connection', () => {
      // Arrange
      webrtcManager.createPeerConnection('user456');

      // Act
      webrtcManager.closePeerConnection('user456');

      // Assert
      expect(mockRTCPeerConnection.close).toHaveBeenCalled();
      expect(webrtcManager.getPeerConnectionInfo('user456')).toBeNull();
    });

    it('should handle closing non-existent connection gracefully', () => {
      // Act & Assert - Should not throw
      expect(() => webrtcManager.closePeerConnection('nonexistent'))
        .not.toThrow();
    });

    it('should clean up data channel if exists', () => {
      // Arrange
      webrtcManager.createPeerConnection('user456', { createDataChannel: true });

      // Act
      webrtcManager.closePeerConnection('user456');

      // Assert
      expect(mockRTCDataChannel.close).toHaveBeenCalled();
    });
  });

  describe('createOffer', () => {
    beforeEach(async () => {
      mockRtcConfigManager.initialize.mockResolvedValue(undefined);
      await webrtcManager.initialize('user123');
    });

    it('should create offer with media constraints', async () => {
      // Arrange
      const mockOffer = { type: 'offer', sdp: 'mock-sdp' };
      mockRTCPeerConnection.createOffer.mockResolvedValue(mockOffer);
      mockRTCPeerConnection.setLocalDescription.mockResolvedValue(undefined);

      webrtcManager.createPeerConnection('user456');

      // Act
      const result = await webrtcManager.createOffer('user456', {
        audio: true,
        video: { width: 640, height: 480 }
      });

      // Assert
      expect(mockRTCPeerConnection.createOffer).toHaveBeenCalledWith({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      expect(mockRTCPeerConnection.setLocalDescription).toHaveBeenCalledWith(mockOffer);
      expect(result).toEqual(mockOffer);
    });

    it('should throw error for non-existent connection', async () => {
      // Act & Assert
      await expect(webrtcManager.createOffer('nonexistent'))
        .rejects.toThrow('指定用户的连接不存在');
    });

    it('should handle createOffer errors', async () => {
      // Arrange
      webrtcManager.createPeerConnection('user456');
      mockRTCPeerConnection.createOffer.mockRejectedValue(new Error('Offer failed'));

      // Act & Assert
      await expect(webrtcManager.createOffer('user456'))
        .rejects.toThrow('创建offer失败');
    });
  });

  describe('createAnswer', () => {
    beforeEach(async () => {
      mockRtcConfigManager.initialize.mockResolvedValue(undefined);
      await webrtcManager.initialize('user123');
    });

    it('should create answer after setting remote description', async () => {
      // Arrange
      const mockOffer = { type: 'offer', sdp: 'mock-offer-sdp' };
      const mockAnswer = { type: 'answer', sdp: 'mock-answer-sdp' };
      
      mockRTCPeerConnection.setRemoteDescription.mockResolvedValue(undefined);
      mockRTCPeerConnection.createAnswer.mockResolvedValue(mockAnswer);
      mockRTCPeerConnection.setLocalDescription.mockResolvedValue(undefined);

      webrtcManager.createPeerConnection('user456');

      // Act
      const result = await webrtcManager.createAnswer('user456', mockOffer);

      // Assert
      expect(mockRTCPeerConnection.setRemoteDescription).toHaveBeenCalledWith(mockOffer);
      expect(mockRTCPeerConnection.createAnswer).toHaveBeenCalled();
      expect(mockRTCPeerConnection.setLocalDescription).toHaveBeenCalledWith(mockAnswer);
      expect(result).toEqual(mockAnswer);
    });

    it('should throw error for non-existent connection', async () => {
      // Arrange
      const mockOffer = { type: 'offer', sdp: 'mock-offer-sdp' };

      // Act & Assert
      await expect(webrtcManager.createAnswer('nonexistent', mockOffer))
        .rejects.toThrow('指定用户的连接不存在');
    });
  });

  describe('addIceCandidate', () => {
    beforeEach(async () => {
      mockRtcConfigManager.initialize.mockResolvedValue(undefined);
      await webrtcManager.initialize('user123');
    });

    it('should add ICE candidate to connection', async () => {
      // Arrange
      const mockCandidate: IceCandidate = {
        candidate: 'candidate:1 1 UDP 2122252543 192.168.1.100 54400 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
        usernameFragment: 'abcd',
      };

      mockRTCPeerConnection.addIceCandidate.mockResolvedValue(undefined);
      webrtcManager.createPeerConnection('user456');

      // Act
      await webrtcManager.addIceCandidate('user456', mockCandidate);

      // Assert
      expect(mockRTCPeerConnection.addIceCandidate).toHaveBeenCalledWith(
        expect.objectContaining({
          candidate: mockCandidate.candidate,
          sdpMLineIndex: mockCandidate.sdpMLineIndex,
          sdpMid: mockCandidate.sdpMid,
        })
      );
    });

    it('should throw error for non-existent connection', async () => {
      // Arrange
      const mockCandidate: IceCandidate = {
        candidate: 'mock-candidate',
        sdpMLineIndex: 0,
        sdpMid: '0',
        usernameFragment: 'abcd',
      };

      // Act & Assert
      await expect(webrtcManager.addIceCandidate('nonexistent', mockCandidate))
        .rejects.toThrow('指定用户的连接不存在');
    });
  });

  describe('getUserMedia', () => {
    beforeEach(async () => {
      mockRtcConfigManager.initialize.mockResolvedValue(undefined);
      await webrtcManager.initialize('user123');
    });

    it('should get user media with specified constraints', async () => {
      // Arrange
      const constraints: MediaConstraints = {
        audio: true,
        video: { width: 640, height: 480 }
      };

      // Act
      const stream = await webrtcManager.getUserMedia(constraints);

      // Assert
      expect(mockGetUserMedia).toHaveBeenCalledWith(constraints);
      expect(stream).toBe(mockMediaStream);
    });

    it('should handle getUserMedia errors', async () => {
      // Arrange
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));

      // Act & Assert
      await expect(webrtcManager.getUserMedia({ audio: true }))
        .rejects.toThrow('获取媒体设备失败');
    });
  });

  describe('getDisplayMedia', () => {
    beforeEach(async () => {
      mockRtcConfigManager.initialize.mockResolvedValue(undefined);
      await webrtcManager.initialize('user123');
    });

    it('should get display media for screen sharing', async () => {
      // Act
      const stream = await webrtcManager.getDisplayMedia();

      // Assert
      expect(mockGetDisplayMedia).toHaveBeenCalledWith({
        video: true,
        audio: true,
      });
      expect(stream).toBe(mockMediaStream);
    });

    it('should handle getDisplayMedia errors', async () => {
      // Arrange
      mockGetDisplayMedia.mockRejectedValue(new Error('User cancelled'));

      // Act & Assert
      await expect(webrtcManager.getDisplayMedia())
        .rejects.toThrow('获取屏幕共享失败');
    });
  });

  describe('addLocalStream', () => {
    beforeEach(async () => {
      mockRtcConfigManager.initialize.mockResolvedValue(undefined);
      await webrtcManager.initialize('user123');
    });

    it('should add local stream to peer connection', () => {
      // Arrange
      const mockTrack = { kind: 'video' };
      mockMediaStream.getTracks.mockReturnValue([mockTrack]);
      
      webrtcManager.createPeerConnection('user456');

      // Act
      webrtcManager.addLocalStream('user456', mockMediaStream);

      // Assert
      expect(mockRTCPeerConnection.addTrack).toHaveBeenCalledWith(mockTrack, mockMediaStream);
      
      const connectionInfo = webrtcManager.getPeerConnectionInfo('user456');
      expect(connectionInfo!.localStream).toBe(mockMediaStream);
    });

    it('should throw error for non-existent connection', () => {
      // Act & Assert
      expect(() => webrtcManager.addLocalStream('nonexistent', mockMediaStream))
        .toThrow('指定用户的连接不存在');
    });
  });

  describe('removeLocalStream', () => {
    beforeEach(async () => {
      mockRtcConfigManager.initialize.mockResolvedValue(undefined);
      await webrtcManager.initialize('user123');
    });

    it('should remove local stream from peer connection', () => {
      // Arrange
      const mockTrack = { kind: 'video' };
      const mockSender = { track: mockTrack };
      
      mockMediaStream.getTracks.mockReturnValue([mockTrack]);
      mockRTCPeerConnection.getSenders = vi.fn().mockReturnValue([mockSender]);
      mockRTCPeerConnection.removeTrack = vi.fn();
      
      webrtcManager.createPeerConnection('user456');
      webrtcManager.addLocalStream('user456', mockMediaStream);

      // Act
      webrtcManager.removeLocalStream('user456');

      // Assert
      expect(mockRTCPeerConnection.removeTrack).toHaveBeenCalledWith(mockSender);
      
      const connectionInfo = webrtcManager.getPeerConnectionInfo('user456');
      expect(connectionInfo!.localStream).toBeNull();
    });
  });

  describe('addEventListener', () => {
    beforeEach(async () => {
      mockRtcConfigManager.initialize.mockResolvedValue(undefined);
      await webrtcManager.initialize('user123');
    });

    it('should add event listeners correctly', () => {
      // Arrange
      const onConnectionStateChange = vi.fn();
      const onIceCandidate = vi.fn();
      const onRemoteStream = vi.fn();

      // Act
      webrtcManager.addEventListener({
        onConnectionStateChange,
        onIceCandidate,
        onRemoteStream,
      });

      // Assert
      expect((webrtcManager as any).listeners.onConnectionStateChange).toBe(onConnectionStateChange);
      expect((webrtcManager as any).listeners.onIceCandidate).toBe(onIceCandidate);
      expect((webrtcManager as any).listeners.onRemoteStream).toBe(onRemoteStream);
    });
  });

  describe('getMediaDevices', () => {
    beforeEach(async () => {
      mockRtcConfigManager.initialize.mockResolvedValue(undefined);
      await webrtcManager.initialize('user123');
    });

    it('should enumerate available media devices', async () => {
      // Act
      const devices = await webrtcManager.getMediaDevices();

      // Assert
      expect(mockEnumerateDevices).toHaveBeenCalled();
      expect(devices).toHaveLength(2);
      expect(devices[0]).toMatchObject({
        deviceId: 'camera-1',
        kind: 'videoinput',
        label: 'Mock Camera',
      });
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      mockRtcConfigManager.initialize.mockResolvedValue(undefined);
      await webrtcManager.initialize('user123');
    });

    it('should close all connections and reset state', () => {
      // Arrange
      webrtcManager.createPeerConnection('user456');
      webrtcManager.createPeerConnection('user789');

      // Act
      webrtcManager.cleanup();

      // Assert
      expect(mockRTCPeerConnection.close).toHaveBeenCalledTimes(2);
      expect(webrtcManager.getPeerConnectionInfo('user456')).toBeNull();
      expect(webrtcManager.getPeerConnectionInfo('user789')).toBeNull();
      expect((webrtcManager as any).isInitialized).toBe(false);
      expect((webrtcManager as any).currentUserId).toBeNull();
    });
  });
});
