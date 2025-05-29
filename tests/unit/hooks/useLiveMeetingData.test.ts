import { renderHook, act, waitFor } from '@testing-library/react';
import { useLiveMeetings, Meeting } from '../../../src/hooks/useLiveMeetingData';
import { RecordId } from 'surrealdb.js';

// Mock the SurrealClient
const mockSelect = jest.fn();
const mockQuery = jest.fn(); // For LIVE SELECT
const mockListenLive = jest.fn();
const mockKill = jest.fn();

// Store the callback passed to listenLive to simulate events
let liveCallback: ((actionEvent: { action: string; result: Meeting }) => void) | null = null;

jest.mock('../../../src/contexts/SurrealProvider', () => ({
  useSurrealClient: () => ({
    client: {
      select: mockSelect,
      query: mockQuery,
      listenLive: (...args: any[]) => {
        // Store the callback to be triggered manually
        liveCallback = args[1]; // The second argument to listenLive is the callback
        return Promise.resolve({ id: 'mock-live-query-id' }); // Return a promise for consistency if needed
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
    mockListenLive.mockReset();
    mockKill.mockReset();
    liveCallback = null;

    // Default successful mock implementations
    mockQuery.mockResolvedValue([{ result: 'mock-live-query-id', status: 'OK' }]); // For LIVE SELECT
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
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
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

    await waitFor(() => expect(mockQuery).toHaveBeenCalled()); // Wait for live query setup
    expect(mockKill).not.toHaveBeenCalled(); // Not yet
    unmount();
    expect(mockKill).toHaveBeenCalledWith('mock-live-query-id');
  });

  it('should kill and restart live query if caseId changes', async () => {
    mockSelect.mockResolvedValueOnce([]); // Initial fetch for case1
    const { rerender } = renderHook(({ caseId }) => useLiveMeetings(caseId), {
      initialProps: { caseId: 'case:test1' },
    });

    await waitFor(() => expect(mockQuery).toHaveBeenCalledWith("LIVE SELECT * FROM meeting WHERE case_id = 'case:test1';"));
    
    mockSelect.mockResolvedValueOnce([]); // For case2
    mockQuery.mockClear(); // Clear previous LIVE SELECT call
    mockKill.mockClear(); // Clear previous kill calls

    rerender({ caseId: 'case:test2' });

    await waitFor(() => expect(mockKill).toHaveBeenCalledWith('mock-live-query-id'));
    await waitFor(() => expect(mockSelect).toHaveBeenCalledWith("meeting:(WHERE case_id = 'case:test2' ORDER BY scheduled_time DESC)"));
    await waitFor(() => expect(mockQuery).toHaveBeenCalledWith("LIVE SELECT * FROM meeting WHERE case_id = 'case:test2';"));
  });

  it('should handle live query setup failure', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSelect.mockResolvedValueOnce([]);
    mockQuery.mockRejectedValueOnce(new Error('Live query setup failed')); // Fail LIVE SELECT

    const { result } = renderHook(() => useLiveMeetings('case:test-live-fail'));
    
    await waitFor(() => expect(result.current).toEqual([])); // Should still return initial data or empty
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error setting up live meetings query:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });
});
