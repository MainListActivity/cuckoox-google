import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import webrtcManagerInstance, { WebRTCManager } from '../../../src/services/webrtcManager';
import rtcConfigManager from '../../../src/services/rtcConfigManager';
import type { MediaConstraints, IceCandidate, SessionDescription } from '../../../src/services/webrtcManager';

// Mock dependencies
vi.mock('../../../src/services/rtcConfigManager');

const mockRtcConfigManager = vi.mocked(rtcConfigManager);

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
  getSenders: vi.fn(() => [] as RTCRtpSender[]),
  getReceivers: vi.fn(() => [] as RTCRtpReceiver[]),
  getTransceivers: vi.fn(() => [] as RTCRtpTransceiver[]),
};

const mockMediaStream = {
  id: 'mock-stream-id',
  active: true,
  getTracks: vi.fn(() => [
    { id: 'audio-track', kind: 'audio', enabled: true, stop: vi.fn() },
    { id: 'video-track', kind: 'video', enabled: true, stop: vi.fn() }
  ]),
  getAudioTracks: vi.fn(() => [{ id: 'audio-track', kind: 'audio', enabled: true, stop: vi.fn() }]),
  getVideoTracks: vi.fn(() => [{ id: 'video-track', kind: 'video', enabled: true, stop: vi.fn() }]),
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
  clone: vi.fn(),
  getTrackById: vi.fn(),
  dispatchEvent: vi.fn(),
} as unknown as MediaStream;

const mockDataChannel = {
  label: 'test-channel',
  readyState: 'open',
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// Mock global WebRTC APIs
(global as any).RTCPeerConnection = vi.fn(() => mockRTCPeerConnection);
(global as any).RTCSessionDescription = vi.fn((description) => description);
(global as any).RTCIceCandidate = vi.fn((candidate) => candidate);
(global as any).navigator = {
  mediaDevices: {
    getUserMedia: vi.fn(),
    getDisplayMedia: vi.fn(),
    enumerateDevices: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ondevicechange: null,
  },
};

const mockConfig = {
  stun_servers: ['stun:stun.l.google.com:19302'],
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

describe('WebRTCManager', () => {
  let webrtcManager: WebRTCManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup basic mocks
    mockRtcConfigManager.getConfig.mockResolvedValue(mockConfig);
    mockRtcConfigManager.onConfigUpdate.mockReturnValue(() => {});
    
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
    mockRTCPeerConnection.createDataChannel.mockReturnValue(mockDataChannel);
    
    (global as any).navigator.mediaDevices.getUserMedia.mockResolvedValue(mockMediaStream);
    (global as any).navigator.mediaDevices.getDisplayMedia.mockResolvedValue(mockMediaStream);
    
    // Create WebRTCManager instance
    webrtcManager = new WebRTCManager();
    
    // Wait for webrtcManager to initialize
    await new Promise(resolve => setTimeout(resolve, 10));
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
      expect(RTCPeerConnection).toHaveBeenCalled();
    });

    it('should get peer connection info', async () => {
      // Arrange
      await webrtcManager.createPeerConnection('user456');

      // Act
      const info = webrtcManager.getConnectionInfo('user456');

      // Assert
      expect(info).not.toBeNull();
      expect(info?.userId).toBe('user456');
    });

    it('should close peer connection', async () => {
      // Arrange
      await webrtcManager.createPeerConnection('user456');

      // Act
      await webrtcManager.closePeerConnection('user456');

      // Assert
      expect(mockRTCPeerConnection.close).toHaveBeenCalled();
      expect(webrtcManager.getConnectionInfo('user456')).toBeNull();
    });
  });

  describe('Offer/Answer Handling', () => {
    beforeEach(async () => {
      await webrtcManager.createPeerConnection('user456', true);
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
      const description: SessionDescription = {
        type: 'answer',
        sdp: 'test-sdp',
      };

      // Act
      await webrtcManager.setRemoteDescription('user456', description);

      // Assert
      expect(mockRTCPeerConnection.setRemoteDescription).toHaveBeenCalledWith(description);
    });
  });

  describe('ICE Candidate Handling', () => {
    beforeEach(async () => {
      await webrtcManager.createPeerConnection('user456');
    });

    it('should add ICE candidate successfully', async () => {
      // Arrange
      const candidate: IceCandidate = {
        candidate: 'candidate:123 1 UDP 2113667326 192.168.1.100 54400 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
        usernameFragment: 'test',
      };

      // Act
      await webrtcManager.addIceCandidate('user456', candidate);

      // Assert
      expect(mockRTCPeerConnection.addIceCandidate).toHaveBeenCalledWith(candidate);
    });
  });

  describe('Media Stream Handling', () => {
    beforeEach(async () => {
      await webrtcManager.createPeerConnection('user456');
    });

    it('should get user media successfully', async () => {
      // Arrange
      const constraints: MediaConstraints = {
        audio: true,
        video: true,
      };

      // Act
      const stream = await webrtcManager.getUserMedia(constraints);

      // Assert
      expect(stream).toBe(mockMediaStream);
      expect((global as any).navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(constraints);
    });

    it('should get display media successfully', async () => {
      // Act
      const stream = await webrtcManager.getDisplayMedia();

      // Assert
      expect(stream).toBe(mockMediaStream);
      expect((global as any).navigator.mediaDevices.getDisplayMedia).toHaveBeenCalled();
    });

    it('should add local stream to connection', async () => {
      // Act
      await webrtcManager.addLocalStream('user456', mockMediaStream);

      // Assert
      expect(mockRTCPeerConnection.addTrack).toHaveBeenCalled();
    });

    it('should remove local stream from connection', async () => {
      // Arrange
      const mockSender = { track: 'mock-track' } as unknown as RTCRtpSender;
      mockRTCPeerConnection.getSenders.mockReturnValue([mockSender]);

      // Act
      await webrtcManager.removeLocalStream('user456');

      // Assert
      expect(mockRTCPeerConnection.removeTrack).toHaveBeenCalledWith(mockSender);
    });
  });

  describe('Data Channel', () => {
    beforeEach(async () => {
      await webrtcManager.createPeerConnection('user456', true);
    });

    it('should send data through data channel', async () => {
      // Arrange
      const data = { type: 'test', message: 'hello' };

      // Act
      webrtcManager.sendDataChannelMessage('user456', data);

      // Assert
      expect(mockDataChannel.send).toHaveBeenCalledWith(JSON.stringify(data));
    });
  });

  describe('Event Listeners', () => {
    it('should set event listeners', () => {
      // Arrange
      const listeners = {
        onConnectionStateChange: vi.fn(),
        onRemoteStream: vi.fn(),
        onDataChannelMessage: vi.fn(),
      };

      // Act
      webrtcManager.setEventListeners(listeners);

      // Assert - This tests that the method doesn't throw
      expect(() => webrtcManager.setEventListeners(listeners)).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      await webrtcManager.createPeerConnection('user456');
      await webrtcManager.createPeerConnection('user789');
    });

    it('should destroy all connections', () => {
      // Act
      webrtcManager.destroy();

      // Assert
      expect(mockRTCPeerConnection.close).toHaveBeenCalledTimes(2);
      expect(webrtcManager.getConnectionInfo('user456')).toBeNull();
      expect(webrtcManager.getConnectionInfo('user789')).toBeNull();
    });
  });
});
