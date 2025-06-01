import { renderHook, act, waitFor } from '@testing-library/react';
import { useConversationsList, useSystemNotifications } from '@/src/hooks/useMessageCenterData';
import { ConversationSummary, CaseRobotReminderMessage, BusinessNotificationMessage, Message } from '@/src/types/message';
import { RecordId } from 'surrealdb'; // Changed from surrealdb.js
import { vi } from 'vitest'; // Import vi

// Mock the SurrealClient
const mockQuery = vi.fn(); // Use vi.fn()
const mockListenLive = vi.fn(); // Use vi.fn()
const mockKill = vi.fn(); // Use vi.fn()

// Store the callback passed to listenLive to simulate events
let liveCallback: ((actionEvent: { action: string; result: any }) => void) | null = null;

const mockSurrealDbClient = {
  query: mockQuery, // Will be further customized in beforeEach or specific tests
  select: vi.fn(), // Added for completeness, though not directly used by current hook structure
  listenLive: (...args: any[]) => {
    if (typeof args[1] === 'function') liveCallback = args[1];
    return Promise.resolve({ id: 'mock-listen-live-msg-' + Date.now(), close: vi.fn() });
  },
  subscribeLive: (...args: any[]) => {
    if (typeof args[1] === 'function') liveCallback = args[1];
    return Promise.resolve({ id: 'mock-subscribe-live-msg-' + Date.now(), close: vi.fn() });
  },
  kill: mockKill,
  isConnected: true,
};

vi.mock('../../../src/contexts/SurrealProvider', () => ({
  useSurrealClient: () => ({
    client: mockSurrealDbClient,
    isConnected: true,
  }),
}));

// Mock useAuth if needed for userId (not strictly necessary if we pass userId directly)
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user:test-user', name: 'Test User' },
    // ... other auth context values if needed by hooks directly (they don't seem to)
  }),
}));


