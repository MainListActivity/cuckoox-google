import { renderHook, act, waitFor } from '@testing-library/react';
import { useLiveMeetings, Meeting } from '@/src/hooks/useLiveMeetingData';
import { RecordId } from 'surrealdb'; // Changed from surrealdb.js
import { vi } from 'vitest'; // Import vi

// Mock the SurrealClient
const mockSelect = vi.fn(); // Use vi.fn()
const mockQuery = vi.fn(); // Use vi.fn() For LIVE SELECT
const mockListenLive = vi.fn(); // Use vi.fn()
const mockKill = vi.fn(); // Use vi.fn()

// Store the callback passed to listenLive to simulate events
let liveCallback: ((actionEvent: { action: string; result: Meeting }) => void) | null = null;

vi.mock('../../../src/contexts/SurrealProvider', () => ({ // Use vi.mock()
  useSurrealClient: () => ({
    client: {
      select: mockSelect,
      query: mockQuery,
      listenLive: (...args: any[]) => { // This is if client.listenLive is directly used by the hook
        liveCallback = args[1];
        return Promise.resolve({ id: 'mock-listen-live-id', close: vi.fn() });
      },
      subscribeLive: (...args: any[]) => { // This is likely what client.query("LIVE SELECT...") uses
        liveCallback = args[1]; // callback is usually the second arg for subscribeLive too
        return Promise.resolve({ // The object returned by subscribeLive
          id: 'mock-subscribe-live-id', // A mock ID for the live query
          close: vi.fn(), // Mock the close method for the live query object
        });
      },
      kill: mockKill,
      isConnected: true,
    },
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
    mockSelect.mockReset();
    mockQuery.mockReset();
    mockListenLive.mockReset(); // listenLive might not be directly used by this hook if query handles LIVE SELECT
    mockKill.mockReset();
    liveCallback = null;

    // Default successful mock implementations
    // Specific mock for LIVE SELECT query in tests that need it.
    mockQuery.mockImplementation(async (queryStr, _vars, liveCallbackFn) => {
      if (typeof queryStr === 'string' && queryStr.startsWith("LIVE SELECT")) {
        if (liveCallbackFn) {
          liveCallback = liveCallbackFn; // Capture the callback
        }
        // Return the object structure expected by the hook for a live query setup
        return { id: 'mock-live-query-id-' + Date.now(), close: vi.fn() };
      }
      // Fallback for other types of queries (e.g., initial data fetch if separate)
      // For this hook, initial data is fetched by client.select
      return [{ result: [], status: 'OK' }];
    });
    mockSelect.mockResolvedValue([]); // Default for initial select
    mockKill.mockResolvedValue(undefined);
  });

  it('should fetch initial meetings and sort them', async () => {
    const initialMeetings = [
      createMockMeeting('1', '2023-01-01T10:00:00Z', 'Meeting A'),
      createMockMeeting('2', '2023-01-02T10:00:00Z', 'Meeting B'), // Should be first after sort
    ];
    mockSelect.mockResolvedValueOnce([...initialMeetings]); // Return a copy to avoid mutation issues

    const { result } = renderHook(() => useLiveMeetings('case:test'));

    await waitFor(() => expect(mockSelect).toHaveBeenCalled());
    expect(mockSelect).toHaveBeenCalledWith("meeting:(WHERE case_id = 'case:test' ORDER BY scheduled_time DESC)");
    
    await waitFor(() => expect(result.current.length).toBe(2));
    expect(result.current[0].title).toBe('Meeting B'); // Sorted DESC
    expect(result.current[1].title).toBe('Meeting A');
  });

  it('should return an empty array if caseId is null', () => {
    const { result } = renderHook(() => useLiveMeetings(null));
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled(); // For LIVE SELECT
    expect(result.current).toEqual([]);
  });

  it('should handle initial fetch error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // Use vi.spyOn()
    mockSelect.mockRejectedValueOnce(new Error('Fetch failed'));
    const { result } = renderHook(() => useLiveMeetings('case:test-error'));

    await waitFor(() => expect(result.current).toEqual([]));
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching meetings:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('should setup live query and process CREATE event', async () => {
    const meetingA = createMockMeeting('1', '2023-01-01T10:00:00Z', 'Meeting A');
    mockSelect.mockResolvedValueOnce([meetingA]); // Initial data

    const { result } = renderHook(() => useLiveMeetings('case:test-live'));
    await waitFor(() => expect(result.current.length).toBe(1)); // Initial load done

    expect(mockQuery).toHaveBeenCalledWith("LIVE SELECT * FROM meeting WHERE case_id = 'case:test-live';");
    expect(liveCallback).not.toBeNull();

    const meetingB = createMockMeeting('2', '2023-01-02T12:00:00Z', 'Meeting B');
    act(() => {
      if (liveCallback) liveCallback({ action: 'CREATE', result: meetingB });
    });

    expect(result.current.length).toBe(2);
    expect(result.current[0].title).toBe('Meeting B'); // Newest meeting first due to sort
    expect(result.current[1].title).toBe('Meeting A');
  });

  it('should process UPDATE event and re-sort', async () => {
    const meetingA = createMockMeeting('1', '2023-01-01T10:00:00Z', 'Meeting A');
    const meetingB = createMockMeeting('2', '2023-01-02T12:00:00Z', 'Meeting B');
    mockSelect.mockResolvedValueOnce([meetingB, meetingA]); // Initial: B, A

    const { result } = renderHook(() => useLiveMeetings('case:test-live-update'));
    await waitFor(() => expect(result.current.length).toBe(2));
    expect(liveCallback).not.toBeNull();

    const updatedMeetingA = { ...meetingA, title: 'Meeting A Updated', scheduled_time: '2023-01-03T10:00:00Z' };
    act(() => {
      if (liveCallback) liveCallback({ action: 'UPDATE', result: updatedMeetingA });
    });
    
    expect(result.current.length).toBe(2);
    expect(result.current[0].title).toBe('Meeting A Updated'); // Now newest
    expect(result.current[1].title).toBe('Meeting B');
  });

  it('should process DELETE event', async () => {
    const meetingA = createMockMeeting('1', '2023-01-01T10:00:00Z', 'Meeting A');
    const meetingB = createMockMeeting('2', '2023-01-02T12:00:00Z', 'Meeting B');
    mockSelect.mockResolvedValueOnce([meetingB, meetingA]);

    const { result } = renderHook(() => useLiveMeetings('case:test-live-delete'));
    await waitFor(() => expect(result.current.length).toBe(2));
    expect(liveCallback).not.toBeNull();

    act(() => {
      // For DELETE, the result in SurrealDB's event might be just the ID, or the full object.
      // The hook filters by `m.id !== meetingData.id`. Let's assume meetingData contains at least `id`.
      if (liveCallback) liveCallback({ action: 'DELETE', result: meetingA });
    });

    expect(result.current.length).toBe(1);
    expect(result.current[0].title).toBe('Meeting B');
  });
  
  it('should kill live query on unmount', async () => {
    mockSelect.mockResolvedValueOnce([]);
    const { unmount } = renderHook(() => useLiveMeetings('case:test-unmount'));

    await waitFor(() => expect(mockQuery).toHaveBeenCalled());
    const liveQueryId = (await mockQuery.mock.results[0].value).id; // Get the ID from the resolved live query
    expect(mockKill).not.toHaveBeenCalled();
    unmount();
    expect(mockKill).toHaveBeenCalledWith(liveQueryId);
  });

  it('should kill and restart live query if caseId changes', async () => {
    let currentLiveQueryId = '';
    mockSelect.mockResolvedValueOnce([]);

    // Refined mockQuery for this specific test to capture live query IDs
    mockQuery.mockImplementation(async (queryStr, _vars, liveCb) => {
      if (typeof queryStr === 'string' && queryStr.startsWith("LIVE SELECT")) {
        if (liveCb) liveCallback = liveCb;
        currentLiveQueryId = 'live-id-' + queryStr.split("'")[1]; // Generate unique ID based on caseId
        return { id: currentLiveQueryId, close: vi.fn() };
      }
      return [{ result: [], status: 'OK' }];
    });

    const { rerender } = renderHook(({ caseId }) => useLiveMeetings(caseId), {
      initialProps: { caseId: 'case:test1' },
    });

    await waitFor(() => expect(mockQuery).toHaveBeenCalledWith("LIVE SELECT * FROM meeting WHERE case_id = 'case:test1';", undefined, expect.any(Function)));
    const firstLiveQueryId = currentLiveQueryId;
    
    mockSelect.mockResolvedValueOnce([]);
    // mockQuery is already set up to generate new IDs

    rerender({ caseId: 'case:test2' });

    await waitFor(() => expect(mockKill).toHaveBeenCalledWith(firstLiveQueryId));
    await waitFor(() => expect(mockSelect).toHaveBeenCalledWith("meeting:(WHERE case_id = 'case:test2' ORDER BY scheduled_time DESC)"));
    await waitFor(() => expect(mockQuery).toHaveBeenCalledWith("LIVE SELECT * FROM meeting WHERE case_id = 'case:test2';", undefined, expect.any(Function)));
    expect(currentLiveQueryId).not.toBe(firstLiveQueryId); // Ensure a new live query ID was generated
  });

  it('should handle live query setup failure', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSelect.mockResolvedValueOnce([]);
    // Specific mock for this test to make LIVE SELECT fail
    mockQuery.mockImplementation(async (queryStr) => {
      if (typeof queryStr === 'string' && queryStr.startsWith("LIVE SELECT")) {
        throw new Error('Live query setup failed');
      }
      return [{result: [], status: 'OK'}]; // for other queries if any
    });

    const { result } = renderHook(() => useLiveMeetings('case:test-live-fail'));
    
    await waitFor(() => expect(result.current.isLoading).toBe(false)); // isLoading should become false
    expect(result.current).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error setting up live meetings query:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });
});
