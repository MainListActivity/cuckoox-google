import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useConversationsList,
  useSystemNotifications,
} from "@/src/hooks/useMessageCenterData";
import { Message } from "@/src/types/message";
import { RecordId } from "surrealdb"; // Changed from surrealdb.js

// Mock the SurrealClient
const mockQuery = vi.fn();
const mockKill = vi.fn();

// Store the callback passed to subscribeLive to simulate events
let liveCallback:
  | ((actionEvent: { action: string; result: unknown }) => void)
  | null = null;

const mockSubscribeLiveFn = vi.fn((table, callback) => {
  liveCallback = callback;
  return Promise.resolve({
    id: "mock-subscribe-live-msg-" + Date.now(),
    close: vi.fn(),
  });
});

const mockSurrealDbClient = {
  query: mockQuery,
  select: vi.fn(),
  subscribeLive: mockSubscribeLiveFn, // Use the vi.fn() mock
  kill: mockKill,
  status: "connected",
};

vi.mock("../../../src/contexts/SurrealProvider", () => ({
  useSurreal: () => ({
    client: mockSurrealDbClient,
    isConnected: true,
  }),
  useSurrealContext: () => ({
    client: mockSurrealDbClient,
    isConnected: true,
  }),
}));

// Mock useAuth if needed for userId (not strictly necessary if we pass userId directly)
vi.mock("../../../src/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user:test-user", name: "Test User" },
    // ... other auth context values if needed by hooks directly (they don't seem to)
  }),
}));

