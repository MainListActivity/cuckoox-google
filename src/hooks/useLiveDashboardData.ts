import { useState, useEffect, useCallback } from 'react';
import { useSurreal } from '@/src/contexts/SurrealProvider';
import { Uuid } from 'surrealdb';

// Generic type for count results
interface CountResult {
  count: number;
}

// Generic type for sum results (SurrealDB's math::sum returns an array with the aliased field)
interface SumResult {
  [key: string]: number | null; // e.g., { total_amount: 12345 } or { total_amount: null }
}

// Generic type for distinct count results
import { green, yellow, red as muiRed, blue, orange, purple, cyan, teal } from '@mui/material/colors'; // For chart colors

interface DistinctCountResult {
  distinct_claimants: number; // Assuming the alias is distinct_claimants
}

// --- Chart Data Point Types ---
// Import grey for default colors
import { grey } from '@mui/material/colors';

export interface PieChartDataPoint {
  id: string | number; // Unique ID for the slice
  value: number;
  label: string;
  color: string;
}

export interface BarChartDataPoint { // For User Online Distribution
  role: string;
  count: number;
  color: string;
}

export interface LineChartDataPoint { // For Daily Claims Trend
  date: string; // e.g., "MM-DD"
  count: number;
  // amount?: number; // Amount can be optional or derived if needed elsewhere
}

// Type for raw query results for grouped status/nature
interface GroupedCountResult {
  status?: string; // For claimsByStatus
  nature?: string; // For claimsByNature
  day?: string;    // For dailyClaimsTrend
  count: number;
}


// --- Types for Dynamic List Data ---
export interface RecentSubmissionItem {
  id: string; // claim record id
  claimId: string; // business claim id
  claimantName: string;
  amount: number;
  time: string; // Formatted time string
  type: 'New' | 'Updated'; // Assuming we can determine this, or default to 'New'
}

export interface RecentReviewActionItem {
  id: string; // claim record id
  claimId: string;
  action: string; // e.g., "审核通过", "已驳回"
  reviewerName: string;
  reviewedAmount: number;
  time: string; // Formatted time string
}

// Raw query result types for lists
interface RawRecentSubmission {
  id: string;
  claim_id: string;
  claimant_name: string;
  amount: number;
  created_at: string; // ISO string
  // type is hardcoded or derived in parser
}

interface RawRecentReviewAction {
  id: string;
  claim_id: string;
  status: string; // To be mapped to 'action'
  reviewed_by: string; // To be mapped to 'reviewerName'
  approved_amount: number; // To be mapped to 'reviewedAmount'
  reviewed_at: string; // ISO string, to be mapped to 'time'
}


