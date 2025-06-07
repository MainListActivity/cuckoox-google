import { renderHook, act, waitFor } from '@testing-library/react';
import { useLiveMeetings, Meeting } from '@/src/hooks/useLiveMeetingData';
import { RecordId } from 'surrealdb'; // Changed from surrealdb.js
import { vi } from 'vitest'; // Import vi

// Mock the SurrealClient
const mockSelect = vi.fn();
const mockQuery = vi.fn();
const mockListenLive = vi.fn();
const mockKill = vi.fn();
const mockSubscribeLive = vi.fn();

// Store the callback passed to listenLive to simulate events
let liveCallback: ((actionEvent: { action: string; result: Meeting }) => void) | null = null;

// Create a stable mock client object to avoid reference changes
const mockClient = {
  select: mockSelect,
  query: mockQuery,
  listenLive: mockListenLive,
  subscribeLive: mockSubscribeLive,
  kill: mockKill,
  isConnected: true,
};

vi.mock('../../../src/contexts/SurrealProvider', () => ({
  useSurrealClient: () => ({
    client: mockClient, // Use stable reference
    isConnected: true,
  }),
}));

// Helper function to create a mock meeting
const createMockMeeting = (id: string, scheduled_time: string, title: string = 'Test Meeting'): Meeting => ({
  id: new RecordId('meeting', id),
  case_id: new RecordId('case', 'testcase'),
  title,
  type: '临时会议',
  scheduled_time,
  status: '已安排',
  conference_link: 'http://example.com/meet',
  minutes_exist: false,
  attendees: [],
  attendee_ids: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

describe('useLiveMeetings Hook', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    liveCallback = null;

    // Setup default mock implementations
    mockQuery.mockImplementation(async (queryStr, _vars, liveCallbackFn) => {
      if (typeof queryStr === 'string' && queryStr.startsWith("LIVE SELECT")) {
        if (liveCallbackFn) {
          liveCallback = liveCallbackFn;
        }
        return [{ result: 'mock-live-query-id-' + Date.now() }];
      }
      return [{ result: [], status: 'OK' }];
    });

    mockSubscribeLive.mockImplementation((queryId, callback) => {
      liveCallback = callback;
      return Promise.resolve();
    });

    mockSelect.mockResolvedValue([]);
    mockKill.mockResolvedValue(undefined);
  });

  it('should fetch initial meetings and sort them', async () => {
    const initialMeetings = [
      createMockMeeting('1', '2023-01-01T10:00:00Z', 'Meeting A'),
      createMockMeeting('2', '2023-01-02T10:00:00Z', 'Meeting B'),
    ];
    mockSelect.mockResolvedValueOnce([...initialMeetings]);

    const { result } = renderHook(() => useLiveMeetings('case:test'));

    await waitFor(() => expect(mockSelect).toHaveBeenCalled(), { timeout: 1000 });
    expect(mockSelect).toHaveBeenCalledWith("meeting:(WHERE case_id = 'case:test' ORDER BY scheduled_time DESC)");
    
    await waitFor(() => expect(result.current.length).toBe(2), { timeout: 1000 });
    expect(result.current[0].title).toBe('Meeting B');
    expect(result.current[1].title).toBe('Meeting A');
  });

  it('should return an empty array if caseId is null', () => {
    const { result } = renderHook(() => useLiveMeetings(null));
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });

  it('should handle initial fetch error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSelect.mockRejectedValueOnce(new Error('Fetch failed'));
    const { result } = renderHook(() => useLiveMeetings('case:test-error'));

    await waitFor(() => expect(result.current).toEqual([]), { timeout: 1000 });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching meetings:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('should setup live query and process CREATE event', async () => {
    const meetingA = createMockMeeting('1', '2023-01-01T10:00:00Z', 'Meeting A');
    mockSelect.mockResolvedValueOnce([meetingA]);

    const { result } = renderHook(() => useLiveMeetings('case:test-live'));
    await waitFor(() => expect(result.current.length).toBe(1), { timeout: 1000 });

    expect(mockQuery).toHaveBeenCalledWith("LIVE SELECT * FROM meeting WHERE case_id = 'case:test-live';");
    expect(liveCallback).not.toBeNull();

    const meetingB = createMockMeeting('2', '2023-01-02T12:00:00Z', 'Meeting B');
    act(() => {
      if (liveCallback) liveCallback({ action: 'CREATE', result: meetingB });
    });

    expect(result.current.length).toBe(2);
    expect(result.current[0].title).toBe('Meeting B');
    expect(result.current[1].title).toBe('Meeting A');
  });

  it('should process UPDATE event and re-sort', async () => {
    const meetingA = createMockMeeting('1', '2023-01-01T10:00:00Z', 'Meeting A');
    const meetingB = createMockMeeting('2', '2023-01-02T12:00:00Z', 'Meeting B');
    mockSelect.mockResolvedValueOnce([meetingB, meetingA]);

    const { result } = renderHook(() => useLiveMeetings('case:test-live-update'));
    await waitFor(() => expect(result.current.length).toBe(2), { timeout: 1000 });
    expect(liveCallback).not.toBeNull();

    const updatedMeetingA = { ...meetingA, title: 'Meeting A Updated', scheduled_time: '2023-01-03T10:00:00Z' };
    act(() => {
      if (liveCallback) liveCallback({ action: 'UPDATE', result: updatedMeetingA });
    });
    
    expect(result.current.length).toBe(2);
    expect(result.current[0].title).toBe('Meeting A Updated');
    expect(result.current[1].title).toBe('Meeting B');
  });

  it('should process DELETE event', async () => {
    const meetingA = createMockMeeting('1', '2023-01-01T10:00:00Z', 'Meeting A');
    const meetingB = createMockMeeting('2', '2023-01-02T12:00:00Z', 'Meeting B');
    mockSelect.mockResolvedValueOnce([meetingB, meetingA]);

    const { result } = renderHook(() => useLiveMeetings('case:test-live-delete'));
    await waitFor(() => expect(result.current.length).toBe(2), { timeout: 1000 });
    expect(liveCallback).not.toBeNull();

    act(() => {
      if (liveCallback) liveCallback({ action: 'DELETE', result: meetingA });
    });

    expect(result.current.length).toBe(1);
    expect(result.current[0].title).toBe('Meeting B');
  });
  
  it('should kill live query on unmount', async () => {
    mockSelect.mockResolvedValueOnce([]);
    const { unmount } = renderHook(() => useLiveMeetings('case:test-unmount'));

    await waitFor(() => expect(mockQuery).toHaveBeenCalled(), { timeout: 1000 });
    
    unmount();
    
    // Wait a bit for cleanup to happen
    await waitFor(() => expect(mockKill).toHaveBeenCalled(), { timeout: 1000 });
  });

  it('should kill and restart live query if caseId changes', async () => {
    mockSelect.mockResolvedValue([]);

    const { rerender } = renderHook(({ caseId }) => useLiveMeetings(caseId), {
      initialProps: { caseId: 'case:test1' },
    });

    await waitFor(() => expect(mockQuery).toHaveBeenCalledWith(
      "LIVE SELECT * FROM meeting WHERE case_id = 'case:test1';"
    ), { timeout: 1000 });

    // Change caseId
    rerender({ caseId: 'case:test2' });

    await waitFor(() => expect(mockQuery).toHaveBeenCalledWith(
      "LIVE SELECT * FROM meeting WHERE case_id = 'case:test2';"
    ), { timeout: 1000 });

    expect(mockKill).toHaveBeenCalled();
  });
});
