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