// Factory function to create live metric hooks
function createLiveMetricHook<TResultType, TDataType>(
  metricQueryFn: (caseId: string, limit?: number) => string,
  parseResult: (queryResult: any, caseId: string | null, limit?: number) => TDataType, // eslint-disable-line @typescript-eslint/no-explicit-any
  defaultValue: TDataType,
  debugName: string = "metric"
) {
  // Define the return type for the hook
  type LiveMetricReturn = {
    data: TDataType;
    isLoading: boolean;
    error: any | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  };

  // The hook itself can now accept additional parameters like 'limit'
  return function useLiveMetric(caseId: string | null, limit?: number): LiveMetricReturn {
    const { surreal: client, isSuccess: isConnected } = useSurreal();
    const [metricValue, setMetricValue] = useState<TDataType>(defaultValue);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

    const fetchMetric = useCallback(async (currentCaseId: string) => {
      if (!client || !isConnected) {
        return;
      }
      
      try {
        const finalQuery = metricQueryFn(currentCaseId, limit);
        const queryParams: { [key: string]: string | number } = { caseId: currentCaseId };
        
        if (finalQuery.includes('$limit')) {
          queryParams.limit = limit || 5;
        }

        const result = await client.query<[TResultType[]]>(finalQuery, queryParams);

        if (result && result[0]) {
          const parsed = parseResult(result[0], currentCaseId, limit);
          setMetricValue(parsed);
        } else {
          setMetricValue(defaultValue);
        }
        setError(null);
      } catch (e) {
        console.error(`Error fetching ${debugName} for ${currentCaseId}:`, e);
        setError(e);
        setMetricValue(defaultValue);
      } finally {
        setIsLoading(false);
      }
    }, [client, isConnected, limit]);

    useEffect(() => {
      if (!client || !isConnected || !caseId) {
        setMetricValue(defaultValue);
        setIsLoading(false);
        return;
      }

      let isMounted = true;
      let liveQueryId: Uuid | null = null;

      const setupLiveSubscription = async () => {
        try {
          // Step 1: Fetch initial data
          await fetchMetric(caseId);
          if (!isMounted) return;

          // Step 2: Set up the live query for the claim table
          const liveSelectQuery = `LIVE SELECT * FROM claim WHERE case_id = $caseId;`;
          const queryResponse = await client.query<[Uuid]>(liveSelectQuery, { caseId });
          
          if (queryResponse && queryResponse[0]) {
            liveQueryId = queryResponse[0];
            
            // Step 3: Subscribe to live events
            client.subscribeLive(liveQueryId, (_action, _data) => {
              if (!isMounted) return;
              // Re-fetch the metric when any claim changes
              fetchMetric(caseId);
            });
          }
        } catch (err) {
          if (!isMounted) return;
          console.error(`Error setting up live subscription for ${debugName}:`, err);
          setError(err);
        }
      };

      setupLiveSubscription();

      // Cleanup function
      return () => {
        isMounted = false;
        if (liveQueryId && client) {
          client.kill(liveQueryId).catch(killError => {
            console.error(`Error killing live query ${liveQueryId} for ${debugName}:`, killError);
          });
        }
      };
    }, [caseId, client, isConnected, limit, fetchMetric]);

    return { data: metricValue, isLoading, error };
  };
}

// Specific hooks using the factory

// 1. useLiveClaimCountForCase
export const useLiveClaimCountForCase = createLiveMetricHook<CountResult, number>(
  (_caseId, _limit) => 'SELECT count() FROM claim WHERE case_id = $caseId GROUP ALL;',
  (result: CountResult[], _caseId, _limit) => (result && result.length > 0 ? result[0].count : 0),
  0,
  "TotalClaimCount"
);

// 2. useLiveTotalClaimAmount
export const useLiveTotalClaimAmount = createLiveMetricHook<SumResult, number>(
  (_caseId, _limit) => 'SELECT math::sum(amount) AS total_amount FROM claim WHERE case_id = $caseId GROUP ALL;',
  (result: SumResult[], _caseId, _limit) => (result && result.length > 0 && result[0].total_amount !== null ? result[0].total_amount : 0),
  0,
  "TotalClaimAmount"
);

// 3. useLiveApprovedClaimAmount
export const useLiveApprovedClaimAmount = createLiveMetricHook<SumResult, number>(
  (_caseId, _limit) => "SELECT math::sum(approved_amount) AS approved_total FROM claim WHERE case_id = $caseId AND status = '审核通过' GROUP ALL;",
  (result: SumResult[], _caseId, _limit) => (result && result.length > 0 && result[0].approved_total !== null ? result[0].approved_total : 0),
  0,
  "ApprovedClaimAmount"
);

// 4. useLivePendingClaimAmount
export const useLivePendingClaimAmount = createLiveMetricHook<SumResult, number>(
  (_caseId, _limit) => "SELECT math::sum(amount) AS pending_total FROM claim WHERE case_id = $caseId AND status = '待审' GROUP ALL;",
  (result: SumResult[], _caseId, _limit) => (result && result.length > 0 && result[0].pending_total !== null ? result[0].pending_total : 0),
  0,
  "PendingClaimAmount"
);

