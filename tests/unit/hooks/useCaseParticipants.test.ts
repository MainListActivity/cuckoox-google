import { renderHook, waitFor } from '@testing-library/react';
import { useCaseParticipants, Participant } from '@/src/hooks/useCaseParticipants';
import { RecordId } from 'surrealdb';
import { vi, describe, beforeEach, it, expect } from 'vitest';

// Mock the SurrealClient
const mockQuery = vi.fn();
const mockSelect = vi.fn();
const mockListenLive = vi.fn();
const mockKill = vi.fn();
const mockSubscribeLive = vi.fn();

// Define a stable mock client object
const mockSurrealDbClient = {
  query: mockQuery,
  select: mockSelect,
  listenLive: (...args: any[]) => {
    // Assuming liveCallback is defined elsewhere if needed for this hook's tests
    // if (typeof args[1] === 'function') liveCallback = args[1];
    return Promise.resolve({ id: 'mock-listen-live-ucp-' + Date.now(), close: vi.fn() });
  },
  subscribeLive: (...args: any[]) => {
    // if (typeof args[1] === 'function') liveCallback = args[1];
    return Promise.resolve({ id: 'mock-subscribe-live-ucp-' + Date.now(), close: vi.fn() });
  },
  kill: mockKill,
  status: 'connected' as const,
};

vi.mock('../../../src/contexts/SurrealProvider', () => ({
  useSurreal: () => ({
    client: mockSurrealDbClient,
    isConnected: true,
    isConnecting: false,
    isError: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signin: vi.fn(),
    signout: vi.fn(),
    setTokens: vi.fn(),
    clearTokens: vi.fn(),
    getStoredAccessToken: vi.fn(),
  }),
  useSurrealContext: () => ({
    client: mockSurrealDbClient,
    isConnected: true,
  }),
}));

describe('useCaseParticipants Hook', () => {
  beforeEach(() => {
    mockQuery.mockReset(); // This is fine as mockQuery is already a vi.fn()
  });

  it('should return initial loading state and empty participants', () => {
    mockQuery.mockImplementation(() => new Promise(() => {})); // Keep it pending
    const { result } = renderHook(() => useCaseParticipants('case:test'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.participants).toEqual([]);
  });

  it('should call client.query with correct queries and parameters', async () => {
    // Mock empty successful responses for both queries - 修复数据格式
    mockQuery.mockResolvedValueOnce([[]]); // For users query - 返回空数组的数组
    mockQuery.mockResolvedValueOnce([[]]); // For creditors query - 返回空数组的数组

    const caseId = 'case:test-query-check';
    const { result } = renderHook(() => useCaseParticipants(caseId));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Check users query - 更新查询字符串匹配
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("FROM $case_id->has_member"),
      { case_id: caseId }
    );
    // Check creditors query
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT id, name FROM creditor WHERE case_id = $case_id"),
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

    // 修复数据格式 - 返回数组的数组
    mockQuery.mockResolvedValueOnce([mockUserData]); // Users
    mockQuery.mockResolvedValueOnce([mockCreditorData]); // Creditors

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
    mockQuery.mockResolvedValueOnce([[]]); // Empty users - 修复格式
    mockQuery.mockResolvedValueOnce([mockCreditorData]); // Creditors - 修复格式

    const { result } = renderHook(() => useCaseParticipants('case:test-empty-users'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.participants.length).toBe(1);
    expect(result.current.participants[0]).toEqual(
      expect.objectContaining({ id: 'creditor:1', name: 'Creditor Corp', type: 'creditor', group: '债权人' })
    );
  });
  
  it('should handle empty results from creditors query', async () => {
    const mockUserData = [{ id: 'user:1', name: 'Alice Admin' }];
    mockQuery.mockResolvedValueOnce([mockUserData]); // Users - 修复格式
    mockQuery.mockResolvedValueOnce([[]]); // Empty creditors - 修复格式

    const { result } = renderHook(() => useCaseParticipants('case:test-empty-creditors'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.participants.length).toBe(1);
    expect(result.current.participants[0]).toEqual(
      expect.objectContaining({ id: 'user:1', name: 'Alice Admin', type: 'user', group: '系统用户' })
    );
  });

  it('should handle empty results from both queries', async () => {
    mockQuery.mockResolvedValue([[]]); // Both users and creditors return empty - 修复格式
    
    const { result } = renderHook(() => useCaseParticipants('case:test-empty-all'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.participants).toEqual([]);
  });

  it('should handle error from users query', async () => {
    const MOCK_ERROR = new Error('User query failed');
    mockQuery.mockImplementation((query: string) => {
      if (query.includes("has_member")) { // 更新条件匹配
        return Promise.reject(MOCK_ERROR);
      }
      return Promise.resolve([[{ id: 'creditor:1', name: 'Creditor Corp' }]]); // Creditors succeed - 修复格式
    });
    
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // Use vi.spyOn()
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
      return Promise.resolve([[{ id: 'user:1', name: 'Alice Admin' }]]); // Users succeed - 修复格式
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // Use vi.spyOn()
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

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // Use vi.spyOn()
    const { result } = renderHook(() => useCaseParticipants('case:test-general-error'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.participants).toEqual([]); // Should reset on general error

    // Check for both specific error messages
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching case users:', MOCK_ERROR);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching case creditors:', MOCK_ERROR);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2); // Ensure it was called exactly twice

    consoleErrorSpy.mockRestore();
  });

  it('should set isLoading to false after data fetching attempt (success)', async () => {
    mockQuery.mockResolvedValue([[]]); // 修复格式
    const { result } = renderHook(() => useCaseParticipants('case:test-loading-success'));
    expect(result.current.isLoading).toBe(true); // Initial
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('should set isLoading to false after data fetching attempt (failure)', async () => {
    mockQuery.mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => useCaseParticipants('case:test-loading-failure'));
    expect(result.current.isLoading).toBe(true); // Initial
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // Use vi.spyOn()
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
