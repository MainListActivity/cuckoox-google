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