// 5. useLiveApprovedClaimsCount
export const useLiveApprovedClaimsCount = createLiveMetricHook<CountResult, number>(
  (_caseId, _limit) => "SELECT count() AS count FROM claim WHERE case_id = $caseId AND status = '审核通过' GROUP ALL;",
  (result: CountResult[], _caseId, _limit) => (result && result.length > 0 ? result[0].count : 0),
  0,
  "ApprovedClaimsCount"
);

// 6. useLivePendingClaimsCount
export const useLivePendingClaimsCount = createLiveMetricHook<CountResult, number>(
  (_caseId, _limit) => "SELECT count() AS count FROM claim WHERE case_id = $caseId AND status = '待审' GROUP ALL;",
  (result: CountResult[], _caseId, _limit) => (result && result.length > 0 ? result[0].count : 0),
  0,
  "PendingClaimsCount"
);

// 7. useLiveUniqueClaimantsCount
export const useLiveUniqueClaimantsCount = createLiveMetricHook<DistinctCountResult, number>(
  (_caseId, _limit) => 'SELECT count(DISTINCT claimant_id) AS distinct_claimants FROM claim WHERE case_id = $caseId GROUP ALL;',
  (result: DistinctCountResult[], _caseId, _limit) => (result && result.length > 0 ? result[0].distinct_claimants : 0),
  0,
  "UniqueClaimantsCount"
);

// 8. useLiveTodaysSubmissionsCount
export const useLiveTodaysSubmissionsCount = createLiveMetricHook<CountResult, number>(
  (_caseId, _limit) => `
    SELECT count() 
    FROM claim 
    WHERE case_id = $caseId AND string::slice(created_at, 0, 10) = string::slice(time::now(), 0, 10) 
    GROUP ALL;
  `,
  (result: CountResult[], _caseId, _limit) => (result && result.length > 0 ? result[0].count : 0),
  0,
  "TodaysSubmissionsCount"
);

// 9. useLiveTodaysReviewedClaimsCount
export const useLiveTodaysReviewedClaimsCount = createLiveMetricHook<CountResult, number>(
  (_caseId, _limit) => `
    SELECT count() 
    FROM claim 
    WHERE case_id = $caseId AND reviewed_at IS NOT NULL AND string::slice(reviewed_at, 0, 10) = string::slice(time::now(), 0, 10) 
    GROUP ALL;
  `,
  (result: CountResult[], _caseId, _limit) => (result && result.length > 0 ? result[0].count : 0),
  0,
  "TodaysReviewedClaimsCount"
);


// --- Hooks for Chart Data ---

// 10. useLiveClaimsByStatusChartData 
const statusColorMap: { [key: string]: string } = {
  '审核通过': green[400],
  '待审': yellow[400],
  '已驳回': muiRed[400],
  '补充材料': orange[400],
};
const defaultStatusColor = grey[500];

export const useLiveClaimsByStatusChartData = createLiveMetricHook<GroupedCountResult[], PieChartDataPoint[]>(
  (_caseId, _limit) => "SELECT status, count() AS count FROM claim WHERE case_id = $caseId GROUP BY status;",
  (results: GroupedCountResult[], _caseId, _limit) => {
    if (!results) return [];
    return results.map((item, index) => ({
      id: item.status || `unknown-${index}`,
      value: item.count,
      label: item.status || '未知状态',
      color: item.status ? (statusColorMap[item.status] || defaultStatusColor) : defaultStatusColor,
    }));
  },
  [],
  "ClaimsByStatusChartData"
);

// 11. useLiveUsersOnlineByRoleChartData
const roleColorMap: { [key: string]: string } = {
  '管理人': teal[400],
  '债权人': cyan[500],
  '管理员': purple[400],
};
const defaultRoleColor = grey[500];

interface UserActivityByRoleResult {
  role: string;
  count: number;
}

