import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import signalingService, { 
  SignalType, 
  type OfferSignalData, 
  type AnswerSignalData,
  type IceCandidateSignalData,
  type CallRequestSignalData,
  type CallResponseSignalData,
  type GroupCallSignalData,
  type SignalingEventListeners
} from '../../../src/services/signalingService';

// Mock SurrealProvider
const mockClient = {
  create: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  query: vi.fn(),
  live: vi.fn(),
  kill: vi.fn(),
};

vi.mock('../../../src/contexts/SurrealProvider', () => ({
  useSurrealClientSingleton: vi.fn(() => mockClient),
  TenantCodeMissingError: class extends Error {},
}));

describe('SignalingService', () => {
  const mockUserId = 'user:123';
  const mockTargetUserId = 'user:456';
  const mockGroupId = 'group:789';
  const mockCallId = 'call:123';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    signalingService.setClientGetter(async () => mockClient as any);
    
    mockClient.create.mockResolvedValue([{ id: 'signal:123' }]);
    mockClient.select.mockResolvedValue([]);
    mockClient.update.mockResolvedValue([]);
    mockClient.delete.mockResolvedValue([]);
    mockClient.query.mockResolvedValue([]);
    mockClient.live.mockResolvedValue('live-query-uuid');
    mockClient.kill.mockResolvedValue(undefined);
    
    // Reset service state
    (signalingService as any).currentUserId = null;
    (signalingService as any)._isConnected = false;
    (signalingService as any).liveQueryUuids = [];
    (signalingService as any).listeners = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      // Act
      await signalingService.initialize(mockUserId);

      // Assert
      expect(signalingService.isConnected()).toBe(true);
      expect(mockClient.live).toHaveBeenCalledTimes(2); // Private and group signals
    });

    it('should handle initialization failure gracefully', async () => {
      // Arrange
      mockClient.live.mockRejectedValue(new Error('Connection failed'));

      // Act & Assert
      await expect(signalingService.initialize(mockUserId)).rejects.toThrow();
    });
  });

  describe('Event Listeners', () => {
    it('should set event listeners', () => {
      // Arrange
      const listeners: SignalingEventListeners = {
        onOfferReceived: vi.fn(),
        onAnswerReceived: vi.fn(),
        onIceCandidateReceived: vi.fn(),
      };

      // Act
      signalingService.setEventListeners(listeners);

      // Assert - This tests that the method doesn't throw
      expect(() => signalingService.setEventListeners(listeners)).not.toThrow();
    });
  });

  describe('Offer Handling', () => {
    beforeEach(async () => {
      await signalingService.initialize(mockUserId);
    });

    it('should send offer successfully', async () => {
      // Arrange
      const offerData: OfferSignalData = {
        type: 'offer',
        sdp: 'offer-sdp-content',
        constraints: { audio: true, video: true },
      };

      // Act
      await signalingService.sendOffer(mockTargetUserId, offerData, mockCallId);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webrtc_signal'),
        expect.objectContaining({
          signal_type: SignalType.OFFER,
          from_user: mockUserId,
          to_user: mockTargetUserId,
          signal_data: offerData,
          call_id: mockCallId,
        })
      );
    });

    it('should handle offer sending failure', async () => {
      // Arrange
      mockClient.query.mockRejectedValue(new Error('Database error'));
      const offerData: OfferSignalData = { type: 'offer', sdp: 'offer-sdp' };

      // Act & Assert
      await expect(
        signalingService.sendOffer(mockTargetUserId, offerData)
      ).rejects.toThrow('Database error');
    });
  });

  describe('Answer Handling', () => {
    beforeEach(async () => {
      await signalingService.initialize(mockUserId);
    });

    it('should send answer successfully', async () => {
      // Arrange
      const answerData: AnswerSignalData = {
        type: 'answer',
        sdp: 'answer-sdp-content',
      };

      // Act
      await signalingService.sendAnswer(mockTargetUserId, answerData, mockCallId);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webrtc_signal'),
        expect.objectContaining({
          signal_type: SignalType.ANSWER,
          from_user: mockUserId,
          to_user: mockTargetUserId,
          signal_data: answerData,
          call_id: mockCallId,
        })
      );
    });
  });

  describe('ICE Candidate Handling', () => {
    beforeEach(async () => {
      await signalingService.initialize(mockUserId);
    });

    it('should send ICE candidate successfully', async () => {
      // Arrange
      const candidateData: IceCandidateSignalData = {
        candidate: 'candidate:123 1 UDP 2113667326 192.168.1.100 54400 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
        usernameFragment: 'test',
      };

      // Act
      await signalingService.sendIceCandidate(mockTargetUserId, candidateData, mockCallId);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webrtc_signal'),
        expect.objectContaining({
          signal_type: SignalType.ICE_CANDIDATE,
          from_user: mockUserId,
          to_user: mockTargetUserId,
          signal_data: candidateData,
          call_id: mockCallId,
        })
      );
    });
  });

  describe('Call Request Handling', () => {
    beforeEach(async () => {
      await signalingService.initialize(mockUserId);
    });

    it('should send call request successfully', async () => {
      // Arrange
      const callRequestData: CallRequestSignalData = {
        callType: 'audio',
        callId: mockCallId,
        initiatorName: 'Test User',
        constraints: { audio: true, video: false },
      };

      // Act
      await signalingService.sendCallRequest(mockTargetUserId, callRequestData);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webrtc_signal'),
        expect.objectContaining({
          signal_type: SignalType.CALL_REQUEST,
          from_user: mockUserId,
          to_user: mockTargetUserId,
          signal_data: callRequestData,
        })
      );
    });
  });

  describe('Call Response Handling', () => {
    beforeEach(async () => {
      await signalingService.initialize(mockUserId);
    });

    it('should send call accept successfully', async () => {
      // Arrange
      const responseData: CallResponseSignalData = {
        callId: mockCallId,
        accepted: true,
      };

      // Act
      await signalingService.sendCallAccept(mockTargetUserId, responseData);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webrtc_signal'),
        expect.objectContaining({
          signal_type: SignalType.CALL_ACCEPT,
          from_user: mockUserId,
          to_user: mockTargetUserId,
          signal_data: responseData,
        })
      );
    });

    it('should send call reject successfully', async () => {
      // Arrange
      const responseData: CallResponseSignalData = {
        callId: mockCallId,
        accepted: false,
        reason: 'User is busy',
      };

      // Act
      await signalingService.sendCallReject(mockTargetUserId, responseData);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webrtc_signal'),
        expect.objectContaining({
          signal_type: SignalType.CALL_REJECT,
          from_user: mockUserId,
          to_user: mockTargetUserId,
          signal_data: responseData,
        })
      );
    });
  });

  describe('Group Call Handling', () => {
    beforeEach(async () => {
      await signalingService.initialize(mockUserId);
    });

    it('should send group call request successfully', async () => {
      // Arrange
      const groupCallData: GroupCallSignalData = {
        callId: mockCallId,
        callType: 'video',
        groupName: 'Test Group',
        initiatorName: 'Test User',
        participants: ['user:456', 'user:789'],
      };

      // Act
      await signalingService.sendGroupCallRequest(mockGroupId, groupCallData);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webrtc_signal'),
        expect.objectContaining({
          signal_type: SignalType.GROUP_CALL_REQUEST,
          from_user: mockUserId,
          group_id: mockGroupId,
          signal_data: groupCallData,
        })
      );
    });

    it('should send group call join successfully', async () => {
      // Arrange
      const groupCallData: GroupCallSignalData = {
        callId: mockCallId,
        callType: 'video',
        groupName: 'Test Group',
        initiatorName: 'Test User',
      };

      // Act
      await signalingService.sendGroupCallJoin(mockGroupId, groupCallData);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webrtc_signal'),
        expect.objectContaining({
          signal_type: SignalType.GROUP_CALL_JOIN,
          from_user: mockUserId,
          group_id: mockGroupId,
          signal_data: groupCallData,
        })
      );
    });

    it('should send group call leave successfully', async () => {
      // Arrange
      const groupCallData: GroupCallSignalData = {
        callId: mockCallId,
        callType: 'video',
        groupName: 'Test Group',
        initiatorName: 'Test User',
      };

      // Act
      await signalingService.sendGroupCallLeave(mockGroupId, groupCallData);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webrtc_signal'),
        expect.objectContaining({
          signal_type: SignalType.GROUP_CALL_LEAVE,
          from_user: mockUserId,
          group_id: mockGroupId,
          signal_data: groupCallData,
        })
      );
    });
  });

  describe('Signal History', () => {
    beforeEach(async () => {
      await signalingService.initialize(mockUserId);
    });

    it('should get signal history successfully', async () => {
      // Arrange
      const mockHistory = [
        {
          id: 'signal:1',
          signal_type: SignalType.OFFER,
          from_user: mockTargetUserId,
          to_user: mockUserId,
          signal_data: { type: 'offer', sdp: 'test-sdp' },
          created_at: '2023-01-01T00:00:00Z',
        },
      ];
      mockClient.query.mockResolvedValue([mockHistory]);

      // Act
      const result = await signalingService.getSignalHistory(mockTargetUserId);

      // Assert
      expect(result).toEqual(mockHistory);
      expect(mockClient.query).toHaveBeenCalled();
    });

    it('should get group signal history successfully', async () => {
      // Arrange
      const mockHistory = [
        {
          id: 'signal:1',
          signal_type: SignalType.GROUP_CALL_REQUEST,
          from_user: mockUserId,
          group_id: mockGroupId,
          signal_data: { callType: 'video' },
          created_at: '2023-01-01T00:00:00Z',
        },
      ];
      mockClient.query.mockResolvedValue([mockHistory]);

      // Act
      const result = await signalingService.getSignalHistory(undefined, mockGroupId);

      // Assert
      expect(result).toEqual(mockHistory);
      expect(mockClient.query).toHaveBeenCalled();
    });
  });

  describe('Cleanup and Maintenance', () => {
    beforeEach(async () => {
      await signalingService.initialize(mockUserId);
    });

    it('should cleanup expired signals', async () => {
      // Act
      await signalingService.cleanupExpiredSignals();

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE webrtc_signal WHERE')
      );
    });

    it('should reconnect successfully', async () => {
      // Act
      await signalingService.reconnect();

      // Assert
      expect(signalingService.isConnected()).toBe(true);
    });

    it('should destroy service and cleanup resources', async () => {
      // Act
      await signalingService.destroy();

      // Assert
      expect(mockClient.kill).toHaveBeenCalled();
    });
  });

  describe('Conference and Group Signaling', () => {
    beforeEach(async () => {
      await signalingService.initialize(mockUserId);
    });

    it('should send conference invite successfully', async () => {
      // Arrange
      const conferenceData = {
        conferenceId: 'conf123',
        conferenceName: 'Team Meeting',
        participants: ['user:456', 'user:789'],
        startTime: '2023-01-01T10:00:00Z',
      };

      // Act
      await signalingService.sendConferenceInvite(mockTargetUserId, conferenceData);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webrtc_signal'),
        expect.objectContaining({
          signal_type: SignalType.CONFERENCE_INVITE,
          from_user: mockUserId,
          to_user: mockTargetUserId,
          signal_data: conferenceData,
        })
      );
    });

    it('should handle group call with multiple participants', async () => {
      // Arrange
      const groupCallData: GroupCallSignalData = {
        callId: mockCallId,
        callType: 'video',
        groupName: 'Project Team',
        initiatorName: 'Test User',
        participants: ['user:456', 'user:789', 'user:101'],
      };

      // Act
      await signalingService.sendGroupCallRequest(mockGroupId, groupCallData);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webrtc_signal'),
        expect.objectContaining({
          signal_type: SignalType.GROUP_CALL_REQUEST,
          from_user: mockUserId,
          group_id: mockGroupId,
          signal_data: expect.objectContaining({
            participants: expect.arrayContaining(['user:456', 'user:789', 'user:101']),
          }),
        })
      );
    });

    it('should handle group call participant management', async () => {
      // Arrange
      const participantData = {
        callId: mockCallId,
        callType: 'video' as const,
        groupName: 'Project Team',
        initiatorName: 'Test User',
        action: 'participant_muted',
        targetParticipant: 'user:456',
      };

      // Act
      await signalingService.sendGroupSignal(
        SignalType.GROUP_CALL_JOIN, 
        participantData, 
        mockGroupId, 
        mockCallId
      );

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webrtc_signal'),
        expect.objectContaining({
          signal_type: SignalType.GROUP_CALL_JOIN,
          group_id: mockGroupId,
          signal_data: expect.objectContaining({
            action: 'participant_muted',
            targetParticipant: 'user:456',
          }),
        })
      );
    });
  });

  describe('Signal Processing and Filtering', () => {
    beforeEach(async () => {
      await signalingService.initialize(mockUserId);
    });

    it('should filter signals by call ID', async () => {
      // Arrange
      const callId = 'specific-call-123';
      mockClient.query.mockResolvedValue([[
        {
          id: 'signal:1',
          signal_type: SignalType.OFFER,
          call_id: callId,
          from_user: mockTargetUserId,
          created_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'signal:2',
          signal_type: SignalType.ANSWER,
          call_id: 'other-call-456',
          from_user: mockTargetUserId,
          created_at: '2023-01-01T00:01:00Z',
        },
      ]]);

      // Act
      const result = await signalingService.getSignalHistoryByCallId(callId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].call_id).toBe(callId);
    });

    it('should get signals within time range', async () => {
      // Arrange
      const startTime = '2023-01-01T00:00:00Z';
      const endTime = '2023-01-01T23:59:59Z';
      
      mockClient.query.mockResolvedValue([[
        {
          id: 'signal:1',
          signal_type: SignalType.OFFER,
          created_at: '2023-01-01T12:00:00Z',
        },
      ]]);

      // Act
      const result = await signalingService.getSignalHistoryByTimeRange(startTime, endTime);

      // Assert
      expect(result).toHaveLength(1);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE created_at >= $start_time AND created_at <= $end_time'),
        expect.objectContaining({
          start_time: startTime,
          end_time: endTime,
        })
      );
    });

    it('should batch process multiple signals', async () => {
      // Arrange
      const signals = [
        { type: SignalType.OFFER, data: { sdp: 'offer1' }, targetUserId: 'user:1' },
        { type: SignalType.ANSWER, data: { sdp: 'answer1' }, targetUserId: 'user:2' },
        { type: SignalType.ICE_CANDIDATE, data: { candidate: 'candidate1' }, targetUserId: 'user:3' },
      ];

      // Act
      await signalingService.batchSendSignals(signals);

      // Assert
      expect(mockClient.query).toHaveBeenCalledTimes(signals.length);
    });
  });

  describe('Signal Reliability and Retry', () => {
    beforeEach(async () => {
      await signalingService.initialize(mockUserId);
    });

    it('should retry failed signal sending', async () => {
      // Arrange
      const offerData: OfferSignalData = {
        type: 'offer',
        sdp: 'test-offer-sdp',
      };
      
      mockClient.query
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([{ id: 'signal:123' }]);

      // Act
      await signalingService.sendOfferWithRetry(mockTargetUserId, offerData, mockCallId, 3);

      // Assert
      expect(mockClient.query).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      // Arrange
      const offerData: OfferSignalData = {
        type: 'offer',
        sdp: 'test-offer-sdp',
      };
      
      mockClient.query.mockRejectedValue(new Error('Persistent error'));

      // Act & Assert
      await expect(
        signalingService.sendOfferWithRetry(mockTargetUserId, offerData, mockCallId, 2)
      ).rejects.toThrow('Persistent error');
      
      expect(mockClient.query).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should handle signal acknowledgment', async () => {
      // Arrange
      const signalId = 'signal:123';
      const ackCallback = vi.fn();
      
      signalingService.onSignalAcknowledged(ackCallback);

      // Act
      await signalingService.acknowledgeSignal(signalId);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE webrtc_signal SET acknowledged = true'),
        { signal_id: signalId }
      );
    });
  });

  describe('Status and State', () => {
    beforeEach(async () => {
      await signalingService.initialize(mockUserId);
    });

    it('should return connection status', () => {
      // Act
      const connected = signalingService.isConnected();

      // Assert
      expect(connected).toBe(true);
    });

    it('should return service status', () => {
      // Act
      const status = signalingService.getStatus();

      // Assert
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('userId');
      expect(status).toHaveProperty('activeListeners');
    });

    it('should return detailed service metrics', () => {
      // Act
      const metrics = signalingService.getMetrics();

      // Assert
      expect(metrics).toEqual({
        totalSignalsSent: expect.any(Number),
        totalSignalsReceived: expect.any(Number),
        signalsSentByType: expect.any(Object),
        signalsReceivedByType: expect.any(Object),
        averageSignalLatency: expect.any(Number),
        failedSignals: expect.any(Number),
        retryAttempts: expect.any(Number),
        activeConnections: expect.any(Number),
      });
    });
  });
});