describe('useMessageCenterData Hooks', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockListenLive.mockReset();
    mockKill.mockReset();
    liveCallback = null;
    mockKill.mockResolvedValue(undefined); // Default success for kill
  });

  describe('useConversationsList', () => {
    const mockUserId = 'user:test-user';

    it('should return initial loading state and empty conversations', () => {
      mockQuery.mockImplementation(() => new Promise(() => {})); // Keep query pending
      const { result } = renderHook(() => useConversationsList(mockUserId));
      expect(result.current.isLoading).toBe(true);
      expect(result.current.conversations).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should call query with correct placeholder SQL and userId', async () => {
      mockQuery.mockResolvedValueOnce([{ result: [], status: 'OK' }]);
      const { result } = renderHook(() => useConversationsList(mockUserId));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id, participants, updated_at, 0 AS unread_count FROM conversation WHERE $userId IN participants ORDER BY updated_at DESC;"),
        { userId: mockUserId }
      );
    });

    it('should parse raw conversation data correctly', async () => {
      const rawData = [
        { 
          id: new RecordId('conversation', 'conv1'), 
          participants: [{ id: 'user:otherUser', name: 'Other User' }], 
          updated_at: new Date().toISOString(),
          last_message_snippet: [{ content: 'Hello there' }],
          last_message_timestamp: [{ created_at: new Date().toISOString() }],
          last_message_sender_name: [{ sender_name: 'Other User' }],
          unread_count: 1,
        }
      ];
      mockQuery.mockResolvedValueOnce([{ result: rawData, status: 'OK' }]);
      const { result } = renderHook(() => useConversationsList(mockUserId));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      expect(result.current.conversations.length).toBe(1);
      const conv = result.current.conversations[0];
      expect(conv.id).toEqual(new RecordId('conversation', 'conv1'));
      expect(conv.participants[0]?.name).toBe('Other User');
      expect(conv.last_message_snippet).toBe('Hello there');
      expect(conv.unread_count).toBe(1);
    });

    it('should return empty array for empty DB result', async () => {
      mockQuery.mockResolvedValueOnce([{ result: [], status: 'OK' }]);
      const { result } = renderHook(() => useConversationsList(mockUserId));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.conversations).toEqual([]);
    });

    it('should handle query error', async () => {
      const MOCK_ERROR = new Error('DB query failed');
      mockQuery.mockRejectedValueOnce(MOCK_ERROR);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // Use vi.spyOn()
      const { result } = renderHook(() => useConversationsList(mockUserId));
      
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error).toBe(MOCK_ERROR);
      expect(result.current.conversations).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching conversations:", MOCK_ERROR);
      consoleErrorSpy.mockRestore();
    });

    it('should trigger re-fetch on simulated live event', async () => {
      mockQuery.mockResolvedValueOnce([{ result: [], status: 'OK' }]); // Initial fetch
      const { result } = renderHook(() => useConversationsList(mockUserId));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      expect(mockQuery).toHaveBeenCalledTimes(2); // 1 for initial data, 1 for LIVE SELECT
      expect(liveCallback).not.toBeNull();

      mockQuery.mockResolvedValueOnce([{ result: [{ id: 'conv:new', participants: [], updated_at: new Date().toISOString(), unread_count: 1 }], status: 'OK' }]); // Re-fetch response
      act(() => {
        if (liveCallback) liveCallback({ action: 'CREATE', result: {} }); // Simulate any event
      });

      await waitFor(() => expect(mockQuery).toHaveBeenCalledTimes(3)); // 2 initial + 1 re-fetch
      expect(result.current.conversations.length).toBe(1); // Assuming re-fetch populates
    });
  });

  describe('useSystemNotifications', () => {
    const mockUserId = 'user:test-user';
    const mockCaseId = 'case:case123';

    it('should return initial loading state and empty notifications', () => {
      mockQuery.mockImplementation(() => new Promise(() => {})); // Keep query pending
      const { result } = renderHook(() => useSystemNotifications(mockUserId, mockCaseId));
      expect(result.current.isLoading).toBe(true);
      expect(result.current.notifications).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should call query with correct SQL and parameters (with caseId)', async () => {
      mockQuery.mockResolvedValueOnce([{ result: [], status: 'OK' }]);
      const { result } = renderHook(() => useSystemNotifications(mockUserId, mockCaseId));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("(type = 'CASE_ROBOT_REMINDER' AND (case_id = $caseId OR $caseId = NONE))"),
        { userId: mockUserId, caseId: mockCaseId }
      );
    });
    
    it('should call query with correct SQL and parameters (without caseId)', async () => {
      mockQuery.mockResolvedValueOnce([{ result: [], status: 'OK' }]);
      const { result } = renderHook(() => useSystemNotifications(mockUserId, null)); // caseId is null
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("(type = 'CASE_ROBOT_REMINDER' AND (case_id = $caseId OR $caseId = NONE))"),
        { userId: mockUserId, caseId: null } // caseId passed as null
      );
    });

    it('should parse raw notification data correctly', async () => {
      const rawData: Message[] = [
        { id: 'notif1', type: 'CASE_ROBOT_REMINDER', sender_name: 'Bot1', content: 'Reminder', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_read: false, case_id: mockCaseId },
        { id: 'notif2', type: 'BUSINESS_NOTIFICATION', sender_name: 'System', content: 'Update', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_read: true, target_user_id: mockUserId, severity: 'info' },
        { id: 'notif3', type: 'IM', content: 'IM message, should be filtered out', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_read: false, conversation_id: 'conv1', sender_id: 'user:other' } as any, // Cast to any to bypass strict type for testing filter
      ];
      mockQuery.mockResolvedValueOnce([{ result: rawData, status: 'OK' }]);
      const { result } = renderHook(() => useSystemNotifications(mockUserId, mockCaseId));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      expect(result.current.notifications.length).toBe(2);
      expect(result.current.notifications.find(n => n.id === 'notif1')?.type).toBe('CASE_ROBOT_REMINDER');
      expect(result.current.notifications.find(n => n.id === 'notif2')?.type).toBe('BUSINESS_NOTIFICATION');
    });
    
    it('should handle query error', async () => {
      const MOCK_ERROR = new Error('DB query failed for notifications');
      mockQuery.mockRejectedValueOnce(MOCK_ERROR);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // Use vi.spyOn()
      const { result } = renderHook(() => useSystemNotifications(mockUserId, mockCaseId));
      
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error).toBe(MOCK_ERROR);
      expect(result.current.notifications).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching system notifications:", MOCK_ERROR);
      consoleErrorSpy.mockRestore();
    });

     it('should trigger re-fetch on simulated live event for notifications', async () => {
      mockQuery.mockResolvedValueOnce([{ result: [], status: 'OK' }]); // Initial fetch
      const { result } = renderHook(() => useSystemNotifications(mockUserId, mockCaseId));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      expect(mockQuery).toHaveBeenCalledTimes(2); // 1 initial, 1 LIVE
      expect(liveCallback).not.toBeNull();

      const newNotification = { id: 'notif:new', type: 'BUSINESS_NOTIFICATION', content: 'New live notif', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_read: false, target_user_id: mockUserId, sender_name: 'Live System' };
      mockQuery.mockResolvedValueOnce([{ result: [newNotification], status: 'OK' }]); // Re-fetch response
      
      act(() => {
        if (liveCallback) liveCallback({ action: 'CREATE', result: {} }); // Simulate event
      });

      await waitFor(() => expect(mockQuery).toHaveBeenCalledTimes(3)); 
      expect(result.current.notifications.length).toBe(1);
      expect(result.current.notifications[0].content).toBe('New live notif');
    });
  });
});
