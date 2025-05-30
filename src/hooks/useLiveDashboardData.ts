import { useState, useEffect, useRef, useCallback } from 'react';
import { useSurrealClient } from '@/src/contexts/SurrealProvider'; // Adjust path if needed
// import { Thing } from 'surrealdb.js'; // For typing if needed, e.g. caseId

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
  metricQueryFn: (caseId: string, limit?: number) => string, // Now a function to generate query
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
    const { client, isConnected } = useSurrealClient();
    const [metricValue, setMetricValue] = useState<TDataType>(defaultValue);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
    const liveQueryIdRef = useRef<string | null>(null);

    const fetchMetric = useCallback(async (currentCaseId: string) => {
      if (!client || !isConnected) {
        // console.warn(`Surreal client not connected, skipping fetch for ${debugName}.`);
        // Don't set isLoading to false here, as connection might recover
        return;
      }
      setIsLoading(true); // Set loading true at the beginning of a fetch attempt
      try {
        const finalQuery = metricQueryFn(currentCaseId, limit); // Generate query with limit
        const queryParams: { [key: string]: string | number } = { caseId: currentCaseId };
        // Ensure limit is passed if $limit is in the query string.
        // The hook caller should provide a sensible default for limit if necessary for the query.
        if (finalQuery.includes('$limit')) {
          queryParams.limit = limit || 5; // Default limit to 5 if not provided but query expects it
        }

        const result = await client.query<[TResultType[]]>(finalQuery, queryParams);
        
        if (result && result[0] && result[0].result) {
            const parsed = parseResult(result[0].result, currentCaseId, limit);
            setMetricValue(parsed);
        } else {
            setMetricValue(defaultValue);
        }
        setError(null);
      } catch (e) {
        console.error(`Error fetching ${debugName} for ${currentCaseId}:`, e);
        setError(e);
        setMetricValue(defaultValue); // Reset on error
      } finally {
        setIsLoading(false); // Set loading false after fetch attempt (success or error)
      }
    }, [client, isConnected, parseResult, defaultValue, debugName, metricQueryFn, limit]);

    useEffect(() => {
      if (!client || !isConnected || !caseId) {
        setMetricValue(defaultValue);
        setIsLoading(false); // Not connected or no caseId, so not loading.
        if (liveQueryIdRef.current && client && client.isConnected) { // Check client.isConnected before calling kill
          client.kill(liveQueryIdRef.current).then(() => {
            liveQueryIdRef.current = null;
          }).catch(killError => {
            console.error(`Error killing live query ${liveQueryIdRef.current} for ${debugName}:`, killError);
          });
        }
        return;
      }

      fetchMetric(caseId); // Initial fetch

      // Setup live query (only if not already set up or if caseId changes, handled by useEffect dependencies)
      const setupLiveQuery = async () => {
        if (liveQueryIdRef.current) { // Kill previous if caseId or other key params change
          try {
            if (client && client.isConnected) await client.kill(liveQueryIdRef.current);
            liveQueryIdRef.current = null;
          } catch (killError) {
            // console.error(`Error killing previous live query ${liveQueryIdRef.current} for ${debugName}:`, killError);
          }
        }
        
        // Determine the live query based on debugName or a new parameter if more granularity is needed.
        // For now, all hooks use the 'claim' table for live updates, except user_activity which is commented.
        let liveSelectQuery = `LIVE SELECT * FROM claim WHERE case_id = $caseId;`;
        // Example: if (debugName === "UsersOnlineByRoleChartData") {
        //   liveSelectQuery = `LIVE SELECT * FROM user_activity WHERE case_id = $caseId;`;
        // }
        
        try {
          const queryResponse = await client.query<[{result: string}]>(liveSelectQuery, { caseId });
          const qid = queryResponse && queryResponse[0] && queryResponse[0].result;

          if (qid && typeof qid === 'string') {
            liveQueryIdRef.current = qid;
            client. subscribeLive(liveQueryIdRef.current, (_action, _data) => {
              // Re-fetch the specific metric without setting isLoading to true again,
              // as this is a background update.
              // Or, we could have a separate state for "isUpdating". For now, direct fetch.
              fetchMetric(caseId); 
            });
          } else {
            // console.error(`Failed to get live query ID from LIVE SELECT for ${debugName}. Response:`, queryResponse);
          }
        } catch (e) {
          // console.error(`Error setting up live query for ${debugName}:`, e);
          // setError(e); // Avoid setting global error for live query setup issues if main data loaded
        }
      };

      setupLiveQuery();

      return () => { // Cleanup
        if (liveQueryIdRef.current && client && client.isConnected) {
          client.kill(liveQueryIdRef.current).then(() => {
            liveQueryIdRef.current = null;
          }).catch(_killError => {
            // console.error(`Error killing live query ${liveQueryIdRef.current} for ${debugName} on cleanup:`, killError);
          });
        }
      };
    }, [client, isConnected, caseId, fetchMetric, defaultValue, debugName, limit]);

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

