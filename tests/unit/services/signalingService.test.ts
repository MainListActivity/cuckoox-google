import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import signalingService, { SignalType } from '../../../src/services/signalingService';

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
  const mockUserId = 'user123';
  const mockTargetUserId = 'user456';
  const mockGroupId = 'group789';
  const mockCallId = 'call123';

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
      const listeners = {
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
      const offerData = {
        type: 'offer' as const,
        sdp: 'offer-sdp-content',
        constraints: { audio: true, video: true },
      };

      // Act
      await signalingService.sendOffer(mockTargetUserId, offerData, mockCallId);

      // Assert
      expect(mockClient.create).toHaveBeenCalledWith('webrtc_signal', expect.objectContaining({
        signal_type: SignalType.OFFER,
        from_user: mockUserId,
        to_user: mockTargetUserId,
        signal_data: offerData,
        call_id: mockCallId,
      }));
    });

    it('should handle offer sending failure', async () => {
      // Arrange
      mockClient.create.mockRejectedValue(new Error('Database error'));
      const offerData = { type: 'offer' as const, sdp: 'offer-sdp' };

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
      const answerData = {
        type: 'answer' as const,
        sdp: 'answer-sdp-content',
      };

      // Act
      await signalingService.sendAnswer(mockTargetUserId, answerData, mockCallId);

      // Assert
      expect(mockClient.create).toHaveBeenCalledWith('webrtc_signal', expect.objectContaining({
        signal_type: SignalType.ANSWER,
        from_user: mockUserId,
        to_user: mockTargetUserId,
        signal_data: answerData,
        call_id: mockCallId,
      }));
    });
  });

  describe('ICE Candidate Handling', () => {
    beforeEach(async () => {
      await signalingService.initialize(mockUserId);
    });

    it('should send ICE candidate successfully', async () => {
      // Arrange
      const candidateData = {
        candidate: 'candidate:123 1 UDP 2113667326 192.168.1.100 54400 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
        usernameFragment: 'test',
      };

      // Act
      await signalingService.sendIceCandidate(mockTargetUserId, candidateData, mockCallId);

      // Assert
      expect(mockClient.create).toHaveBeenCalledWith('webrtc_signal', expect.objectContaining({
        signal_type: SignalType.ICE_CANDIDATE,
        from_user: mockUserId,
        to_user: mockTargetUserId,
        signal_data: candidateData,
        call_id: mockCallId,
      }));
    });
  });

  describe('Call Request Handling', () => {
    beforeEach(async () => {
      await signalingService.initialize(mockUserId);
    });

    it('should send call request successfully', async () => {
      // Arrange
      const callRequestData = {
        call_type: 'voice' as const,
        user_id: mockUserId,
        user_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        call_id: mockCallId,
      };

      // Act
      await signalingService.sendCallRequest(mockTargetUserId, callRequestData);

      // Assert
      expect(mockClient.create).toHaveBeenCalledWith('webrtc_signal', expect.objectContaining({
        signal_type: SignalType.CALL_REQUEST,
        from_user: mockUserId,
        to_user: mockTargetUserId,
        signal_data: callRequestData,
      }));
    });
  });

  describe('Call Response Handling', () => {
    beforeEach(async () => {
      await signalingService.initialize(mockUserId);
    });

    it('should send call accept successfully', async () => {
      // Arrange
      const responseData = {
        call_id: mockCallId,
        user_id: mockUserId,
        user_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
      };

      // Act
      await signalingService.sendCallAccept(mockTargetUserId, responseData);

      // Assert
      expect(mockClient.create).toHaveBeenCalledWith('webrtc_signal', expect.objectContaining({
        signal_type: SignalType.CALL_ACCEPT,
        from_user: mockUserId,
        to_user: mockTargetUserId,
        signal_data: responseData,
      }));
    });

    it('should send call reject successfully', async () => {
      // Arrange
      const responseData = {
        call_id: mockCallId,
        user_id: mockUserId,
        user_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
      };

      // Act
      await signalingService.sendCallReject(mockTargetUserId, responseData);

      // Assert
      expect(mockClient.create).toHaveBeenCalledWith('webrtc_signal', expect.objectContaining({
        signal_type: SignalType.CALL_REJECT,
        from_user: mockUserId,
        to_user: mockTargetUserId,
        signal_data: responseData,
      }));
    });
  });

  describe('Group Call Handling', () => {
    beforeEach(async () => {
      await signalingService.initialize(mockUserId);
    });

    it('should send group call request successfully', async () => {
      // Arrange
      const groupCallData = {
        call_type: 'video' as const,
        user_id: mockUserId,
        user_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        call_id: mockCallId,
      };

      // Act
      await signalingService.sendGroupCallRequest(mockGroupId, groupCallData);

      // Assert
      expect(mockClient.create).toHaveBeenCalledWith('webrtc_signal', expect.objectContaining({
        signal_type: SignalType.GROUP_CALL_REQUEST,
        from_user: mockUserId,
        group_id: mockGroupId,
        signal_data: groupCallData,
      }));
    });

    it('should send group call join successfully', async () => {
      // Arrange
      const groupCallData = {
        call_type: 'video' as const,
        user_id: mockUserId,
        user_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        call_id: mockCallId,
      };

      // Act
      await signalingService.sendGroupCallJoin(mockGroupId, groupCallData);

      // Assert
      expect(mockClient.create).toHaveBeenCalledWith('webrtc_signal', expect.objectContaining({
        signal_type: SignalType.GROUP_CALL_JOIN,
        from_user: mockUserId,
        group_id: mockGroupId,
        signal_data: groupCallData,
      }));
    });

    it('should send group call leave successfully', async () => {
      // Arrange
      const groupCallData = {
        call_type: 'video' as const,
        user_id: mockUserId,
        user_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        call_id: mockCallId,
      };

      // Act
      await signalingService.sendGroupCallLeave(mockGroupId, groupCallData);

      // Assert
      expect(mockClient.create).toHaveBeenCalledWith('webrtc_signal', expect.objectContaining({
        signal_type: SignalType.GROUP_CALL_LEAVE,
        from_user: mockUserId,
        group_id: mockGroupId,
        signal_data: groupCallData,
      }));
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
          signal_data: { call_type: 'video' },
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
      expect(mockClient.delete).toHaveBeenCalled();
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
      expect(status).toHaveProperty('isConnected');
      expect(status).toHaveProperty('currentUserId');
      expect(status).toHaveProperty('activeListeners');
    });
  });
});
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
vi.stubGlobal('console', mockConsole);