export const useLiveUsersOnlineByRoleChartData = createLiveMetricHook<UserActivityByRoleResult[], BarChartDataPoint[]>(
  (_caseId, _limit) => `
    SELECT 
      user.role AS role, 
      count() AS count 
    FROM presence 
    WHERE 
      case_id = $caseId AND 
      meta::id(user) IS NOT NULL AND
      last_seen > (time::now() - 5m) 
    GROUP BY user.role;
  `,
  (results: UserActivityByRoleResult[], _caseId, _limit) => {
    if (!results || results.length === 0) {
      return [];
    }
    return results.map(item => ({
      role: item.role || '未知角色',
      count: item.count,
      color: roleColorMap[item.role] || defaultRoleColor,
    }));
  },
  [],
  "UsersOnlineByRoleChartData"
);

// 12. useLiveDailyClaimsTrendChartData
export const useLiveDailyClaimsTrendChartData = createLiveMetricHook<GroupedCountResult[], LineChartDataPoint[]>(
  (_caseId, _limit) => "SELECT string::slice(created_at, 0, 10) AS day, count() AS count FROM claim WHERE case_id = $caseId GROUP BY day ORDER BY day ASC;",
  (results: GroupedCountResult[], _caseId, _limit) => {
    if (!results) return [];
    return results.map(item => ({
      date: item.day ? item.day.substring(5) : 'Unknown',
      count: item.count,
    }));
  },
  [],
  "DailyClaimsTrendChartData"
);

// 13. useLiveClaimsByNatureChartData
const natureColorMap: { [key: string]: string } = {
  '普通债权': blue[400],
  '有财产担保债权': green[500],
  '劳动报酬': yellow[500],
  '税款类债权': orange[400],
  '其他': purple[300],
};
const defaultNatureColor = grey[600];

export const useLiveClaimsByNatureChartData = createLiveMetricHook<GroupedCountResult[], PieChartDataPoint[]>(
  (_caseId, _limit) => "SELECT nature, count() AS count FROM claim WHERE case_id = $caseId GROUP BY nature;",
  (results: GroupedCountResult[], _caseId, _limit) => {
    if (!results) return [];
    return results.map((item, index) => ({
      id: item.nature || `unknown-nature-${index}`,
      value: item.count,
      label: item.nature || '未知性质',
      color: item.nature ? (natureColorMap[item.nature] || defaultNatureColor) : defaultNatureColor,
    }));
  },
  [],
  "ClaimsByNatureChartData"
);


// --- Hooks for Dynamic List Data ---

// 14. useLiveRecentSubmissions
export const useLiveRecentSubmissions = createLiveMetricHook<RawRecentSubmission[], RecentSubmissionItem[]>(
  (_caseId, _limit) => `
    SELECT id, claim_id, claimant_name, amount, created_at 
    FROM claim 
    WHERE case_id = $caseId 
    ORDER BY created_at DESC 
    LIMIT $limit;
  `,
  (results: RawRecentSubmission[], _caseId, _limit) => {
    if (!results) return [];
    return results.map(item => ({
      id: String(item.id),
      claimId: item.claim_id || 'N/A',
      claimantName: item.claimant_name || '未知申请人',
      amount: item.amount || 0,
      time: item.created_at ? new Date(item.created_at).toLocaleTimeString() : 'N/A',
      type: 'New',
    }));
  },
  [],
  "RecentSubmissions"
);

// 15. useLiveRecentReviewActions
export const useLiveRecentReviewActions = createLiveMetricHook<RawRecentReviewAction[], RecentReviewActionItem[]>(
  (_caseId, _limit) => `
    SELECT id, claim_id, status, reviewed_by, approved_amount, reviewed_at 
    FROM claim 
    WHERE case_id = $caseId AND reviewed_at IS NOT NULL 
    ORDER BY reviewed_at DESC 
    LIMIT $limit;
  `,
  (results: RawRecentReviewAction[], _caseId, _limit) => {
    if (!results) return [];
    return results.map(item => ({
      id: String(item.id),
      claimId: item.claim_id || 'N/A',
      action: item.status || '未知操作',
      reviewerName: item.reviewed_by || '未知审核人',
      reviewedAmount: item.approved_amount || 0,
      time: item.reviewed_at ? new Date(item.reviewed_at).toLocaleTimeString() : 'N/A',
    }));
  },
  [],
  "RecentReviewActions"
);
