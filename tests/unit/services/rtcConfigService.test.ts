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

// Mock default RTC config - should match the actual default config
  const mockDefaultConfig: RTCConfig = {
    stun_servers: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
    max_file_size: 104857600, // 100MB
    file_chunk_size: 65536,   // 64KB
    supported_image_types: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'],
    supported_video_types: ['mp4', 'webm', 'mov', 'avi', 'wmv'],
    supported_audio_types: ['mp3', 'wav', 'ogg', 'aac', 'm4a'],
    supported_document_types: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'],
    enable_voice_call: true,
    enable_video_call: true,
    enable_screen_share: true,
    enable_file_transfer: true,
    enable_group_chat: true,
    enable_group_call: true,
    enable_message_recall: true,
    enable_message_edit: true,
    max_conference_participants: 8,
    max_group_members: 100,
    file_transfer_timeout: 300000, // 5分钟
    call_timeout: 30000,          // 30秒
    signal_expiry: 3600000,       // 信令1小时过期
    message_recall_timeout: 120,  // 消息撤回时限(秒)
    network_quality_thresholds: {
      excellent: { bandwidth: 1500, latency: 50, packet_loss: 0.001 },
      good: { bandwidth: 1000, latency: 100, packet_loss: 0.005 },
      fair: { bandwidth: 500, latency: 200, packet_loss: 0.01 },
      poor: { bandwidth: 100, latency: 400, packet_loss: 0.1 }
    },
    video_quality: {
      low: { width: 320, height: 240, framerate: 15, bitrate: 150000 },
      medium: { width: 640, height: 480, framerate: 24, bitrate: 500000 },
      high: { width: 1280, height: 720, framerate: 30, bitrate: 1000000 },
      ultra: { width: 1920, height: 1080, framerate: 30, bitrate: 2000000 }
    },
    audio_quality: {
      low: { bitrate: 32000, sampleRate: 16000 },
      medium: { bitrate: 64000, sampleRate: 44100 },
      high: { bitrate: 128000, sampleRate: 48000 }
    },
    cleanup_config: {
      signal_retention_hours: 24,
      call_record_retention_days: 365,
      file_cache_retention_days: 30,
      read_status_retention_days: 90
    },
    performance_config: {
      message_batch_size: 50,
      max_concurrent_transfers: 3,
      chunk_upload_concurrency: 2,
      enable_message_pagination: true,
      cache_message_count: 100
    },
  };

describe('RTCConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    
    // Clear cached config
    (rtcConfigService as any).cachedConfig = null;
    (rtcConfigService as any).lastUpdateTime = 0;
    
    // Set up clientGetter to provide the mock client
    rtcConfigService.setClientGetter(() => Promise.resolve(mockSurrealClientSingleton as any));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.resetModules();
    mockLocalStorage.clear();
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
        "SELECT * FROM system_config WHERE config_key = 'rtc'"
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
      const configUpdate = {
        max_file_size: 500 * 1024 * 1024,
      };

      // Mock getRTCConfig call (which is called inside updateConfig)
      mockSurrealClientSingleton.query
        .mockResolvedValueOnce([[{ config_value: mockDefaultConfig }]]) // for getRTCConfig
        .mockResolvedValueOnce([]); // for the UPDATE query

      // Act
      await rtcConfigService.updateConfig(configUpdate);

      // Assert
      expect(mockSurrealClientSingleton.query).toHaveBeenCalledWith(
        "UPDATE system_config SET config_value = $config, updated_at = time::now() WHERE config_key = 'rtc'",
        { config: { ...mockDefaultConfig, ...configUpdate } }
      );
    });


  });

  describe('isFileTypeSupported', () => {
    // Use a config with extension-based types (not MIME types)
    const testConfig: RTCConfig = {
      ...mockDefaultConfig,
      supported_image_types: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'],
      supported_video_types: ['mp4', 'webm', 'mov', 'avi', 'wmv'],
      supported_audio_types: ['mp3', 'wav', 'ogg', 'aac', 'm4a'],
      supported_document_types: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt']
    };

    it('should validate supported image types', () => {
      // Act & Assert
      expect(rtcConfigService.isFileTypeSupported('test.jpg', testConfig)).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.png', testConfig)).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.gif', testConfig)).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.webp', testConfig)).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.tiff', testConfig)).toBe(false);
    });

    it('should validate supported video types', () => {
      // Act & Assert
      expect(rtcConfigService.isFileTypeSupported('test.mp4', testConfig)).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.webm', testConfig)).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.mov', testConfig)).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.mkv', testConfig)).toBe(false);
    });

    it('should validate supported audio types', () => {
      // Act & Assert
      expect(rtcConfigService.isFileTypeSupported('test.mp3', testConfig)).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.wav', testConfig)).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.ogg', testConfig)).toBe(true);
      expect(rtcConfigService.isFileTypeSupported('test.flac', testConfig)).toBe(false);
    });

    it('should return false for unsupported types', () => {
      // Act & Assert
      expect(rtcConfigService.isFileTypeSupported('test.exe', testConfig)).toBe(false);
      expect(rtcConfigService.isFileTypeSupported('', testConfig)).toBe(false);
    });

    it('should return false when no config provided and no cached config', () => {
      // Act & Assert
      expect(rtcConfigService.isFileTypeSupported('test.jpg')).toBe(false);
    });
  });

  describe('isFileSizeValid', () => {
    const testConfig: RTCConfig = {
      ...mockDefaultConfig,
      max_file_size: 100 * 1024 * 1024, // 100MB
    };

    it('should validate file size within limit', () => {
      // Act & Assert
      expect(rtcConfigService.isFileSizeValid(50 * 1024 * 1024, testConfig)).toBe(true); // 50MB
      expect(rtcConfigService.isFileSizeValid(100 * 1024 * 1024, testConfig)).toBe(true); // 100MB (exact limit)
    });

    it('should reject file size exceeding limit', () => {
      // Act & Assert
      expect(rtcConfigService.isFileSizeValid(150 * 1024 * 1024, testConfig)).toBe(false); // 150MB
    });

    it('should handle edge cases', () => {
      // Act & Assert
      expect(rtcConfigService.isFileSizeValid(0, testConfig)).toBe(true); // 0 size should be valid
    });

    it('should return false when no config provided and no cached config', () => {
      // Act & Assert
      expect(rtcConfigService.isFileSizeValid(50 * 1024 * 1024)).toBe(false);
    });
  });
});