// Renumbering subsequent hooks for clarity in comments/logs if needed
// Original 8. useLiveClaimsByStatusChartData becomes 10.
// 10. useLiveClaimsByStatusChartData 
const statusColorMap: { [key: string]: string } = {
  '审核通过': green[400],
  '待审': yellow[400],
  '已驳回': muiRed[400],
  '补充材料': orange[400],
};
const defaultStatusColor = grey[500]; // Already imported grey

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

// Original 9. useLiveUsersOnlineByRoleChartData becomes 11.
// 11. useLiveUsersOnlineByRoleChartData

// Define a color map for roles
const roleColorMap: { [key: string]: string } = {
  '管理人': teal[400],    // Manager
  '债权人': cyan[500],    // Creditor
  '管理员': purple[400],  // Admin
  // Add other roles as needed
};
const defaultRoleColor = grey[500]; // Fallback color

// Assumed structure for the raw query result from user_activity
interface UserActivityByRoleResult {
  role: string;
  count: number;
}

export const useLiveUsersOnlineByRoleChartData = createLiveMetricHook<UserActivityByRoleResult[], BarChartDataPoint[]>(
  // metricQueryFn: Generates the SurrealQL query.
  // This is a PLACEHOLDER query. Actual table name and fields need to be confirmed.
  // Assumption: 'user_activity' table with 'role', 'case_id', and 'last_seen' fields.
  // Users are considered online if 'last_seen' was within the last 5 minutes.
  // IMPORTANT: The live refresh for this hook currently depends on changes to the `claim` table
  // due to the generic `createLiveMetricHook`'s live query setup. Ideally, it should listen
  // to changes in the `user_activity` table for accurate real-time updates.
  (_caseId, _limit) => `
    SELECT 
      role, 
      count() AS count 
    FROM user_activity 
    WHERE 
      case_id = $caseId AND 
      last_seen > (time::now() - 5m) 
    GROUP BY role;
  `,
  // parseResult: Transforms the query result into BarChartDataPoint[]
  (results: UserActivityByRoleResult[], _caseId, _limit) => {
    if (!results || results.length === 0) {
      // Return an empty array or specific data if no users are online or query fails
      // For example, to show 'No data' on the chart, the chart component itself should handle empty data.
      return []; 
    }
    return results.map(item => ({
      role: item.role || '未知角色', // Fallback for undefined role
      count: item.count,
      color: roleColorMap[item.role] || defaultRoleColor, // Use mapped color or default
    }));
  },
  // defaultValue: Initial or fallback value
  [], // Start with empty data, chart should handle this gracefully
  // debugName
  "UsersOnlineByRoleChartData"
);

// Original 10. useLiveDailyClaimsTrendChartData becomes 12.
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

// Original 11. useLiveClaimsByNatureChartData becomes 13.
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

// Original 12. useLiveRecentSubmissions becomes 14.
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
      id: String(item.id), // Ensure id is string
      claimId: item.claim_id || 'N/A',
      claimantName: item.claimant_name || '未知申请人',
      amount: item.amount || 0,
      time: item.created_at ? new Date(item.created_at).toLocaleTimeString() : 'N/A',
      type: 'New', // Assuming all are 'New' for this list as 'updated_at' is not specifically queried for type.
    }));
  },
  [],
  "RecentSubmissions"
);

// Original 13. useLiveRecentReviewActions becomes 15.
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
      id: String(item.id), // Ensure id is string
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
