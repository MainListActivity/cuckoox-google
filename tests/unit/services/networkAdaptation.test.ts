import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import networkAdaptation from '@/src/services/networkAdaptation';
import webrtcManager from '@/src/services/webrtcManager';
import rtcConfigManager from '@/src/services/rtcConfigManager';

// Mock dependencies
vi.mock('@/src/services/webrtcManager', () => ({
  default: {
    getStreamStats: vi.fn(),
    adjustVideoQuality: vi.fn(),
    autoAdjustVideoQuality: vi.fn(),
    detectNetworkQuality: vi.fn(),
    getConnectionInfo: vi.fn(),
  },
}));

vi.mock('@/src/services/rtcConfigManager', () => ({
  default: {
    getConfig: vi.fn(),
    getNetworkQualityLevel: vi.fn(),
    onConfigUpdate: vi.fn(),
  },
}));

const mockWebrtcManager = webrtcManager as {
  getStreamStats: Mock;
  adjustVideoQuality: Mock;
  autoAdjustVideoQuality: Mock;
  detectNetworkQuality: Mock;
  getConnectionInfo: Mock;
};

const mockRtcConfigManager = rtcConfigManager as {
  getConfig: Mock;
  getNetworkQualityLevel: Mock;
  onConfigUpdate: Mock;
};

// Mock performance API
const mockPerformance = {
  now: vi.fn().mockReturnValue(1000),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByType: vi.fn().mockReturnValue([]),
};
vi.stubGlobal('performance', mockPerformance);

