import { renderHook, act, waitFor } from '@testing-library/react';
import { 
  useLiveTodaysSubmissionsCount, 
  useLiveTodaysReviewedClaimsCount,
  useLiveUsersOnlineByRoleChartData,
} from '../../../src/hooks/useLiveDashboardData';
import { teal, cyan, purple, grey } from '@mui/material/colors';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Uuid } from 'surrealdb';

const mockQuery = vi.fn();
const mockSubscribeLive = vi.fn();
const mockKill = vi.fn();

let liveCallback: ((action: string, data: any) => void) | undefined;

const mockClient = {
  query: mockQuery,
  subscribeLive: mockSubscribeLive,
  kill: mockKill,
};

const surrealClientState = {
  surreal: mockClient,
  isSuccess: true,
};

vi.mock('../../../src/contexts/SurrealProvider', () => ({
  useSurreal: () => surrealClientState,
}));

describe('useLiveDashboardData Hooks', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockSubscribeLive.mockReset();
    mockKill.mockReset();
    liveCallback = undefined;
    
    surrealClientState.isSuccess = true;
    mockKill.mockResolvedValue(undefined);

    mockSubscribeLive.mockImplementation((qid, callback) => {
      liveCallback = callback;
    });
  });

  describe('useLiveTodaysSubmissionsCount', () => {
    it('should fetch initial data and set up live subscription', async () => {
      const mockLiveQueryId = 'mock-live-qid' as unknown as Uuid;
      
      // Mock the data query
      mockQuery
        .mockResolvedValueOnce([{ result: [{ count: 10 }] }]) // Initial data fetch
        .mockResolvedValueOnce([{ result: mockLiveQueryId }]); // Live query setup

      const { result } = renderHook(() => useLiveTodaysSubmissionsCount('case:test'));
      
      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.data).toBe(10);
        expect(result.current.isLoading).toBe(false);
      });

      // Verify the queries were called correctly
      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenNthCalledWith(1, expect.stringContaining('SELECT count()'), { caseId: 'case:test' });
      expect(mockQuery).toHaveBeenNthCalledWith(2, 'LIVE SELECT * FROM claim WHERE case_id = $caseId;', { caseId: 'case:test' });
      
      // Verify live subscription was set up
      expect(mockSubscribeLive).toHaveBeenCalledWith(mockLiveQueryId, expect.any(Function));
    });

    it('should refetch data on live update', async () => {
      const mockLiveQueryId = 'mock-live-qid' as unknown as Uuid;
      
      // Initial setup
      mockQuery
        .mockResolvedValueOnce([{ result: [{ count: 10 }] }]) // Initial data fetch
        .mockResolvedValueOnce([{ result: mockLiveQueryId }]) // Live query setup
        .mockResolvedValueOnce([{ result: [{ count: 11 }] }]); // Refetch after live update

      const { result } = renderHook(() => useLiveTodaysSubmissionsCount('case:test'));
      
      await waitFor(() => expect(result.current.data).toBe(10));
      await waitFor(() => expect(liveCallback).toBeDefined());

      // Trigger live update
      act(() => {
        liveCallback?.('UPDATE', {});
      });

      await waitFor(() => {
        expect(result.current.data).toBe(11);
      });

      // Verify refetch was called
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('should handle cleanup on unmount', async () => {
      const mockLiveQueryId = 'mock-live-qid' as unknown as Uuid;
      
      mockQuery
        .mockResolvedValueOnce([{ result: [{ count: 10 }] }])
        .mockResolvedValueOnce([{ result: mockLiveQueryId }]);

      const { unmount } = renderHook(() => useLiveTodaysSubmissionsCount('case:test'));
      
      await waitFor(() => expect(mockSubscribeLive).toHaveBeenCalled());

      unmount();

      await waitFor(() => {
        expect(mockKill).toHaveBeenCalledWith(mockLiveQueryId);
      });
    });

    it('should handle null caseId', () => {
      const { result } = renderHook(() => useLiveTodaysSubmissionsCount(null));
      
      expect(result.current.data).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should handle disconnected client', () => {
      surrealClientState.isSuccess = false;
      
      const { result } = renderHook(() => useLiveTodaysSubmissionsCount('case:test'));
      
      expect(result.current.data).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should handle query errors', async () => {
      const error = new Error('Query failed');
      mockQuery.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useLiveTodaysSubmissionsCount('case:test'));
      
      await waitFor(() => {
        expect(result.current.error).toBe(error);
        expect(result.current.data).toBe(0);
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('useLiveTodaysReviewedClaimsCount', () => {
    it('should fetch and parse data correctly', async () => {
      const mockLiveQueryId = 'mock-live-qid' as unknown as Uuid;
      
      mockQuery
        .mockResolvedValueOnce([{ result: [{ count: 5 }] }])
        .mockResolvedValueOnce([{ result: mockLiveQueryId }]);

      const { result } = renderHook(() => useLiveTodaysReviewedClaimsCount('case:test'));

      await waitFor(() => {
        expect(result.current.data).toBe(5);
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('useLiveUsersOnlineByRoleChartData', () => {
    const testRoleColorMap: { [key: string]: string } = {
      '管理人': teal[400],
      '债权人': cyan[500],
      '管理员': purple[400],
    };
    const defaultRoleColor = grey[500];

    it('should fetch and parse chart data correctly', async () => {
      const mockRawData = [
        { role: '管理人', count: 5 },
        { role: '债权人', count: 50 }
      ];
      const mockLiveQueryId = 'mock-live-qid' as unknown as Uuid;
      
      mockQuery
        .mockResolvedValueOnce([{ result: mockRawData }])
        .mockResolvedValueOnce([{ result: mockLiveQueryId }]);

      const { result } = renderHook(() => useLiveUsersOnlineByRoleChartData('case:test-chart'));

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data[0]).toEqual({
        role: '管理人',
        count: 5,
        color: testRoleColorMap['管理人']
      });
      expect(result.current.data[1]).toEqual({
        role: '债权人',
        count: 50,
        color: testRoleColorMap['债权人']
      });
    });

    it('should handle empty data', async () => {
      const mockLiveQueryId = 'mock-live-qid' as unknown as Uuid;
      
      mockQuery
        .mockResolvedValueOnce([{ result: [] }])
        .mockResolvedValueOnce([{ result: mockLiveQueryId }]);

      const { result } = renderHook(() => useLiveUsersOnlineByRoleChartData('case:test-empty'));

      await waitFor(() => {
        expect(result.current.data).toEqual([]);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle unknown roles with default color', async () => {
      const mockRawData = [{ role: '未知角色', count: 1 }];
      const mockLiveQueryId = 'mock-live-qid' as unknown as Uuid;
      
      mockQuery
        .mockResolvedValueOnce([{ result: mockRawData }])
        .mockResolvedValueOnce([{ result: mockLiveQueryId }]);

      const { result } = renderHook(() => useLiveUsersOnlineByRoleChartData('case:test-unknown'));

      await waitFor(() => {
        expect(result.current.data[0].color).toBe(defaultRoleColor);
      });
    });
  });
});