// Mock user IDs
const mockUserId = 'user:123' as RecordId;
const mockTargetUserId = 'user:456' as RecordId;
const mockGroupId = 'message_group:789' as RecordId;

describe('SignalingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset service state
    (signalingService as any).listeners = {};
    (signalingService as any).subscriptions.clear();
    (signalingService as any).currentUserId = null;
    (signalingService as any).isInitialized = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully with valid user ID', async () => {
      // Arrange
      mockSurrealClientSingleton.queryLive.mockResolvedValue('subscription_123');

      // Act
      await signalingService.initialize(mockUserId);

      // Assert
      expect(signalingService.isInitialized()).toBe(true);
      expect(signalingService.getCurrentUserId()).toBe(mockUserId);
      expect(mockSurrealClientSingleton.queryLive).toHaveBeenCalled();
    });

    it('should throw error when user ID is invalid', async () => {
      // Act & Assert
      await expect(signalingService.initialize(null as any))
        .rejects.toThrow('用户ID不能为空');
      
      await expect(signalingService.initialize('' as any))
        .rejects.toThrow('用户ID不能为空');
    });

    it('should handle subscription setup errors', async () => {
      // Arrange
      mockSurrealClientSingleton.queryLive.mockRejectedValue(new Error('Subscription failed'));

      // Act & Assert
      await expect(signalingService.initialize(mockUserId))
        .rejects.toThrow('信令服务初始化失败');
    });

    it('should not reinitialize if already initialized', async () => {
      // Arrange
      mockSurrealClientSingleton.queryLive.mockResolvedValue('subscription_123');
      await signalingService.initialize(mockUserId);
      vi.clearAllMocks();

      // Act
      await signalingService.initialize('user:456' as RecordId);

      // Assert
      expect(mockSurrealClientSingleton.queryLive).not.toHaveBeenCalled();
      expect(signalingService.getCurrentUserId()).toBe(mockUserId); // Should not change
    });
  });

  describe('sendOffer', () => {
    beforeEach(async () => {
      mockSurrealClientSingleton.queryLive.mockResolvedValue('subscription_123');
      await signalingService.initialize(mockUserId);
    });

    it('should send offer signal successfully', async () => {
      // Arrange
      const offerData: OfferSignalData = {
        type: 'offer',
        sdp: 'mock-offer-sdp',
        constraints: { audio: true, video: true }
      };
      const callId = 'call_123';

      mockSurrealClientSingleton.create.mockResolvedValue([{
        id: 'signal_123',
        signal_type: SignalType.OFFER,
        from_user: mockUserId,
        to_user: mockTargetUserId,
        signal_data: offerData,
        call_id: callId,
      }]);

      // Act
      const result = await signalingService.sendOffer(mockTargetUserId, offerData, callId);

      // Assert
      expect(mockSurrealClientSingleton.create).toHaveBeenCalledWith(
        'webrtc_signal',
        expect.objectContaining({
          signal_type: SignalType.OFFER,
          from_user: mockUserId,
          to_user: mockTargetUserId,
          signal_data: offerData,
          call_id: callId,
          expires_at: expect.any(String),
        })
      );
      expect(result).toBeDefined();
    });

    it('should throw error when not initialized', async () => {
      // Arrange
      (signalingService as any).isInitialized = false;

      const offerData: OfferSignalData = {
        type: 'offer',
        sdp: 'mock-offer-sdp'
      };

      // Act & Assert
      await expect(signalingService.sendOffer(mockTargetUserId, offerData))
        .rejects.toThrow('信令服务未初始化');
    });

    it('should handle send errors gracefully', async () => {
      // Arrange
      const offerData: OfferSignalData = {
        type: 'offer',
        sdp: 'mock-offer-sdp'
      };

      mockSurrealClientSingleton.create.mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(signalingService.sendOffer(mockTargetUserId, offerData))
        .rejects.toThrow('发送offer信令失败');
    });
  });

  describe('sendAnswer', () => {
    beforeEach(async () => {
      mockSurrealClientSingleton.queryLive.mockResolvedValue('subscription_123');
      await signalingService.initialize(mockUserId);
    });

    it('should send answer signal successfully', async () => {
      // Arrange
      const answerData: AnswerSignalData = {
        type: 'answer',
        sdp: 'mock-answer-sdp'
      };
      const callId = 'call_123';

      mockSurrealClientSingleton.create.mockResolvedValue([{
        id: 'signal_456',
        signal_type: SignalType.ANSWER,
        from_user: mockUserId,
        to_user: mockTargetUserId,
        signal_data: answerData,
        call_id: callId,
      }]);

      // Act
      const result = await signalingService.sendAnswer(mockTargetUserId, answerData, callId);

      // Assert
      expect(mockSurrealClientSingleton.create).toHaveBeenCalledWith(
        'webrtc_signal',
        expect.objectContaining({
          signal_type: SignalType.ANSWER,
          from_user: mockUserId,
          to_user: mockTargetUserId,
          signal_data: answerData,
          call_id: callId,
        })
      );
      expect(result).toBeDefined();
    });
  });

  describe('sendIceCandidate', () => {
    beforeEach(async () => {
      mockSurrealClientSingleton.queryLive.mockResolvedValue('subscription_123');
      await signalingService.initialize(mockUserId);
    });

    it('should send ICE candidate signal successfully', async () => {
      // Arrange
      const candidateData: IceCandidateSignalData = {
        candidate: 'candidate:1 1 UDP 2122252543 192.168.1.100 54400 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
        usernameFragment: 'abcd'
      };
      const callId = 'call_123';

      mockSurrealClientSingleton.create.mockResolvedValue([{
        id: 'signal_789',
        signal_type: SignalType.ICE_CANDIDATE,
        from_user: mockUserId,
        to_user: mockTargetUserId,
        signal_data: candidateData,
        call_id: callId,
      }]);

      // Act
      const result = await signalingService.sendIceCandidate(mockTargetUserId, candidateData, callId);

      // Assert
      expect(mockSurrealClientSingleton.create).toHaveBeenCalledWith(
        'webrtc_signal',
        expect.objectContaining({
          signal_type: SignalType.ICE_CANDIDATE,
          from_user: mockUserId,
          to_user: mockTargetUserId,
          signal_data: candidateData,
          call_id: callId,
        })
      );
      expect(result).toBeDefined();
    });
  });

  describe('sendCallRequest', () => {
    beforeEach(async () => {
      mockSurrealClientSingleton.queryLive.mockResolvedValue('subscription_123');
      await signalingService.initialize(mockUserId);
    });

    it('should send call request signal successfully', async () => {
      // Arrange
      const callRequestData: CallRequestSignalData = {
        callType: 'video',
        callId: 'call_123',
        initiatorName: 'John Doe',
        constraints: { audio: true, video: true }
      };

      mockSurrealClientSingleton.create.mockResolvedValue([{
        id: 'signal_call_request',
        signal_type: SignalType.CALL_REQUEST,
        from_user: mockUserId,
        to_user: mockTargetUserId,
        signal_data: callRequestData,
        call_id: callRequestData.callId,
      }]);

      // Act
      const result = await signalingService.sendCallRequest(mockTargetUserId, callRequestData);

      // Assert
      expect(mockSurrealClientSingleton.create).toHaveBeenCalledWith(
        'webrtc_signal',
        expect.objectContaining({
          signal_type: SignalType.CALL_REQUEST,
          from_user: mockUserId,
          to_user: mockTargetUserId,
          signal_data: callRequestData,
          call_id: callRequestData.callId,
        })
      );
      expect(result).toBeDefined();
    });
  });

  describe('sendCallResponse', () => {
    beforeEach(async () => {
      mockSurrealClientSingleton.queryLive.mockResolvedValue('subscription_123');
      await signalingService.initialize(mockUserId);
    });

    it('should send call accept response successfully', async () => {
      // Arrange
      const responseData: CallResponseSignalData = {
        callId: 'call_123',
        accepted: true
      };

      mockSurrealClientSingleton.create.mockResolvedValue([{
        id: 'signal_call_accept',
        signal_type: SignalType.CALL_ACCEPT,
        from_user: mockUserId,
        to_user: mockTargetUserId,
        signal_data: responseData,
        call_id: responseData.callId,
      }]);

      // Act
      const result = await signalingService.sendCallResponse(mockTargetUserId, responseData, true);

      // Assert
      expect(mockSurrealClientSingleton.create).toHaveBeenCalledWith(
        'webrtc_signal',
        expect.objectContaining({
          signal_type: SignalType.CALL_ACCEPT,
          signal_data: responseData,
        })
      );
      expect(result).toBeDefined();
    });

    it('should send call reject response successfully', async () => {
      // Arrange
      const responseData: CallResponseSignalData = {
        callId: 'call_123',
        accepted: false,
        reason: 'User is busy'
      };

      mockSurrealClientSingleton.create.mockResolvedValue([{
        id: 'signal_call_reject',
        signal_type: SignalType.CALL_REJECT,
        from_user: mockUserId,
        to_user: mockTargetUserId,
        signal_data: responseData,
        call_id: responseData.callId,
      }]);

      // Act
      const result = await signalingService.sendCallResponse(mockTargetUserId, responseData, false);

      // Assert
      expect(mockSurrealClientSingleton.create).toHaveBeenCalledWith(
        'webrtc_signal',
        expect.objectContaining({
          signal_type: SignalType.CALL_REJECT,
          signal_data: responseData,
        })
      );
      expect(result).toBeDefined();
    });
  });

  describe('sendGroupCallRequest', () => {
    beforeEach(async () => {
      mockSurrealClientSingleton.queryLive.mockResolvedValue('subscription_123');
      await signalingService.initialize(mockUserId);
    });

    it('should send group call request successfully', async () => {
      // Arrange
      const groupCallData = {
        callId: 'group_call_123',
        callType: 'conference' as const,
        groupName: 'Project Team',
        initiatorName: 'John Doe',
        participants: ['user:456', 'user:789']
      };

      mockSurrealClientSingleton.create.mockResolvedValue([{
        id: 'signal_group_call',
        signal_type: SignalType.GROUP_CALL_REQUEST,
        from_user: mockUserId,
        group_id: mockGroupId,
        signal_data: groupCallData,
        call_id: groupCallData.callId,
      }]);

      // Act
      const result = await signalingService.sendGroupCallRequest(mockGroupId, groupCallData);

      // Assert
      expect(mockSurrealClientSingleton.create).toHaveBeenCalledWith(
        'webrtc_signal',
        expect.objectContaining({
          signal_type: SignalType.GROUP_CALL_REQUEST,
          from_user: mockUserId,
          group_id: mockGroupId,
          signal_data: groupCallData,
          call_id: groupCallData.callId,
        })
      );
      expect(result).toBeDefined();
    });
  });

  describe('addEventListener', () => {
    beforeEach(async () => {
      mockSurrealClientSingleton.queryLive.mockResolvedValue('subscription_123');
      await signalingService.initialize(mockUserId);
    });

    it('should register event listeners correctly', () => {
      // Arrange
      const listeners = {
        onOfferReceived: vi.fn(),
        onAnswerReceived: vi.fn(),
        onIceCandidateReceived: vi.fn(),
        onCallRequest: vi.fn(),
        onCallAccept: vi.fn(),
        onCallReject: vi.fn(),
        onError: vi.fn(),
      };

      // Act
      signalingService.addEventListener(listeners);

      // Assert
      expect((signalingService as any).listeners.onOfferReceived).toBe(listeners.onOfferReceived);
      expect((signalingService as any).listeners.onAnswerReceived).toBe(listeners.onAnswerReceived);
      expect((signalingService as any).listeners.onIceCandidateReceived).toBe(listeners.onIceCandidateReceived);
      expect((signalingService as any).listeners.onCallRequest).toBe(listeners.onCallRequest);
      expect((signalingService as any).listeners.onCallAccept).toBe(listeners.onCallAccept);
      expect((signalingService as any).listeners.onCallReject).toBe(listeners.onCallReject);
      expect((signalingService as any).listeners.onError).toBe(listeners.onError);
    });
  });

  describe('removeEventListener', () => {
    beforeEach(async () => {
      mockSurrealClientSingleton.queryLive.mockResolvedValue('subscription_123');
      await signalingService.initialize(mockUserId);
    });

    it('should remove specific event listeners', () => {
      // Arrange
      const listeners = {
        onOfferReceived: vi.fn(),
        onAnswerReceived: vi.fn(),
      };

      signalingService.addEventListener(listeners);

      // Act
      signalingService.removeEventListener(['onOfferReceived']);

      // Assert
      expect((signalingService as any).listeners.onOfferReceived).toBeUndefined();
      expect((signalingService as any).listeners.onAnswerReceived).toBe(listeners.onAnswerReceived);
    });

    it('should remove all event listeners when no specific types provided', () => {
      // Arrange
      const listeners = {
        onOfferReceived: vi.fn(),
        onAnswerReceived: vi.fn(),
        onCallRequest: vi.fn(),
      };

      signalingService.addEventListener(listeners);

      // Act
      signalingService.removeEventListener();

      // Assert
      expect(Object.keys((signalingService as any).listeners)).toHaveLength(0);
    });
  });

  describe('markSignalAsProcessed', () => {
    beforeEach(async () => {
      mockSurrealClientSingleton.queryLive.mockResolvedValue('subscription_123');
      await signalingService.initialize(mockUserId);
    });

    it('should mark signal as processed successfully', async () => {
      // Arrange
      const signalId = 'webrtc_signal:123';
      mockSurrealClientSingleton.update.mockResolvedValue([{ processed: true }]);

      // Act
      await signalingService.markSignalAsProcessed(signalId);

      // Assert
      expect(mockSurrealClientSingleton.update).toHaveBeenCalledWith(
        signalId,
        { processed: true }
      );
    });

    it('should handle update errors gracefully', async () => {
      // Arrange
      const signalId = 'webrtc_signal:123';
      mockSurrealClientSingleton.update.mockRejectedValue(new Error('Update failed'));

      // Act & Assert
      await expect(signalingService.markSignalAsProcessed(signalId))
        .rejects.toThrow('标记信令为已处理失败');
    });
  });

  describe('getUnprocessedSignals', () => {
    beforeEach(async () => {
      mockSurrealClientSingleton.queryLive.mockResolvedValue('subscription_123');
      await signalingService.initialize(mockUserId);
    });

    it('should get unprocessed signals for user', async () => {
      // Arrange
      const mockSignals = [
        {
          id: 'signal_1',
          signal_type: SignalType.OFFER,
          from_user: mockTargetUserId,
          to_user: mockUserId,
          signal_data: { type: 'offer', sdp: 'mock-sdp' },
          created_at: new Date().toISOString(),
          processed: false,
        },
        {
          id: 'signal_2',
          signal_type: SignalType.ICE_CANDIDATE,
          from_user: mockTargetUserId,
          to_user: mockUserId,
          signal_data: { candidate: 'mock-candidate' },
          created_at: new Date().toISOString(),
          processed: false,
        }
      ];

      mockSurrealClientSingleton.query.mockResolvedValue([mockSignals]);

      // Act
      const result = await signalingService.getUnprocessedSignals();

      // Assert
      expect(mockSurrealClientSingleton.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE to_user = $user_id AND processed = false'),
        { user_id: mockUserId }
      );
      expect(result).toEqual(mockSignals);
    });

    it('should filter signals by type when specified', async () => {
      // Arrange
      const signalTypes = [SignalType.OFFER, SignalType.ANSWER];
      mockSurrealClientSingleton.query.mockResolvedValue([[]]);

      // Act
      await signalingService.getUnprocessedSignals(signalTypes);

      // Assert
      expect(mockSurrealClientSingleton.query).toHaveBeenCalledWith(
        expect.stringContaining('AND signal_type IN $signal_types'),
        { user_id: mockUserId, signal_types: signalTypes }
      );
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      mockSurrealClientSingleton.queryLive.mockResolvedValue('subscription_123');
      await signalingService.initialize(mockUserId);
    });

    it('should cleanup subscriptions and reset state', async () => {
      // Act
      await signalingService.cleanup();

      // Assert
      expect(mockSurrealClientSingleton.unsubscribe).toHaveBeenCalledWith('subscription_123');
      expect((signalingService as any).isInitialized).toBe(false);
      expect((signalingService as any).currentUserId).toBeNull();
      expect((signalingService as any).subscriptions.size).toBe(0);
      expect(Object.keys((signalingService as any).listeners)).toHaveLength(0);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Arrange
      mockSurrealClientSingleton.unsubscribe.mockRejectedValue(new Error('Cleanup failed'));

      // Act
      await signalingService.cleanup();

      // Assert - Should not throw and should still reset state
      expect((signalingService as any).isInitialized).toBe(false);
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('清理订阅失败'),
        expect.any(Error)
      );
    });
  });

  describe('signal processing', () => {
    beforeEach(async () => {
      mockSurrealClientSingleton.queryLive.mockResolvedValue('subscription_123');
      await signalingService.initialize(mockUserId);
    });

    it('should process incoming signals and call appropriate listeners', () => {
      // Arrange
      const onOfferReceived = vi.fn();
      const onAnswerReceived = vi.fn();
      const onIceCandidateReceived = vi.fn();

      signalingService.addEventListener({
        onOfferReceived,
        onAnswerReceived,
        onIceCandidateReceived,
      });

      const offerSignal: SignalMessage = {
        id: 'signal_1',
        signal_type: SignalType.OFFER,
        from_user: mockTargetUserId,
        to_user: mockUserId,
        signal_data: { type: 'offer', sdp: 'mock-sdp' },
        call_id: 'call_123',
        created_at: new Date().toISOString(),
      };

      // Act - Simulate receiving signal through live query callback
      const processSignal = (signalingService as any).processIncomingSignal;
      if (processSignal) {
        processSignal(offerSignal);
      }

      // Assert
      expect(onOfferReceived).toHaveBeenCalledWith(
        mockTargetUserId,
        offerSignal.signal_data,
        'call_123'
      );
    });
  });
});
