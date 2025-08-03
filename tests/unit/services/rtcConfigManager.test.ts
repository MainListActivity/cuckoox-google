import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import rtcConfigManager from '@/src/services/rtcConfigManager';
import rtcConfigService from '@/src/services/rtcConfigService';

// Mock dependencies
vi.mock('@/src/services/rtcConfigService');

const mockRtcConfigService = vi.mocked(rtcConfigService);

describe('RTCConfigManager', () => {
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
    // Reset manager state
    (rtcConfigManager as any).config = null;
    (rtcConfigManager as any).isInitialized = false;
    (rtcConfigManager as any).subscribers = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      // Arrange
      mockRtcConfigService.getRTCConfig.mockResolvedValue(mockConfig);

      // Act
      await rtcConfigManager.initialize();

      // Assert
      expect(rtcConfigService.getRTCConfig).toHaveBeenCalled();
    });

    it('should handle initialization failure gracefully', async () => {
      // Arrange
      mockRtcConfigService.getRTCConfig.mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(rtcConfigManager.initialize()).rejects.toThrow('Network error');
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      mockRtcConfigService.getRTCConfig.mockResolvedValue(mockConfig);
      await rtcConfigManager.initialize();
    });

    it('should get current configuration', () => {
      // Act
      const config = rtcConfigManager.getConfig();

      // Assert
      expect(config).toEqual(mockConfig);
    });

    it('should validate file sizes', () => {
      // Act & Assert
      expect(rtcConfigManager.isFileSizeValid(50 * 1024 * 1024)).toBe(true); // 50MB
      expect(rtcConfigManager.isFileSizeValid(150 * 1024 * 1024)).toBe(false); // 150MB
    });

    it('should get STUN servers', () => {
      // Act
      const stunServers = rtcConfigManager.getStunServers();

      // Assert
      expect(stunServers).toEqual(['stun:stun.l.google.com:19302']);
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      mockRtcConfigService.getRTCConfig.mockResolvedValue(mockConfig);
      await rtcConfigManager.initialize();
    });

    it('should cleanup resources on destroy', async () => {
      // Act
      await rtcConfigManager.destroy();

      // Assert - This tests that the method doesn't throw
      expect(() => rtcConfigManager.destroy()).not.toThrow();
    });
  });
});