// Mock navigator connection API
const mockConnection = {
  effectiveType: '4g',
  downlink: 10,
  rtt: 50,
  saveData: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

Object.defineProperty(navigator, 'connection', {
  value: mockConnection,
  configurable: true,
});

describe('NetworkAdaptation', () => {
  const mockConfig = {
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
  };

  const mockStats = {
    bandwidth: 1500,
    latency: 80,
    packetLoss: 0.02,
    jitter: 10,
    audioQuality: 85,
    videoQuality: 90,
    connectionState: 'good' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockRtcConfigManager.getConfig.mockReturnValue(mockConfig);
    mockRtcConfigManager.getNetworkQualityLevel.mockReturnValue('good');
    mockRtcConfigManager.onConfigUpdate.mockReturnValue(() => {}); // Return unsubscribe function
    mockWebrtcManager.getStreamStats.mockResolvedValue(mockStats);
    mockWebrtcManager.detectNetworkQuality.mockResolvedValue('good');
    mockWebrtcManager.getConnectionInfo.mockReturnValue({
      state: 'connected',
      iceConnectionState: 'connected',
    });
    
    // Reset network adaptation state
    (networkAdaptation as any).qualityHistory = [];
    (networkAdaptation as any).metricsHistory = [];
    (networkAdaptation as any).peerConnections = new Map();
    (networkAdaptation as any).currentQualityState = null;
    (networkAdaptation as any).isMonitoring = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Network Quality Measurement', () => {
    it('should measure network quality successfully', async () => {
      // Act
      const quality = await networkAdaptation.measureNetworkQuality();

      // Assert
      expect(quality).toEqual({
        bandwidth: expect.any(Number),
        latency: expect.any(Number),
        packetLoss: expect.any(Number),
        jitter: expect.any(Number),
        connectionType: '4g',
        effectiveBandwidth: 10,
        level: 'good',
        timestamp: expect.any(Number),
      });
    });

    it('should handle network measurement failure', async () => {
      // Arrange
      mockWebrtcManager.detectNetworkQuality.mockRejectedValue(new Error('Measurement failed'));

      // Act
      const quality = await networkAdaptation.measureNetworkQuality();

      // Assert
      expect(quality.level).toBe('unknown');
      expect(quality.bandwidth).toBe(0);
    });

    it('should classify network quality correctly', () => {
      // Arrange
      const metrics = {
        bandwidth: 1500,
        latency: 80,
        packetLoss: 0.02,
      };

      // Act
      const level = networkAdaptation.classifyNetworkQuality(metrics);

      // Assert
      expect(level).toBe('good');
    });

    it('should classify poor network quality', () => {
      // Arrange
      const metrics = {
        bandwidth: 100,
        latency: 600,
        packetLoss: 0.15,
      };

      // Act
      const level = networkAdaptation.classifyNetworkQuality(metrics);

      // Assert
      expect(level).toBe('poor');
    });
  });

  describe('Network Monitoring', () => {
    const callId = 'call123';

    it('should start network monitoring successfully', async () => {
      // Act
      await networkAdaptation.startNetworkMonitoring(callId);

      // Assert
      expect((networkAdaptation as any).monitoringCallIds.has(callId)).toBe(true);
    });

    it('should stop network monitoring successfully', async () => {
      // Arrange
      await networkAdaptation.startNetworkMonitoring(callId);

      // Act
      await networkAdaptation.stopNetworkMonitoring(callId);

      // Assert
      expect((networkAdaptation as any).monitoringCallIds.has(callId)).toBe(false);
    });

    it('should handle network quality changes during monitoring', async () => {
      // Arrange
      const callback = vi.fn();
      networkAdaptation.onNetworkQualityChange(callback);
      
      await networkAdaptation.startNetworkMonitoring(callId);

      // Act
      // Simulate quality change
      (networkAdaptation as any).handleQualityChange(callId, 'poor');

      // Assert
      expect(callback).toHaveBeenCalledWith(callId, 'poor');
    });

    it('should detect network degradation', async () => {
      // Arrange
      const callback = vi.fn();
      networkAdaptation.onNetworkDegradation(callback);
      
      // Simulate quality history
      (networkAdaptation as any).qualityHistory.set(callId, [
        { level: 'excellent', timestamp: 1000 },
        { level: 'good', timestamp: 2000 },
        { level: 'fair', timestamp: 3000 },
        { level: 'poor', timestamp: 4000 },
      ]);

      // Act
      (networkAdaptation as any).checkForDegradation(callId);

      // Assert
      expect(callback).toHaveBeenCalledWith(callId, {
        from: 'excellent',
        to: 'poor',
        degradationRate: expect.any(Number),
      });
    });
  });

  describe('Adaptive Quality Control', () => {
    const callId = 'call123';
    const userId = 'user456';

    it('should adjust bitrate based on network quality', async () => {
      // Arrange
      const quality = 'poor';

      // Act
      await networkAdaptation.adjustBitrate(quality, 'video');

      // Assert
      expect(mockWebrtcManager.adjustVideoQuality).toHaveBeenCalledWith(
        expect.any(String),
        'low'
      );
    });

    it('should enable auto bitrate adjustment', async () => {
      // Act
      await networkAdaptation.enableAutoBitrate(callId, true);

      // Assert
      expect(mockWebrtcManager.autoAdjustVideoQuality).toHaveBeenCalledWith(callId);
    });

    it('should disable auto bitrate adjustment', async () => {
      // Arrange
      (networkAdaptation as any).autoBitrateEnabled.set(callId, true);

      // Act
      await networkAdaptation.enableAutoBitrate(callId, false);

      // Assert
      expect((networkAdaptation as any).autoBitrateEnabled.get(callId)).toBe(false);
    });

    it('should adjust frame rate based on network conditions', async () => {
      // Arrange
      const networkQuality = 'fair';

      // Act
      await networkAdaptation.adjustFrameRate(callId, networkQuality);

      // Assert
      expect(mockWebrtcManager.adjustVideoQuality).toHaveBeenCalledWith(
        callId,
        expect.objectContaining({
          framerate: expect.any(Number),
        })
      );
    });

    it('should adjust resolution based on bandwidth', async () => {
      // Arrange
      const bandwidth = 300; // Low bandwidth

      // Act
      await networkAdaptation.adjustResolution(callId, bandwidth);

      // Assert
      expect(mockWebrtcManager.adjustVideoQuality).toHaveBeenCalledWith(
        callId,
        expect.objectContaining({
          width: 320,
          height: 240,
        })
      );
    });
  });

  describe('Connection Recovery', () => {
    const callId = 'call123';

    it('should handle network change successfully', async () => {
      // Arrange
      const newQuality = 'fair';

      // Act
      await networkAdaptation.handleNetworkChange(callId, newQuality);

      // Assert
      expect(mockWebrtcManager.adjustVideoQuality).toHaveBeenCalled();
    });

    it('should attempt reconnection on connection failure', async () => {
      // Arrange
      mockWebrtcManager.getConnectionInfo.mockReturnValue({
        state: 'failed',
        iceConnectionState: 'failed',
      });

      // Act
      const reconnected = await networkAdaptation.attemptReconnection(callId);

      // Assert
      expect(reconnected).toBe(true);
    });

    it('should handle reconnection failure', async () => {
      // Arrange
      mockWebrtcManager.getConnectionInfo.mockReturnValue({
        state: 'failed',
        iceConnectionState: 'failed',
      });
      
      // Mock reconnection failure
      vi.spyOn(networkAdaptation, 'attemptReconnection').mockResolvedValue(false);

      // Act
      const reconnected = await networkAdaptation.attemptReconnection(callId);

      // Assert
      expect(reconnected).toBe(false);
    });

    it('should switch to audio only on poor video quality', async () => {
      // Act
      await networkAdaptation.switchToAudioOnly(callId);

      // Assert
      expect(mockWebrtcManager.adjustVideoQuality).toHaveBeenCalledWith(
        callId,
        expect.objectContaining({
          video: false,
        })
      );
    });

    it('should restore video when quality improves', async () => {
      // Arrange
      (networkAdaptation as any).audioOnlyMode.set(callId, true);

      // Act
      await networkAdaptation.restoreVideo(callId);

      // Assert
      expect(mockWebrtcManager.adjustVideoQuality).toHaveBeenCalledWith(
        callId,
        expect.objectContaining({
          video: true,
        })
      );
      expect((networkAdaptation as any).audioOnlyMode.get(callId)).toBe(false);
    });
  });

  describe('Bandwidth Estimation', () => {
    it('should estimate available bandwidth', async () => {
      // Arrange
      mockWebrtcManager.getStreamStats.mockResolvedValue({
        ...mockStats,
        bandwidth: 2000,
      });

      // Act
      const bandwidth = await networkAdaptation.estimateBandwidth('call123');

      // Assert
      expect(bandwidth).toBe(2000);
    });

    it('should handle bandwidth estimation failure', async () => {
      // Arrange
      mockWebrtcManager.getStreamStats.mockRejectedValue(new Error('Stats unavailable'));

      // Act
      const bandwidth = await networkAdaptation.estimateBandwidth('call123');

      // Assert
      expect(bandwidth).toBe(0);
    });

    it('should predict bandwidth based on history', () => {
      // Arrange
      const history = [1000, 1200, 1100, 1300, 1250];

      // Act
      const predicted = networkAdaptation.predictBandwidth(history);

      // Assert
      expect(predicted).toBeCloseTo(1170, 0); // Average with trend
    });
  });

  describe('Quality Optimization', () => {
    const callId = 'call123';

    it('should optimize for low latency', async () => {
      // Act
      await networkAdaptation.optimizeForLowLatency(callId);

      // Assert
      expect(mockWebrtcManager.adjustVideoQuality).toHaveBeenCalledWith(
        callId,
        expect.objectContaining({
          framerate: expect.any(Number),
          bitrate: expect.any(Number),
        })
      );
    });

    it('should optimize for high quality', async () => {
      // Act
      await networkAdaptation.optimizeForHighQuality(callId);

      // Assert
      expect(mockWebrtcManager.adjustVideoQuality).toHaveBeenCalledWith(
        callId,
        expect.objectContaining({
          width: 1920,
          height: 1080,
        })
      );
    });

    it('should optimize for battery saving', async () => {
      // Act
      await networkAdaptation.optimizeForBatterySaving(callId);

      // Assert
      expect(mockWebrtcManager.adjustVideoQuality).toHaveBeenCalledWith(
        callId,
        expect.objectContaining({
          framerate: 15,
          bitrate: expect.any(Number),
        })
      );
    });
  });

  describe('Network Diagnostics', () => {
    it('should run network diagnostics', async () => {
      // Act
      const diagnostics = await networkAdaptation.runNetworkDiagnostics();

      // Assert
      expect(diagnostics).toEqual({
        timestamp: expect.any(Number),
        networkQuality: expect.any(String),
        bandwidth: expect.any(Number),
        latency: expect.any(Number),
        packetLoss: expect.any(Number),
        jitter: expect.any(Number),
        connectionType: expect.any(String),
        recommendations: expect.any(Array),
        issues: expect.any(Array),
      });
    });

    it('should provide network recommendations', () => {
      // Arrange
      const quality = 'poor';

      // Act
      const recommendations = networkAdaptation.getNetworkRecommendations(quality);

      // Assert
      expect(recommendations).toContain('降低视频质量以改善连接稳定性');
      expect(recommendations).toContain('检查网络连接状态');
    });

    it('should detect network issues', async () => {
      // Arrange
      const metrics = {
        bandwidth: 50,
        latency: 800,
        packetLoss: 0.2,
        jitter: 100,
      };

      // Act
      const issues = networkAdaptation.detectNetworkIssues(metrics);

      // Assert
      expect(issues).toContainEqual(
        expect.objectContaining({
          type: 'low_bandwidth',
          severity: 'high',
        })
      );
      expect(issues).toContainEqual(
        expect.objectContaining({
          type: 'high_latency',
          severity: 'high',
        })
      );
    });
  });

  describe('Event Handling', () => {
    it('should handle connection state changes', async () => {
      // Arrange
      const callback = vi.fn();
      networkAdaptation.onConnectionStateChange(callback);

      // Act
      (networkAdaptation as any).handleConnectionStateChange('call123', 'disconnected');

      // Assert
      expect(callback).toHaveBeenCalledWith('call123', 'disconnected');
    });

    it('should handle bandwidth changes', async () => {
      // Arrange
      const callback = vi.fn();
      networkAdaptation.onBandwidthChange(callback);

      // Act
      (networkAdaptation as any).handleBandwidthChange('call123', 500);

      // Assert
      expect(callback).toHaveBeenCalledWith('call123', 500);
    });

    it('should handle quality degradation events', async () => {
      // Arrange
      const callback = vi.fn();
      networkAdaptation.onQualityDegradation(callback);

      // Act
      (networkAdaptation as any).handleQualityDegradation('call123', {
        from: 'good',
        to: 'poor',
        reason: 'bandwidth_drop',
      });

      // Assert
      expect(callback).toHaveBeenCalledWith('call123', {
        from: 'good',
        to: 'poor',
        reason: 'bandwidth_drop',
      });
    });
  });

  describe('Configuration and Settings', () => {
    it('should update adaptation settings', () => {
      // Arrange
      const settings = {
        enableAutoAdjustment: true,
        qualityThresholds: {
          excellent: 2000,
          good: 1000,
          fair: 500,
          poor: 200,
        },
        adaptationSensitivity: 'medium' as const,
      };

      // Act
      networkAdaptation.updateSettings(settings);

      // Assert
      const currentSettings = (networkAdaptation as any).settings;
      expect(currentSettings.enableAutoAdjustment).toBe(true);
      expect(currentSettings.adaptationSensitivity).toBe('medium');
    });

    it('should get current adaptation settings', () => {
      // Act
      const settings = networkAdaptation.getSettings();

      // Assert
      expect(settings).toEqual({
        enableAutoAdjustment: expect.any(Boolean),
        qualityThresholds: expect.any(Object),
        adaptationSensitivity: expect.any(String),
        monitoringInterval: expect.any(Number),
        historySize: expect.any(Number),
      });
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should cleanup monitoring resources', async () => {
      // Arrange
      const callId = 'call123';
      await networkAdaptation.startNetworkMonitoring(callId);

      // Act
      await networkAdaptation.cleanup(callId);

      // Assert
      expect((networkAdaptation as any).monitoringCallIds.has(callId)).toBe(false);
      expect((networkAdaptation as any).qualityHistory.has(callId)).toBe(false);
    });

    it('should cleanup all resources on destroy', async () => {
      // Arrange
      await networkAdaptation.startNetworkMonitoring('call1');
      await networkAdaptation.startNetworkMonitoring('call2');

      // Act
      await networkAdaptation.destroy();

      // Assert
      expect((networkAdaptation as any).monitoringCallIds.size).toBe(0);
      expect((networkAdaptation as any).qualityHistory.size).toBe(0);
    });
  });
});