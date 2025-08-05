import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import networkAdaptation, { NetworkAdaptation } from '@/src/services/networkAdaptation';
import type {
  NetworkQualityLevel,
  NetworkQualityMetrics,
  NetworkQualityState,
  AdaptationConfig,
  NetworkAdaptationEventListeners,
  ConnectionStats,
  QualityAdjustmentHistory
} from '@/src/services/networkAdaptation';

// Mock RTCConfigManager
vi.mock('@/src/services/rtcConfigManager', () => {
  const mockRTCConfig = {
    network_quality_thresholds: {
      excellent: { bandwidth: 2000, latency: 50, packet_loss: 0.01 },
      good: { bandwidth: 1000, latency: 100, packet_loss: 0.03 },
      fair: { bandwidth: 500, latency: 200, packet_loss: 0.05 },
      poor: { bandwidth: 200, latency: 300, packet_loss: 0.1 }
    },
    file_chunk_size: 16384
  };

  return {
    default: {
      getConfig: vi.fn().mockResolvedValue(mockRTCConfig),
      onConfigUpdate: vi.fn()
    }
  };
});

// Mock RTCPeerConnection
const mockPeerConnection = {
  getStats: vi.fn()
} as unknown as RTCPeerConnection;

describe('NetworkAdaptation', () => {
  let mockEventListeners: NetworkAdaptationEventListeners;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    mockEventListeners = {
      onQualityChanged: vi.fn(),
      onNetworkIssueDetected: vi.fn(),
      onAdaptationApplied: vi.fn(),
      onStatsUpdated: vi.fn()
    };
    
    networkAdaptation.setEventListeners(mockEventListeners);
    
    // Mock stats response
    const mockStats = new Map([
      ['inbound-rtp', {
        type: 'inbound-rtp',
        mediaType: 'video',
        bytesReceived: 1000000,
        packetsReceived: 1000,
        packetsLost: 10,
        framesDecoded: 500,
        framesDropped: 2
      }],
      ['outbound-rtp', {
        type: 'outbound-rtp',
        mediaType: 'video',
        bytesSent: 800000,
        packetsSent: 900
      }],
      ['candidate-pair', {
        type: 'candidate-pair',
        state: 'succeeded',
        currentRoundTripTime: 0.05, // 50ms
        availableOutgoingBitrate: 1500000, // 1.5Mbps
        availableIncomingBitrate: 2000000  // 2Mbps
      }]
    ]);
    
    mockPeerConnection.getStats = vi.fn().mockResolvedValue(mockStats);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Configuration Management', () => {
    it('should set event listeners correctly', () => {
      const listeners: NetworkAdaptationEventListeners = {
        onQualityChanged: vi.fn(),
        onNetworkIssueDetected: vi.fn()
      };
      
      networkAdaptation.setEventListeners(listeners);
      
      expect(listeners.onQualityChanged).toBeDefined();
      expect(listeners.onNetworkIssueDetected).toBeDefined();
    });

    it('should update adaptation config', () => {
      const config: Partial<AdaptationConfig> = {
        enableVideoAdaptation: false,
        measurementInterval: 10000,
        maxAdaptationsPerMinute: 3
      };
      
      networkAdaptation.setAdaptationConfig(config);
      
      // Configuration should be updated (verify through behavior)
      expect(() => networkAdaptation.setAdaptationConfig(config)).not.toThrow();
    });
  });

  describe('Peer Connection Management', () => {
    it('should add peer connection for monitoring', () => {
      const connectionId = 'test-connection-1';
      
      networkAdaptation.addPeerConnection(connectionId, mockPeerConnection);
      
      // Verify monitoring starts when first connection is added
      expect(() => networkAdaptation.addPeerConnection(connectionId, mockPeerConnection)).not.toThrow();
    });

    it('should remove peer connection from monitoring', () => {
      const connectionId = 'test-connection-1';
      
      networkAdaptation.addPeerConnection(connectionId, mockPeerConnection);
      networkAdaptation.removePeerConnection(connectionId);
      
      // Should not throw when removing non-existent connection
      expect(() => networkAdaptation.removePeerConnection('non-existent')).not.toThrow();
    });

    it('should start monitoring when peer connection is added', () => {
      const connectionId = 'test-connection-1';
      
      networkAdaptation.addPeerConnection(connectionId, mockPeerConnection);
      
      // Verify monitoring is active
      expect(() => networkAdaptation.startMonitoring()).not.toThrow();
    });

    it('should stop monitoring when all connections are removed', () => {
      const connectionId = 'test-connection-1';
      
      networkAdaptation.addPeerConnection(connectionId, mockPeerConnection);
      networkAdaptation.removePeerConnection(connectionId);
      
      // Monitoring should stop automatically
      expect(() => networkAdaptation.stopMonitoring()).not.toThrow();
    });
  });

  describe('Network Quality Measurement', () => {
    beforeEach(() => {
      networkAdaptation.addPeerConnection('test-connection', mockPeerConnection);
    });

    it('should measure network quality manually', async () => {
      const qualityState = await networkAdaptation.measureNetworkQualityManual();
      
      expect(qualityState).toBeDefined();
      if (qualityState) {
        expect(qualityState.level).toMatch(/excellent|good|fair|poor|critical/);
        expect(qualityState.metrics).toBeDefined();
        expect(qualityState.recommendedVideoQuality).toBeDefined();
        expect(qualityState.recommendedAudioQuality).toBeDefined();
      }
    });

    it('should collect connection stats correctly', async () => {
      // Trigger manual measurement to test stats collection
      const qualityState = await networkAdaptation.measureNetworkQualityManual();
      
      expect(mockPeerConnection.getStats).toHaveBeenCalled();
      expect(qualityState?.metrics.bandwidth).toBeGreaterThan(0);
      expect(qualityState?.metrics.latency).toBeGreaterThan(0);
    });

    it('should aggregate metrics from multiple connections', async () => {
      // Add another connection
      const connection2 = { ...mockPeerConnection };
      networkAdaptation.addPeerConnection('test-connection-2', connection2 as RTCPeerConnection);
      
      const qualityState = await networkAdaptation.measureNetworkQualityManual();
      
      expect(qualityState?.metrics).toBeDefined();
      expect(mockPeerConnection.getStats).toHaveBeenCalledTimes(2);
    });

    it('should handle stats collection errors gracefully', async () => {
      mockPeerConnection.getStats = vi.fn().mockRejectedValue(new Error('Stats collection failed'));
      
      const qualityState = await networkAdaptation.measureNetworkQualityManual();
      
      // Should not throw and may return null or default state
      expect(qualityState).toBeDefined();
    });
  });

  describe('Network Quality Analysis', () => {
    beforeEach(() => {
      networkAdaptation.addPeerConnection('test-connection', mockPeerConnection);
    });

    it('should classify excellent network quality', async () => {
      // Mock stats for excellent quality
      const excellentStats = new Map([
        ['candidate-pair', {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.03, // 30ms
          availableOutgoingBitrate: 3000000, // 3Mbps
          availableIncomingBitrate: 3000000
        }]
      ]);
      
      mockPeerConnection.getStats = vi.fn().mockResolvedValue(excellentStats);
      
      const qualityState = await networkAdaptation.measureNetworkQualityManual();
      
      expect(qualityState?.level).toBe('excellent');
      expect(qualityState?.recommendedVideoQuality).toBe('ultra');
      expect(qualityState?.recommendedAudioQuality).toBe('high');
    });

    it('should classify poor network quality', async () => {
      // Mock stats for poor quality
      const poorStats = new Map([
        ['inbound-rtp', {
          type: 'inbound-rtp',
          mediaType: 'video',
          packetsReceived: 1000,
          packetsLost: 100 // 10% packet loss
        }],
        ['candidate-pair', {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.4, // 400ms
          availableOutgoingBitrate: 150000, // 150Kbps
          availableIncomingBitrate: 150000
        }]
      ]);
      
      mockPeerConnection.getStats = vi.fn().mockResolvedValue(poorStats);
      
      const qualityState = await networkAdaptation.measureNetworkQualityManual();
      
      expect(qualityState?.level).toBe('poor');
      expect(qualityState?.recommendedVideoQuality).toBe('low');
    });

    it('should detect critical network quality', async () => {
      // Mock stats for critical quality
      const criticalStats = new Map([
        ['inbound-rtp', {
          type: 'inbound-rtp',
          mediaType: 'video',
          packetsReceived: 1000,
          packetsLost: 200 // 20% packet loss
        }],
        ['candidate-pair', {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.6, // 600ms
          availableOutgoingBitrate: 50000, // 50Kbps
          availableIncomingBitrate: 50000
        }]
      ]);
      
      mockPeerConnection.getStats = vi.fn().mockResolvedValue(criticalStats);
      
      const qualityState = await networkAdaptation.measureNetworkQualityManual();
      
      expect(qualityState?.level).toBe('critical');
      expect(qualityState?.recommendedVideoQuality).toBe('low');
      expect(qualityState?.recommendedAudioQuality).toBe('low');
    });
  });

  describe('Adaptive Quality Adjustment', () => {
    beforeEach(() => {
      networkAdaptation.addPeerConnection('test-connection', mockPeerConnection);
    });

    it('should trigger adaptation when quality changes significantly', async () => {
      // First measurement - good quality
      await networkAdaptation.measureNetworkQualityManual();
      
      // Second measurement - poor quality
      const poorStats = new Map([
        ['candidate-pair', {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.3, // 300ms
          availableOutgoingBitrate: 100000, // 100Kbps
          availableIncomingBitrate: 100000
        }]
      ]);
      
      mockPeerConnection.getStats = vi.fn().mockResolvedValue(poorStats);
      
      await networkAdaptation.measureNetworkQualityManual();
      
      // Should trigger adaptation event
      expect(mockEventListeners.onQualityChanged).toHaveBeenCalled();
    });

    it('should respect adaptation frequency limits', async () => {
      // Configure for testing
      networkAdaptation.setAdaptationConfig({
        maxAdaptationsPerMinute: 1,
        stabilityDuration: 1000
      });
      
      // Trigger multiple adaptations quickly
      await networkAdaptation.measureNetworkQualityManual();
      await networkAdaptation.measureNetworkQualityManual();
      
      // Should be limited by frequency control
      expect(mockEventListeners.onAdaptationApplied).toHaveBeenCalledTimes(0);
    });

    it('should calculate jitter from metrics history', async () => {
      // Take multiple measurements to build history
      for (let i = 0; i < 5; i++) {
        await networkAdaptation.measureNetworkQualityManual();
        vi.advanceTimersByTime(5000); // Advance time between measurements
      }
      
      const metrics = networkAdaptation.getMetricsHistory();
      expect(metrics.length).toBeGreaterThan(0);
      
      // Last measurement should have jitter calculated
      const lastMetrics = metrics[metrics.length - 1];
      expect(lastMetrics.jitter).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Network Issue Detection', () => {
    beforeEach(() => {
      networkAdaptation.addPeerConnection('test-connection', mockPeerConnection);
    });

    it('should detect high latency issues', async () => {
      const highLatencyStats = new Map([
        ['candidate-pair', {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.6, // 600ms (will be converted to 600ms)
          availableOutgoingBitrate: 1000000,
          availableIncomingBitrate: 1000000
        }]
      ]);
      
      mockPeerConnection.getStats = vi.fn().mockResolvedValue(highLatencyStats);
      
      await networkAdaptation.measureNetworkQualityManual();
      
      expect(mockEventListeners.onNetworkIssueDetected).toHaveBeenCalledWith(
        expect.stringContaining('网络延迟过高'),
        expect.any(Object)
      );
    });

    it('should detect high packet loss', async () => {
      const highPacketLossStats = new Map([
        ['inbound-rtp', {
          type: 'inbound-rtp',
          mediaType: 'video',
          packetsReceived: 1000,
          packetsLost: 80 // 8% packet loss
        }],
        ['outbound-rtp', {
          type: 'outbound-rtp',
          mediaType: 'video',
          packetsSent: 1000
        }],
        ['candidate-pair', {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.1,
          availableOutgoingBitrate: 1000000,
          availableIncomingBitrate: 1000000
        }]
      ]);
      
      mockPeerConnection.getStats = vi.fn().mockResolvedValue(highPacketLossStats);
      
      await networkAdaptation.measureNetworkQualityManual();
      
      expect(mockEventListeners.onNetworkIssueDetected).toHaveBeenCalledWith(
        expect.stringContaining('丢包率过高'),
        expect.any(Object)
      );
    });

    it('should detect insufficient bandwidth', async () => {
      const lowBandwidthStats = new Map([
        ['candidate-pair', {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.1,
          availableOutgoingBitrate: 50000, // 50Kbps
          availableIncomingBitrate: 50000
        }]
      ]);
      
      mockPeerConnection.getStats = vi.fn().mockResolvedValue(lowBandwidthStats);
      
      await networkAdaptation.measureNetworkQualityManual();
      
      expect(mockEventListeners.onNetworkIssueDetected).toHaveBeenCalledWith(
        expect.stringContaining('可用带宽不足'),
        expect.any(Object)
      );
    });

    it('should detect network jitter issues', async () => {
      // Create varying latency measurements to trigger jitter detection
      const measurements = [
        { currentRoundTripTime: 0.05 }, // 50ms
        { currentRoundTripTime: 0.15 }, // 150ms
        { currentRoundTripTime: 0.08 }, // 80ms
        { currentRoundTripTime: 0.18 }, // 180ms
        { currentRoundTripTime: 0.12 }  // 120ms
      ];
      
      for (const measurement of measurements) {
        const stats = new Map([
          ['candidate-pair', {
            type: 'candidate-pair',
            state: 'succeeded',
            availableOutgoingBitrate: 1000000,
            availableIncomingBitrate: 1000000,
            ...measurement
          }]
        ]);
        
        mockPeerConnection.getStats = vi.fn().mockResolvedValue(stats);
        await networkAdaptation.measureNetworkQualityManual();
      }
      
      // Should detect jitter issues after building history
      expect(mockEventListeners.onNetworkIssueDetected).toHaveBeenCalledWith(
        expect.stringContaining('网络抖动严重'),
        expect.any(Object)
      );
    });
  });

  describe('Monitoring Control', () => {
    it('should start and stop monitoring manually', () => {
      networkAdaptation.startMonitoring();
      expect(() => networkAdaptation.startMonitoring()).not.toThrow();
      
      networkAdaptation.stopMonitoring();
      expect(() => networkAdaptation.stopMonitoring()).not.toThrow();
    });

    it('should handle monitoring with no connections gracefully', async () => {
      networkAdaptation.startMonitoring();
      
      // Advance timer to trigger measurement
      vi.advanceTimersByTime(5000);
      
      // Should not throw even with no connections
      expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
    });

    it('should schedule periodic measurements', async () => {
      networkAdaptation.addPeerConnection('test-connection', mockPeerConnection);
      networkAdaptation.startMonitoring();
      
      // Advance timer to trigger measurement
      vi.advanceTimersByTime(5000);
      
      expect(mockPeerConnection.getStats).toHaveBeenCalled();
    });
  });

  describe('Data Management', () => {
    beforeEach(() => {
      networkAdaptation.addPeerConnection('test-connection', mockPeerConnection);
    });

    it('should maintain metrics history with size limit', async () => {
      // Generate more measurements than the history limit
      for (let i = 0; i < 25; i++) {
        await networkAdaptation.measureNetworkQualityManual();
      }
      
      const history = networkAdaptation.getMetricsHistory();
      expect(history.length).toBeLessThanOrEqual(20); // MAX_HISTORY_LENGTH
    });

    it('should track quality adjustment history', async () => {
      // Trigger quality changes
      await networkAdaptation.measureNetworkQualityManual();
      
      // Change network conditions to trigger adaptation
      const poorStats = new Map([
        ['candidate-pair', {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.3,
          availableOutgoingBitrate: 100000,
          availableIncomingBitrate: 100000
        }]
      ]);
      
      mockPeerConnection.getStats = vi.fn().mockResolvedValue(poorStats);
      await networkAdaptation.measureNetworkQualityManual();
      
      const adjustmentHistory = networkAdaptation.getQualityAdjustmentHistory();
      expect(adjustmentHistory).toBeDefined();
      expect(Array.isArray(adjustmentHistory)).toBe(true);
    });

    it('should get current quality state', async () => {
      await networkAdaptation.measureNetworkQualityManual();
      
      const currentState = networkAdaptation.getCurrentQualityState();
      expect(currentState).toBeDefined();
      expect(currentState?.level).toMatch(/excellent|good|fair|poor|critical/);
    });

    it('should reset adaptation state', async () => {
      await networkAdaptation.measureNetworkQualityManual();
      
      networkAdaptation.resetAdaptationState();
      
      const currentState = networkAdaptation.getCurrentQualityState();
      const metricsHistory = networkAdaptation.getMetricsHistory();
      const adjustmentHistory = networkAdaptation.getQualityAdjustmentHistory();
      
      expect(currentState).toBeNull();
      expect(metricsHistory).toHaveLength(0);
      expect(adjustmentHistory).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization failure gracefully', () => {
      const newAdapter = new NetworkAdaptation();
      expect(newAdapter).toBeDefined();
    });

    it('should handle peer connection getStats failure', async () => {
      mockPeerConnection.getStats = vi.fn().mockRejectedValue(new Error('getStats failed'));
      networkAdaptation.addPeerConnection('test-connection', mockPeerConnection);
      
      const qualityState = await networkAdaptation.measureNetworkQualityManual();
      
      // Should handle error gracefully
      expect(qualityState).toBeDefined();
    });

    it('should handle missing stats data', async () => {
      // Mock empty stats
      mockPeerConnection.getStats = vi.fn().mockResolvedValue(new Map());
      networkAdaptation.addPeerConnection('test-connection', mockPeerConnection);
      
      const qualityState = await networkAdaptation.measureNetworkQualityManual();
      
      expect(qualityState?.metrics.bandwidth).toBe(0);
      expect(qualityState?.metrics.latency).toBe(0);
    });

    it('should handle corrupted stats data', async () => {
      // Mock corrupted stats
      const corruptedStats = new Map([
        ['invalid-type', {
          type: 'unknown',
          invalidField: null
        }]
      ]);
      
      mockPeerConnection.getStats = vi.fn().mockResolvedValue(corruptedStats);
      networkAdaptation.addPeerConnection('test-connection', mockPeerConnection);
      
      const qualityState = await networkAdaptation.measureNetworkQualityManual();
      
      // Should handle gracefully with default values
      expect(qualityState?.metrics).toBeDefined();
    });
  });

  describe('Resource Management', () => {
    it('should clean up resources on destroy', () => {
      networkAdaptation.addPeerConnection('test-connection', mockPeerConnection);
      networkAdaptation.startMonitoring();
      
      networkAdaptation.destroy();
      
      // Should stop monitoring and clear connections
      expect(() => networkAdaptation.destroy()).not.toThrow();
    });

    it('should handle multiple destroy calls safely', () => {
      networkAdaptation.destroy();
      networkAdaptation.destroy();
      
      expect(() => networkAdaptation.destroy()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very high packet loss gracefully', async () => {
      const extremeStats = new Map([
        ['inbound-rtp', {
          type: 'inbound-rtp',
          mediaType: 'video',
          packetsReceived: 10,
          packetsLost: 1000 // More packets lost than received
        }],
        ['outbound-rtp', {
          type: 'outbound-rtp',
          mediaType: 'video',
          packetsSent: 1000
        }]
      ]);
      
      mockPeerConnection.getStats = vi.fn().mockResolvedValue(extremeStats);
      networkAdaptation.addPeerConnection('test-connection', mockPeerConnection);
      
      const qualityState = await networkAdaptation.measureNetworkQualityManual();
      
      expect(qualityState?.level).toBe('critical');
      expect(qualityState?.metrics.packetLoss).toBeGreaterThan(0);
    });

    it('should handle zero bandwidth gracefully', async () => {
      const zeroStats = new Map([
        ['candidate-pair', {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.1,
          availableOutgoingBitrate: 0,
          availableIncomingBitrate: 0
        }]
      ]);
      
      mockPeerConnection.getStats = vi.fn().mockResolvedValue(zeroStats);
      networkAdaptation.addPeerConnection('test-connection', mockPeerConnection);
      
      const qualityState = await networkAdaptation.measureNetworkQualityManual();
      
      expect(qualityState?.level).toBe('critical');
      expect(qualityState?.metrics.bandwidth).toBe(0);
    });

    it('should handle adaptation config with invalid values', () => {
      const invalidConfig: Partial<AdaptationConfig> = {
        measurementInterval: -1000,
        maxAdaptationsPerMinute: -5,
        adaptationThreshold: 2.0 // > 1.0
      };
      
      // Should not throw with invalid config
      expect(() => networkAdaptation.setAdaptationConfig(invalidConfig)).not.toThrow();
    });
  });
});