describe("useMessageCenterData Hooks", () => {
  beforeEach(() => {
    mockQuery.mockClear(); // Use mockClear for vi.fn
    mockSubscribeLiveFn.mockClear(); // Clear the new vi.fn mock
    mockKill.mockClear(); // Use mockClear for vi.fn
    liveCallback = null;
    mockKill.mockResolvedValue(undefined); // Default success for kill
  });

  describe("useConversationsList", () => {
    const mockUserId = new RecordId("user","test-user");

    it("should return initial loading state and empty conversations", () => {
      mockQuery.mockImplementation(() => new Promise(() => {})); // Keep query pending
      const { result } = renderHook(() => useConversationsList(mockUserId));
      expect(result.current.isLoading).toBe(true);
      expect(result.current.conversations).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("should call query with correct placeholder SQL and userId", async () => {
      mockQuery.mockResolvedValueOnce([[]]);
      const { result } = renderHook(() => useConversationsList(mockUserId));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          "SELECT id, participants, updated_at, 0 AS unread_count FROM conversation WHERE $userId IN participants ORDER BY updated_at DESC;",
        ),
        { userId: mockUserId },
      );
    });

    it("should parse raw conversation data correctly", async () => {
      const rawData = [
        {
          id: new RecordId("conversation", "conv1"),
          participants: [{ id: "user:otherUser", name: "Other User" }],
          updated_at: new Date().toISOString(),
          last_message_snippet: [{ content: "Hello there" }],
          last_message_timestamp: [{ created_at: new Date().toISOString() }],
          last_message_sender_name: [{ sender_name: "Other User" }],
          unread_count: 1,
        },
      ];
      mockQuery.mockResolvedValueOnce([rawData]);
      const { result } = renderHook(() => useConversationsList(mockUserId));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.conversations.length).toBe(1);
      const conv = result.current.conversations[0];
      expect(conv.id).toEqual(new RecordId("conversation", "conv1"));
      expect(conv.participants[0]?.name).toBe("Other User");
      expect(conv.last_message_snippet).toBe("Hello there");
      expect(conv.unread_count).toBe(1);
    });

    it("should return empty array for empty DB result", async () => {
      mockQuery.mockResolvedValueOnce([[]]);
      const { result } = renderHook(() => useConversationsList(mockUserId));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.conversations).toEqual([]);
    });

    it("should handle query error", async () => {
      const MOCK_ERROR = new Error("DB query failed");
      mockQuery.mockRejectedValueOnce(MOCK_ERROR);
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {}); // Use vi.spyOn()
      const { result } = renderHook(() => useConversationsList(mockUserId));

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error).toBe(MOCK_ERROR);
      expect(result.current.conversations).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching conversations:",
        MOCK_ERROR,
      );
      consoleErrorSpy.mockRestore();
    });

    it("should trigger re-fetch on simulated live event", async () => {
      mockQuery
        .mockResolvedValueOnce([[]]) // Initial data fetch
        .mockResolvedValueOnce([{ result: "live-query-id-123", status: "OK" }]); // Live query setup
      const { result } = renderHook(() => useConversationsList(mockUserId));
      await waitFor(() => expect(result.current.isLoading).toBe(false)); // Wait for initial fetch

      expect(mockQuery).toHaveBeenCalledTimes(2); // 1. Initial data fetch, 2. Live query setup
      expect(mockSubscribeLiveFn).toHaveBeenCalledTimes(1); // Live subscription setup
      expect(liveCallback).not.toBeNull(); // Callback should be captured

      // Simulate data for the re-fetch
      const refetchData = [
        {
          id: new RecordId("conv", "new"),
          participants: [],
          updated_at: new Date().toISOString(),
          last_message_snippet: "New Message",
          unread_count: 1,
        },
      ];
      mockQuery.mockResolvedValueOnce([refetchData]);

      act(() => {
        if (liveCallback) liveCallback({ action: "CREATE", result: {} }); // Simulate live event
      });

      // Wait for the re-fetch to complete and update the state
      await waitFor(() => expect(result.current.conversations.length).toBe(1));
      expect(mockQuery).toHaveBeenCalledTimes(3); // +1 for re-fetch
      expect(result.current.conversations[0].id).toEqual(
        new RecordId("conv", "new"),
      ); // RecordId comparison
    });

    it("should not fetch data if userId is null", () => {
      const { result } = renderHook(() => useConversationsList(null));
      expect(result.current.isLoading).toBe(false);
      expect(result.current.conversations).toEqual([]);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("should call cleanup function on unmount", async () => {
      mockQuery
        .mockResolvedValueOnce([[]]) // Initial data fetch
        .mockResolvedValueOnce(["live-query-id-123"]); // Live query setup

      const { unmount } = renderHook(() => useConversationsList(mockUserId));
      await waitFor(() => expect(mockSubscribeLiveFn).toHaveBeenCalled()); // Ensure live query is set up

      unmount();
      expect(mockKill).toHaveBeenCalledWith("live-query-id-123");
    });
  });

  describe("useSystemNotifications", () => {
    const mockUserId = new RecordId("user","test-user");
    const mockCaseId = new RecordId("case","case123");

    it("should return initial loading state and empty notifications", () => {
      mockQuery.mockImplementation(() => new Promise(() => {})); // Keep query pending
      const { result } = renderHook(() =>
        useSystemNotifications(mockUserId, mockCaseId),
      );
      expect(result.current.isLoading).toBe(true);
      expect(result.current.notifications).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("should call query with correct SQL and parameters (with caseId)", async () => {
      mockQuery.mockResolvedValueOnce([[]]);
      const { result } = renderHook(() =>
        useSystemNotifications(mockUserId, mockCaseId),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          "(type = 'CASE_ROBOT_REMINDER' AND (case_id = $caseId OR $caseId = NONE))",
        ),
        { userId: mockUserId, caseId: mockCaseId },
      );
    });

    it("should call query with correct SQL and parameters (without caseId)", async () => {
      mockQuery.mockResolvedValueOnce([[]]);
      const { result } = renderHook(() =>
        useSystemNotifications(mockUserId, null),
      ); // caseId is null
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          "(type = 'CASE_ROBOT_REMINDER' AND (case_id = $caseId OR $caseId = NONE))",
        ),
        { userId: mockUserId, caseId: null }, // caseId passed as null
      );
    });

    it("should parse raw notification data correctly", async () => {
      const rawData: Message[] = [
        {
          id: "notif1",
          type: "CASE_ROBOT_REMINDER",
          sender_name: "Bot1",
          content: "Reminder",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_read: false,
          case_id: mockCaseId,
        },
        {
          id: "notif2",
          type: "BUSINESS_NOTIFICATION",
          sender_name: "System",
          content: "Update",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_read: true,
          target_user_id: mockUserId,
          severity: "info",
        },
        {
          id: "notif3",
          type: "IM",
          content: "IM message, should be filtered out",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_read: false,
          conversation_id: "conv1",
          sender_id: "user:other",
        } as unknown as Message, // Cast to unknown as Message to bypass strict type for testing filter
      ];
      mockQuery.mockResolvedValueOnce([rawData]);
      const { result } = renderHook(() =>
        useSystemNotifications(mockUserId, mockCaseId),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.notifications.length).toBe(2);
      expect(
        result.current.notifications.find((n) => n.id === "notif1")?.type,
      ).toBe("CASE_ROBOT_REMINDER");
      expect(
        result.current.notifications.find((n) => n.id === "notif2")?.type,
      ).toBe("BUSINESS_NOTIFICATION");
    });

    it("should handle query error", async () => {
      const MOCK_ERROR = new Error("DB query failed for notifications");
      mockQuery.mockRejectedValueOnce(MOCK_ERROR);
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {}); // Use vi.spyOn()
      const { result } = renderHook(() =>
        useSystemNotifications(mockUserId, mockCaseId),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error).toBe(MOCK_ERROR);
      expect(result.current.notifications).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching system notifications:",
        MOCK_ERROR,
      );
      consoleErrorSpy.mockRestore();
    });

    it("should call query with correct SQL when caseId is undefined", async () => {
      mockQuery.mockResolvedValueOnce([[]]);
      const { result } = renderHook(() =>
        useSystemNotifications(mockUserId, undefined),
      ); // caseId is undefined
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          "(type = 'CASE_ROBOT_REMINDER' AND (case_id = $caseId OR $caseId = NONE))",
        ),
        { userId: mockUserId, caseId: undefined },
      );
    });

    it("should not fetch data if userId is null", () => {
      const { result } = renderHook(() =>
        useSystemNotifications(null, mockCaseId),
      );
      expect(result.current.isLoading).toBe(false);
      expect(result.current.notifications).toEqual([]);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("should call cleanup function on unmount", async () => {
      mockQuery
        .mockResolvedValueOnce([[]]) // Initial data fetch
        .mockResolvedValueOnce(["live-query-id-123"]); // Live query setup
      const { unmount } = renderHook(() =>
        useSystemNotifications(mockUserId, mockCaseId),
      );
      await waitFor(() => expect(mockSubscribeLiveFn).toHaveBeenCalled()); // Ensure live query is set up

      unmount();
      expect(mockKill).toHaveBeenCalledWith("live-query-id-123");
    });

    it("should trigger re-fetch on simulated live event for notifications", async () => {
      mockQuery
        .mockResolvedValueOnce([[]]) // Initial fetch
        .mockResolvedValueOnce(["live-query-id-789"]); // Live query setup
      const { result } = renderHook(() =>
        useSystemNotifications(mockUserId, mockCaseId),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false)); // Wait for initial fetch

      expect(mockQuery).toHaveBeenCalledTimes(2); // 1. Initial data fetch, 2. Live query setup
      expect(mockSubscribeLiveFn).toHaveBeenCalledTimes(1); // Live subscription setup
      expect(liveCallback).not.toBeNull(); // Callback should be captured

      const newNotification = {
        id: "notif:new",
        type: "BUSINESS_NOTIFICATION",
        content: "New live notif",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_read: false,
        target_user_id: mockUserId,
        sender_name: "Live System",
      };
      mockQuery.mockResolvedValueOnce([[newNotification]]); // Re-fetch response

      act(() => {
        if (liveCallback) liveCallback({ action: "CREATE", result: {} }); // Simulate live event
      });

      // Wait for the re-fetch to complete and update the state
      await waitFor(() => expect(result.current.notifications.length).toBe(1));
      expect(mockQuery).toHaveBeenCalledTimes(3); // +1 for re-fetch
      expect(result.current.notifications[0].content).toBe("New live notif");
    });
  });
});
