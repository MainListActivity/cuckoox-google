import { renderHook, waitFor } from '@testing-library/react';
import { useCaseParticipants, Participant } from './useCaseParticipants';
import { RecordId } from 'surrealdb.js';

// Mock the SurrealClient
const mockQuery = jest.fn();

jest.mock('../contexts/SurrealProvider', () => ({
  useSurrealClient: () => ({
    client: {
      query: mockQuery,
      // Mock other client properties/methods if the hook factory uses them
      isConnected: true, 
    },
    isConnected: true,
  }),
}));

describe('useCaseParticipants Hook', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('should return initial loading state and empty participants', () => {
    mockQuery.mockImplementation(() => new Promise(() => {})); // Keep it pending
    const { result } = renderHook(() => useCaseParticipants('case:test'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.participants).toEqual([]);
  });

  it('should call client.query with correct queries and parameters', async () => {
    // Mock empty successful responses for both queries
    mockQuery.mockResolvedValueOnce([{ result: [], status: 'OK' }]); // For users query
    mockQuery.mockResolvedValueOnce([{ result: [], status: 'OK' }]); // For creditors query

    const caseId = 'case:test-query-check';
    const { result } = renderHook(() => useCaseParticipants(caseId));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Check users query
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT id, name FROM user WHERE id IN (SELECT user FROM user_case_roles WHERE case = $case_id);"),
      { case_id: caseId }
    );
    // Check creditors query
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT id, name FROM creditor WHERE case_id = $case_id;"),
      { case_id: caseId }
    );
  });

  it('should combine and transform user and creditor data correctly', async () => {
    const mockUserData: { id: string | RecordId; name: string }[] = [
      { id: 'user:1', name: 'Alice Admin' },
      { id: 'user:2', name: 'Bob Manager' },
    ];
    const mockCreditorData: { id: string | RecordId; name: string }[] = [
      { id: 'creditor:1', name: 'Creditor Corp' },
    ];

    mockQuery.mockResolvedValueOnce([{ result: mockUserData, status: 'OK' }]); // Users
    mockQuery.mockResolvedValueOnce([{ result: mockCreditorData, status: 'OK' }]); // Creditors

    const { result } = renderHook(() => useCaseParticipants('case:test-data'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const expectedParticipants: Participant[] = [
      { id: 'user:1', name: 'Alice Admin', type: 'user', group: '系统用户' },
      { id: 'user:2', name: 'Bob Manager', type: 'user', group: '系统用户' },
      { id: 'creditor:1', name: 'Creditor Corp', type: 'creditor', group: '债权人' },
    ];
    expect(result.current.participants).toEqual(expect.arrayContaining(expectedParticipants));
    expect(result.current.participants.length).toBe(expectedParticipants.length);
  });

  it('should handle empty results from users query', async () => {
    const mockCreditorData = [{ id: 'creditor:1', name: 'Creditor Corp' }];
    mockQuery.mockResolvedValueOnce([{ result: [], status: 'OK' }]); // Empty users
    mockQuery.mockResolvedValueOnce([{ result: mockCreditorData, status: 'OK' }]); // Creditors

    const { result } = renderHook(() => useCaseParticipants('case:test-empty-users'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.participants.length).toBe(1);
    expect(result.current.participants[0]).toEqual(
      expect.objectContaining({ id: 'creditor:1', name: 'Creditor Corp', type: 'creditor', group: '债权人' })
    );
  });
  
  it('should handle empty results from creditors query', async () => {
    const mockUserData = [{ id: 'user:1', name: 'Alice Admin' }];
    mockQuery.mockResolvedValueOnce([{ result: mockUserData, status: 'OK' }]); // Users
    mockQuery.mockResolvedValueOnce([{ result: [], status: 'OK' }]); // Empty creditors

    const { result } = renderHook(() => useCaseParticipants('case:test-empty-creditors'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.participants.length).toBe(1);
    expect(result.current.participants[0]).toEqual(
      expect.objectContaining({ id: 'user:1', name: 'Alice Admin', type: 'user', group: '系统用户' })
    );
  });

  it('should handle empty results from both queries', async () => {
    mockQuery.mockResolvedValue([{ result: [], status: 'OK' }]); // Both users and creditors return empty
    
    const { result } = renderHook(() => useCaseParticipants('case:test-empty-all'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.participants).toEqual([]);
  });

  it('should handle error from users query', async () => {
    const MOCK_ERROR = new Error('User query failed');
    mockQuery.mockImplementation((query: string) => {
      if (query.includes("FROM user")) {
        return Promise.reject(MOCK_ERROR);
      }
      return Promise.resolve([{ result: [{ id: 'creditor:1', name: 'Creditor Corp' }], status: 'OK' }]); // Creditors succeed
    });
    
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useCaseParticipants('case:test-user-error'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.participants.length).toBe(1); // Only creditors should be present
    expect(result.current.participants[0].type).toBe('creditor');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching case users:', MOCK_ERROR);
    consoleErrorSpy.mockRestore();
  });

  it('should handle error from creditors query', async () => {
    const MOCK_ERROR = new Error('Creditor query failed');
    mockQuery.mockImplementation((query: string) => {
      if (query.includes("FROM creditor")) {
        return Promise.reject(MOCK_ERROR);
      }
      return Promise.resolve([{ result: [{ id: 'user:1', name: 'Alice Admin' }], status: 'OK' }]); // Users succeed
    });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useCaseParticipants('case:test-creditor-error'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.participants.length).toBe(1); // Only users should be present
    expect(result.current.participants[0].type).toBe('user');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching case creditors:', MOCK_ERROR);
    consoleErrorSpy.mockRestore();
  });
  
  it('should handle general error if one of the queries fails catastrophically (not individual try/catch)', async () => {
    const MOCK_ERROR = new Error('Catastrophic query failure');
    mockQuery.mockRejectedValue(MOCK_ERROR); // General failure for all queries

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useCaseParticipants('case:test-general-error'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.participants).toEqual([]); // Should reset on general error
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching case participants:', MOCK_ERROR);
    consoleErrorSpy.mockRestore();
  });

  it('should set isLoading to false after data fetching attempt (success)', async () => {
    mockQuery.mockResolvedValue([{ result: [], status: 'OK' }]);
    const { result } = renderHook(() => useCaseParticipants('case:test-loading-success'));
    expect(result.current.isLoading).toBe(true); // Initial
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('should set isLoading to false after data fetching attempt (failure)', async () => {
    mockQuery.mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => useCaseParticipants('case:test-loading-failure'));
    expect(result.current.isLoading).toBe(true); // Initial
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    consoleErrorSpy.mockRestore();
  });
  
  it('should not fetch if caseId is null', () => {
    const { result } = renderHook(() => useCaseParticipants(null));
    expect(mockQuery).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.participants).toEqual([]);
  });
});
