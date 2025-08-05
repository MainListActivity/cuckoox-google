import { renderHook, act, waitFor } from "@testing-library/react";
import { useLiveMeetings, Meeting } from "@/src/hooks/useLiveMeetingData";
import { RecordId } from "surrealdb";
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockQuery = vi.fn();
const mockLive = vi.fn();
const mockKill = vi.fn();
const mockSubscribeLive = vi.fn();

let liveCallback: ((action: string, result: any) => void) | null = null;

const mockClient = {
  select: mockSelect,
  query: mockQuery,
  live: mockLive,
  kill: mockKill,
  subscribeLive: mockSubscribeLive,
};

const surrealClientState = {
  client: mockClient,
  isConnected: true,
};

vi.mock("@/src/contexts/SurrealProvider", () => ({
  useSurreal: () => surrealClientState,
  useSurrealContext: () => surrealClientState,
}));

const createMockMeeting = (
  id: string,
  scheduled_time: string,
  title: string = "Test Meeting",
  caseId: string = "case:test",
): Meeting => ({
  id: new RecordId("meeting", id),
  case_id: new RecordId("case", caseId.split(":")[1]),
  title,
  type: "临时会议",
  scheduled_time,
  status: "已安排",
  conference_link: "http://example.com/meet",
  minutes_exist: false,
  attendees: [],
  attendee_ids: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

describe("useLiveMeetings Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveCallback = null;
    surrealClientState.isConnected = true;

    mockSubscribeLive.mockImplementation((queryId, callback) => {
      liveCallback = callback;
    });

    mockLive.mockImplementation(async () => {
      const liveId = "live-query-id:" + Math.random();
      return liveId;
    });

    mockKill.mockImplementation(async () => {
      return Promise.resolve();
    });
  });

  it("should fetch initial meetings, sort them, and set up a live query", async () => {
    const meetingA = createMockMeeting(
      "1",
      "2023-01-01T10:00:00Z",
      "Meeting A",
    );
    const meetingB = createMockMeeting(
      "2",
      "2023-01-02T10:00:00Z",
      "Meeting B",
    );

    // Mock the query calls
    mockQuery
      .mockResolvedValueOnce([{ result: [meetingA, meetingB] }]) // Initial data fetch
      .mockResolvedValueOnce([{ result: "live-query-id" }]); // Live query setup

    const { result } = renderHook(() => useLiveMeetings("case:test"));

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM meeting WHERE case_id = $caseId",
        { caseId: "case:test" },
      );
    });

    await waitFor(() => {
      expect(result.current.length).toBe(2);
    });

    expect(result.current[0].title).toBe("Meeting B"); // Should be sorted
    expect(result.current[1].title).toBe("Meeting A");

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith("LIVE SELECT * FROM meeting;");
      expect(mockSubscribeLive).toHaveBeenCalled();
    });
  });

  it("should handle CREATE event", async () => {
    const meetingA = createMockMeeting(
      "1",
      "2023-01-01T10:00:00Z",
      "Meeting A",
      "case:test-create",
    );
    mockQuery
      .mockResolvedValueOnce([{ result: [meetingA] }])
      .mockResolvedValueOnce([{ result: "live-query-id" }]);

    const { result } = renderHook(() => useLiveMeetings("case:test-create"));

    await waitFor(() => expect(result.current.length).toBe(1));
    await waitFor(() => expect(liveCallback).not.toBeNull());

    const meetingB = createMockMeeting(
      "2",
      "2023-01-02T12:00:00Z",
      "Meeting B",
      "case:test-create",
    );
    act(() => {
      liveCallback?.("CREATE", meetingB);
    });

    await waitFor(() => expect(result.current.length).toBe(2));
    expect(result.current[0].title).toBe("Meeting B");
  });

  it("should handle UPDATE event", async () => {
    const meetingA = createMockMeeting(
      "1",
      "2023-01-01T10:00:00Z",
      "Meeting A",
      "case:test-update",
    );
    mockQuery
      .mockResolvedValueOnce([{ result: [meetingA] }])
      .mockResolvedValueOnce([{ result: "live-query-id" }]);

    const { result } = renderHook(() => useLiveMeetings("case:test-update"));
    await waitFor(() => expect(result.current.length).toBe(1));
    await waitFor(() => expect(liveCallback).not.toBeNull());

    const updatedMeetingA = { ...meetingA, title: "Meeting A Updated" };
    act(() => {
      liveCallback?.("UPDATE", updatedMeetingA);
    });

    await waitFor(() =>
      expect(result.current[0].title).toBe("Meeting A Updated"),
    );
  });

  it("should handle DELETE event", async () => {
    const meetingA = createMockMeeting(
      "1",
      "2023-01-01T10:00:00Z",
      "Meeting A",
      "case:test-delete",
    );
    mockQuery
      .mockResolvedValueOnce([{ result: [meetingA] }])
      .mockResolvedValueOnce([{ result: "live-query-id" }]);

    const { result } = renderHook(() => useLiveMeetings("case:test-delete"));
    await waitFor(() => expect(result.current.length).toBe(1));
    await waitFor(() => expect(liveCallback).not.toBeNull());

    act(() => {
      liveCallback?.("DELETE", meetingA);
    });

    await waitFor(() => expect(result.current.length).toBe(0));
  });

  it("should kill live query on unmount", async () => {
    mockQuery
      .mockResolvedValueOnce([{ result: [] }])
      .mockResolvedValueOnce([{ result: "live-query-id" }]);

    const { unmount } = renderHook(() => useLiveMeetings("case:test-unmount"));

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalled();
    });

    unmount();

    await waitFor(() => {
      expect(mockKill).toHaveBeenCalled();
    });
  });

  it("should not do anything if caseId is null", () => {
    renderHook(() => useLiveMeetings(null));
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("should not do anything if client is not connected", () => {
    surrealClientState.isConnected = false;
    renderHook(() => useLiveMeetings("case:test"));
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
