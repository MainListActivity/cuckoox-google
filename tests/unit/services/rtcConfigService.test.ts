import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import rtcConfigService, { RTCConfig } from '@/src/services/rtcConfigService';

// Mock the SurrealProvider
const mockSurrealClientSingleton = {
  query: vi.fn(),
  queryLive: vi.fn(),
  invalidateQuery: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  select: vi.fn(),
};

vi.mock('@/src/contexts/SurrealProvider', () => ({
  useSurrealClientSingleton: () => mockSurrealClientSingleton,
  TenantCodeMissingError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'TenantCodeMissingError';
    }
  },
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock default RTC config
  const mockDefaultConfig: RTCConfig = {
    stun_servers: ['stun:stun.l.google.com:19302'],
    max_file_size: 100 * 1024 * 1024,
    file_chunk_size: 16384,
    supported_image_types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    supported_video_types: ['video/mp4', 'video/webm', 'video/mov'],
    supported_audio_types: ['audio/mp3', 'audio/wav', 'audio/ogg'],
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

describe('RTCConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getRTCConfig', () => {
    it('should return RTC config from database when available', async () => {
      // Arrange
      const mockDbConfig = {
        ...mockDefaultConfig,
        max_file_size: 200 * 1024 * 1024, // Different from default
      };
      
      mockSurrealClientSingleton.query.mockResolvedValue([
        [{ config_value: mockDbConfig }]
      ]);

      // Act
      const result = await rtcConfigService.getRTCConfig();

      // Assert
      expect(result).toEqual(mockDbConfig);
      expect(mockSurrealClientSingleton.query).toHaveBeenCalledWith(
        "SELECT config_value FROM system_config WHERE config_key = 'webrtc_config'"
      );
    });

    it('should return default config when database config not found', async () => {
      // Arrange
      mockSurrealClientSingleton.query.mockResolvedValue([[]]);

      // Act
      const result = await rtcConfigService.getRTCConfig();

      // Assert
      expect(result).toEqual(mockDefaultConfig);
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockSurrealClientSingleton.query.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await rtcConfigService.getRTCConfig();

      // Assert
      expect(result).toEqual(mockDefaultConfig);
    });
  });

  describe('updateRTCConfig', () => {
    it('should update RTC config in database successfully', async () => {
      // Arrange
      const updatedConfig = {
        ...mockDefaultConfig,
        max_file_size: 500 * 1024 * 1024,
      };

      mockSurrealClientSingleton.query.mockResolvedValue([
        [{ config_value: updatedConfig }]
      ]);

      // Act
      const result = await rtcConfigService.updateConfig(updatedConfig);

      // Assert
      expect(result).toEqual(updatedConfig);
      expect(mockSurrealClientSingleton.query).toHaveBeenCalledWith(
        "UPDATE system_config SET config_value = $config, updated_at = time::now() WHERE config_key = 'webrtc_config'",
        { config: updatedConfig }
      );
    });

    it('should create new config record if none exists', async () => {
      // Arrange
      const newConfig = mockDefaultConfig;
      
      // First query returns empty (no existing config)
      mockSurrealClientSingleton.query
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ config_value: newConfig }]]);

      // Act
      const result = await rtcConfigService.updateConfig(newConfig);

      // Assert
      expect(result).toEqual(newConfig);
      expect(mockSurrealClientSingleton.query).toHaveBeenCalledWith(
        "CREATE system_config CONTENT { config_key: 'webrtc_config', config_value: $config, description: 'WebRTC功能配置' }",
        { config: newConfig }
      );
    });

    it('should validate required config fields', async () => {
      // Arrange
      const invalidConfig = {
        ...mockDefaultConfig,
        stun_servers: [], // Invalid: empty array
      };

      // Act & Assert
      await expect(rtcConfigService.updateConfig(invalidConfig))
        .rejects.toThrow('STUN服务器配置不能为空');
    });

    it('should validate file size limits', async () => {
      // Arrange
      const invalidConfig = {
        ...mockDefaultConfig,
        max_file_size: -1, // Invalid: negative value
      };

      // Act & Assert
      await expect(rtcConfigService.updateConfig(invalidConfig))
        .rejects.toThrow('最大文件大小必须大于0');
    });
  });

  describe('isFileTypeSupported', () => {
    beforeEach(() => {
      // Setup mock config in service
      (rtcConfigService as any).cachedConfig = mockDefaultConfig;
    });

    it('should validate supported image types', () => {
      // Act & Assert
      expect(rtcConfigService.isFileTypeSupported('test.jpg')).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.png')).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.gif')).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.webp')).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.bmp')).toBe(false);
    });

    it('should validate supported video types', () => {
      // Act & Assert
      expect(rtcConfigService.isFileTypeSupported('test.mp4')).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.webm')).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.mov')).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.avi')).toBe(false);
    });

    it('should validate supported audio types', () => {
      // Act & Assert
      expect(rtcConfigService.isFileTypeSupported('test.mp3')).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.wav')).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.ogg')).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.flac')).toBe(false);
    });

    it('should return false for unsupported types', () => {
      // Act & Assert
      expect(rtcConfigService.isFileTypeSupported('test.exe')).toBe(false);
      expect(rtcConfigService.isFileTypeSupported('')).toBe(false);
    });
  });

  describe('isFileSizeValid', () => {
    beforeEach(() => {
      // Setup mock config in service
      (rtcConfigService as any).cachedConfig = mockDefaultConfig;
    });

    it('should validate file size within limit', () => {
      // Act & Assert
      expect(rtcConfigService.isFileSizeValid(50 * 1024 * 1024)).toBe(true); // 50MB
      expect(rtcConfigService.isFileSizeValid(100 * 1024 * 1024)).toBe(true); // 100MB (exact limit)
    });

    it('should reject file size exceeding limit', () => {
      // Act & Assert
      expect(rtcConfigService.isFileSizeValid(150 * 1024 * 1024)).toBe(false); // 150MB
    });

    it('should reject negative file sizes', () => {
      // Act & Assert
      expect(rtcConfigService.isFileSizeValid(-1)).toBe(false);
      expect(rtcConfigService.isFileSizeValid(0)).toBe(true); // 0 size should be valid
    });
  });
});
