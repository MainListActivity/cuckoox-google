import { renderHook, act, waitFor } from '@testing-library/react';
import { 
  useLiveTodaysSubmissionsCount, 
  useLiveTodaysReviewedClaimsCount,
  useLiveUsersOnlineByRoleChartData,
  // Import BarChartDataPoint if needed for direct comparison, or rely on toMatchObject
} from '../../../src/hooks/useLiveDashboardData';
// Assuming default colors are imported/defined within useLiveDashboardData for roleColorMap
// For testing, we might need to export them or re-define for assertion if not exported
import { teal, cyan, purple, grey } from '@mui/material/colors';


import { vi } from 'vitest'; // Import vi

// Mock the SurrealClient
const mockQuery = vi.fn();
const mockListenLive = vi.fn();
const mockKill = vi.fn();
const mockSubscribeLive = vi.fn(); // Added for completeness, though createLiveMetricHook uses listenLive

vi.mock('../../../src/contexts/SurrealProvider', () => ({
  useSurrealClient: () => ({
    client: {
      query: mockQuery,
      listenLive: mockListenLive, // createLiveMetricHook uses listenLive
      subscribeLive: mockSubscribeLive, // For other live hooks if they use it
      kill: mockKill,
      isConnected: true,
    },
    isConnected: true,
  }),
}));

// Helper to wrap hooks for providers if needed, though our mock handles it for SurrealProvider
// const wrapper = ({ children }) => <SurrealProvider client={mockedClient}>{children}</SurrealProvider>;


describe('useLiveDashboardData Hooks', () => {
  beforeEach(() => {
    // Reset mock implementations and call history
    mockQuery.mockReset();
    mockListenLive.mockReset();
    mockKill.mockReset();
    mockSubscribeLive.mockReset(); // Reset new mock
    
    // Default behavior for listenLive and kill for simplicity in tests not focusing on them
    // listenLive (and subscribeLive) should return an object with a close method for the live query itself
    mockListenLive.mockResolvedValue({ id: 'mock-listen-live-id', close: vi.fn() });
    mockSubscribeLive.mockResolvedValue({ id: 'mock-subscribe-live-id', close: vi.fn() });
    mockKill.mockResolvedValue(undefined);
  });

  describe('useLiveTodaysSubmissionsCount', () => {
    const expectedQuery = "\n    SELECT count() \n    FROM claim \n    WHERE case_id = $caseId AND string::slice(created_at, 0, 10) = string::slice(time::now(), 0, 10) \n    GROUP ALL;\n  ";

    it('should return initial loading state and default data', () => {
      mockQuery.mockImplementation(() => new Promise(() => {})); // Keep it pending
      const { result } = renderHook(() => useLiveTodaysSubmissionsCount('case:test'));
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBe(0); // Default data
    });

    it('should fetch data, call query with correct SQL, and update loading state', async () => {
      mockQuery.mockResolvedValueOnce([{ result: [{ count: 10 }], status: 'OK' }]);
      const { result } = renderHook(() => useLiveTodaysSubmissionsCount('case:test'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("string::slice(created_at, 0, 10) = string::slice(time::now(), 0, 10)"),
        { caseId: 'case:test' } // Corrected: No limit parameter for this specific query
      );
      expect(result.current.data).toBe(10);
    });
    
    // This test is a bit redundant as the one above already checks params.
    // The main point is that 'limit' is NOT added if $limit is not in SQL.
    // If we wanted to test the $limit case, we'd need a different hook or modify this one's query.
    // For now, ensuring the existing test is correct is the priority.
    // it('should use correct query parameters including default limit if $limit were present', async () => {
    //      mockQuery.mockResolvedValueOnce([{ result: [{ count: 3 }], status: 'OK' }]);
    //      const { result } = renderHook(() => useLiveTodaysSubmissionsCount('case:test-limit-check'));
    //      await waitFor(() => expect(result.current.isLoading).toBe(false));
    //      expect(mockQuery).toHaveBeenCalledWith(
    //         expect.any(String),
    //         expect.objectContaining({ caseId: 'case:test-limit-check' })
    //      );
    // });


    it('should return 0 if query result is empty array', async () => {
      mockQuery.mockResolvedValueOnce([{ result: [], status: 'OK' }]);
      const { result } = renderHook(() => useLiveTodaysSubmissionsCount('case:test'));
      
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.data).toBe(0);
    });
    
    it('should return 0 if query result is null', async () => {
      mockQuery.mockResolvedValueOnce([{ result: null, status: 'OK' }]);
      const { result } = renderHook(() => useLiveTodaysSubmissionsCount('case:test'));
      
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.data).toBe(0);
    });

    it('should set error state if query fails', async () => {
      const MOCK_ERROR = new Error('Query failed');
      mockQuery.mockRejectedValueOnce(MOCK_ERROR);
      const { result } = renderHook(() => useLiveTodaysSubmissionsCount('case:test-error'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error).toEqual(MOCK_ERROR); // Changed .toBe to .toEqual for error object
      expect(result.current.data).toBe(0); // Should reset to default on error
    });
  });

  describe('useLiveTodaysReviewedClaimsCount', () => {
    const expectedQuery = "\n    SELECT count() \n    FROM claim \n    WHERE case_id = $caseId AND reviewed_at IS NOT NULL AND string::slice(reviewed_at, 0, 10) = string::slice(time::now(), 0, 10) \n    GROUP ALL;\n  ";

    it('should return initial loading state and default data', () => {
      mockQuery.mockImplementation(() => new Promise(() => {})); // Keep it pending
      const { result } = renderHook(() => useLiveTodaysReviewedClaimsCount('case:test'));
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBe(0);
    });

    it('should fetch data, call query with correct SQL, and update loading state', async () => {
      mockQuery.mockResolvedValueOnce([{ result: [{ count: 7 }], status: 'OK' }]);
      const { result } = renderHook(() => useLiveTodaysReviewedClaimsCount('case:test'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("reviewed_at IS NOT NULL AND string::slice(reviewed_at, 0, 10) = string::slice(time::now(), 0, 10)"),
        { caseId: 'case:test' } // This query also does not use $limit
      );
      expect(result.current.data).toBe(7);
    });

    it('should return 0 if query result is empty', async () => {
      mockQuery.mockResolvedValueOnce([{ result: [], status: 'OK' }]);
      const { result } = renderHook(() => useLiveTodaysReviewedClaimsCount('case:test'));
      
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.data).toBe(0);
    });
  });

  describe('useLiveUsersOnlineByRoleChartData (Parsing Logic)', () => {
    // Define roleColorMap as it is in the original file for assertion
    const testRoleColorMap: { [key: string]: string } = {
      '管理人': teal[400],
      '债权人': cyan[500],
      '管理员': purple[400],
    };
    const defaultRoleColor = grey[500];

    it('should correctly parse raw query results into BarChartDataPoint[]', async () => {
      const mockRawData = [
        { role: '管理人', count: 5 },
        { role: '债权人', count: 50 },
        { role: '未知角色来源', count: 2 }, // Test unmapped role
        { count: 3 }, // Test missing role field
      ];
      mockQuery.mockResolvedValueOnce([{ result: mockRawData, status: 'OK' }]);
      const { result } = renderHook(() => useLiveUsersOnlineByRoleChartData('case:test-chart'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      // Ensure the mockQuery was called before checking the result.data
      expect(mockQuery).toHaveBeenCalled();

      expect(result.current.data).toEqual([
        { role: '管理人', count: 5, color: testRoleColorMap['管理人'] },
        { role: '债权人', count: 50, color: testRoleColorMap['债权人'] },
        { role: '未知角色来源', count: 2, color: defaultRoleColor }, // Unmapped role gets default color
        { role: '未知角色', count: 3, color: defaultRoleColor }, // Missing role field gets '未知角色' and default color
      ]);
    });

    it('should return an empty array if raw data is empty', async () => {
      mockQuery.mockResolvedValueOnce([{ result: [], status: 'OK' }]);
      const { result } = renderHook(() => useLiveUsersOnlineByRoleChartData('case:test-chart-empty'));
      
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.data).toEqual([]);
    });
    
    it('should return an empty array if raw data is null', async () => {
      mockQuery.mockResolvedValueOnce([{ result: null, status: 'OK' }]);
      const { result } = renderHook(() => useLiveUsersOnlineByRoleChartData('case:test-chart-null'));
      
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.data).toEqual([]);
    });
  });
});

// Note on `waitForNextUpdate`:
// `@testing-library/react`'s `renderHook` typically uses `waitFor` for async updates.
// Example: await waitFor(() => expect(result.current.data).toBe(expectedValue));
// The structure above uses `waitFor` which is the standard way with RTL's renderHook.
// The `act` wrapper is implicitly used by `renderHook` and its update cycle,
// but explicit `act` might be needed for complex scenarios involving multiple updates
// or direct interactions not covered by `waitFor`. For these tests, `waitFor` should suffice.
// The original example's `waitForNextUpdate` is more common with the older `@testing-library/react-hooks`.
// The provided solution uses `waitFor` from `@testing-library/react`.

// Note on query parameter for limit:
// The `createLiveMetricHook` has logic: `if (finalQuery.includes('$limit')) { queryParams.limit = limit || 5; }`
// For hooks like `useLiveTodaysSubmissionsCount` whose queries *don't* include `$limit`,
// the `limit` parameter will not be added to `queryParams` by the factory.
// This is why the `toHaveBeenCalledWith` for these hooks only checks for `caseId`.
// The test "should use correct query parameters including default limit if $limit were present"
// was initially intended to verify this, but it's implicitly correct by the factory's logic.
// The current assertion for `useLiveTodaysSubmissionsCount` correctly reflects that `limit` is not passed.
// If a hook *did* use `$limit` in its query string, then we would assert `limit: providedLimit || 5`.
// For `useLiveRecentSubmissions` (not tested here but modified previously), it *does* use `$limit`,
// so its tests *would* check for `queryParams.limit`.
// Example: `expect(mockQuery).toHaveBeenCalledWith(expect.any(String), { caseId: 'case:test', limit: 5 });`
// if `limit` was not passed to the hook, or `limit: providedLimit` if it was.
