import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CssBaseline,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Skeleton, // Import Skeleton
} from '@mui/material';
import { 
  teal, cyan, green, yellow, purple, grey, blue, orange, red
} from '@mui/material/colors';
import { alpha, useTheme } from '@mui/material/styles';
import { PieChart, BarChart, LineChart } from '@mui/x-charts';
import { 
  FileCopyOutlined as FileCopyIcon, 
  UpdateOutlined as UpdateIcon,
  CheckCircleOutline as CheckCircleIcon,
  CancelOutlined as CancelIcon,
  InfoOutlined as InfoIcon,
// HourglassEmptyOutlined as HourglassEmptyIcon,
  // ReceiptLongOutlined as ReceiptLongIcon,
  // AssignmentTurnedInOutlined as AssignmentTurnedInIcon,
} from '@mui/icons-material';

import { useAuth } from '../../contexts/AuthContext'; // Adjust path as per your project structure
import { 
  useLiveClaimCountForCase,
  useLiveTotalClaimAmount,
  useLiveApprovedClaimAmount,
  useLivePendingClaimAmount,
  useLiveApprovedClaimsCount,
  useLivePendingClaimsCount,
  useLiveUniqueClaimantsCount,
  useLiveTodaysSubmissionsCount, // Import new hook
  useLiveTodaysReviewedClaimsCount, // Import new hook
  useLiveClaimsByStatusChartData,
  useLiveUsersOnlineByRoleChartData,
  useLiveDailyClaimsTrendChartData,
  useLiveClaimsByNatureChartData,
  useLiveRecentSubmissions,
  useLiveRecentReviewActions,
} from '../../hooks/useLiveDashboardData'; // Adjust path

// Common styles for the 7 metric cards
// The `theme` parameter will now be the global theme
const metricCardStyle = (theme: any, borderColorKey: string) => ({
  borderWidth: '1px',
  borderColor: theme.palette[borderColorKey]?.main || theme.palette.primary.main,
  backgroundColor: alpha(theme.palette.background.paper, 0.6), // Darker, distinct panel
  boxShadow: `inset 0 1px 2px ${alpha(theme.palette.common.black, 0.7)}, 0 1px 1px ${alpha(theme.palette.common.white, 0.05)}`,
  borderRadius: theme.shape.borderRadius * 1.5, // Slightly more rounded
  transition: theme.transitions.create(['transform', 'box-shadow', 'background-color'], {
    duration: theme.transitions.duration.short,
  }),
  '&:hover': {
    transform: 'scale(1.05)', // Slightly more pronounced hover
    boxShadow: `inset 0 1px 3px ${alpha(theme.palette.common.black, 0.8)}, 0 4px 12px ${alpha(theme.palette[borderColorKey]?.main || theme.palette.primary.main, 0.4)}`,
    backgroundColor: alpha(theme.palette.background.paper, 0.7),
  },
});

const metricCardContentStyle = {
  textAlign: 'center',
  py: 2.5, // Adjusted padding
};

const metricTitleStyle = (theme: any) => ({
  color: theme.palette.text.secondary, // Using theme's h2 styling by default for color
  // mb: 0.5, // Reduced margin bottom
});

const metricValueStyle = (theme: any, colorKey: string) => ({
  color: theme.palette[colorKey]?.main || theme.palette.primary.main,
  // Apply the digitalMetric typography variant
  ...theme.typography.digitalMetric,
  // Add a subtle text shadow for glow, using the specific color
  textShadow: `0 0 6px ${alpha(theme.palette[colorKey]?.main || theme.palette.primary.main, 0.5)}`,
});


const ClaimDataDashboardPage: React.FC = () => {
  const { user, selectedCaseId } = useAuth();
  const theme = useTheme(); // Hook to access theme for chart colors

  // Helper function to create state and effect for a metric (for the "updating" visual cue)
  const useIsUpdatingState = <T,>(currentData: T): [boolean, React.Dispatch<React.SetStateAction<boolean>>] => {
    const [isUpdating, setIsUpdating] = useState(false);
    const previousDataRef = React.useRef<T | null>(null);

    useEffect(() => {
      if (previousDataRef.current !== null && JSON.stringify(currentData) !== JSON.stringify(previousDataRef.current)) {
        setIsUpdating(true);
        const timer = setTimeout(() => setIsUpdating(false), 700); // Duration of the visual cue
        return () => clearTimeout(timer);
      }
      previousDataRef.current = currentData;
    }, [currentData]);
    return [isUpdating, setIsUpdating];
  };

  // Live Data Hooks & Visual Cue States
  const { data: liveTotalClaims, isLoading: isTotalClaimsLoading } = useLiveClaimCountForCase(selectedCaseId);
  const [isTotalClaimsUpdating] = useIsUpdatingState(liveTotalClaims);

  const { data: liveApprovedClaimsCount, isLoading: isApprovedClaimsCountLoading } = useLiveApprovedClaimsCount(selectedCaseId);
  const [isApprovedClaimsCountUpdating] = useIsUpdatingState(liveApprovedClaimsCount);

  const { data: livePendingClaimsCount, isLoading: isPendingClaimsCountLoading } = useLivePendingClaimsCount(selectedCaseId);
  const [isPendingClaimsCountUpdating] = useIsUpdatingState(livePendingClaimsCount);

  const { data: liveUniqueClaimantsCount, isLoading: isUniqueClaimantsCountLoading } = useLiveUniqueClaimantsCount(selectedCaseId);
  const [isUniqueClaimantsCountUpdating] = useIsUpdatingState(liveUniqueClaimantsCount);

  const { data: liveTodaysSubmissionsCount, isLoading: isTodaysSubmissionsLoading } = useLiveTodaysSubmissionsCount(selectedCaseId);
  const [isTodaysSubmissionsUpdating] = useIsUpdatingState(liveTodaysSubmissionsCount);

  const { data: liveTodaysReviewedClaimsCount, isLoading: isTodaysReviewedLoading } = useLiveTodaysReviewedClaimsCount(selectedCaseId);
  const [isTodaysReviewedUpdating] = useIsUpdatingState(liveTodaysReviewedClaimsCount);
  
  const { data: liveTotalClaimAmount, isLoading: isTotalClaimAmountLoading } = useLiveTotalClaimAmount(selectedCaseId);
  const [isTotalClaimAmountUpdating] = useIsUpdatingState(liveTotalClaimAmount);

  const { data: liveApprovedClaimAmount, isLoading: isApprovedClaimAmountLoading } = useLiveApprovedClaimAmount(selectedCaseId);
  const [isApprovedClaimAmountUpdating] = useIsUpdatingState(liveApprovedClaimAmount);

  const { data: livePendingClaimAmount, isLoading: isPendingClaimAmountLoading } = useLivePendingClaimAmount(selectedCaseId);
  const [isPendingClaimAmountUpdating] = useIsUpdatingState(livePendingClaimAmount);

  // Live Data for Charts - Destructure data and isLoading
  const { data: liveClaimsByStatusData, isLoading: isClaimsByStatusLoading } = useLiveClaimsByStatusChartData(selectedCaseId);
  const { data: liveUsersOnlineByRoleData, isLoading: isUsersOnlineLoading } = useLiveUsersOnlineByRoleChartData(selectedCaseId);
  const { data: liveDailyClaimsTrendData, isLoading: isDailyClaimsTrendLoading } = useLiveDailyClaimsTrendChartData(selectedCaseId);
  const { data: liveClaimsByNatureData, isLoading: isClaimsByNatureLoading } = useLiveClaimsByNatureChartData(selectedCaseId);

  // Live Data for Dynamic Lists - Destructure data and isLoading
  const listLimit = 5; 
  const { data: liveRecentSubmissions, isLoading: isRecentSubmissionsLoading } = useLiveRecentSubmissions(selectedCaseId, listLimit);
  const { data: liveRecentReviewActions, isLoading: isRecentReviewsLoading } = useLiveRecentReviewActions(selectedCaseId, listLimit);


  // Mock data for placeholders (gradually replace these with live data or remove)
  const mockData = { // Keep only what's truly mock or not yet live
    usersLoggedIn: { admin: 2, manager: 5, creditor_user: 50 }, // Remains mock for now
    claimsRejected: 15, // Placeholder - No live hook for this specific metric yet

    // The following are now driven by live data hooks:
    // claimsByStatus: [...] 
    // usersOnlineByRole: [...] // This hook returns mock data but is called
    // dailyClaimsTrend: [...]
    // claimsByNature: [...]
    // recentSubmissions: [...]
    // recentReviewActions: [...]
  };
  // Assume AppBar height is 64px for minHeight calculation
  const appBarHeight = '64px';
  // The `theme` variable obtained from `useTheme()` will now be the global theme.

  // Chart common properties
  const chartCardMinHeight = 350; 
  const chartMargin = { top: 10, right: 10, bottom: 30, left: 40 }; // Basic margin
  const chartTitleVariant = "h5"; // Using h5 for chart titles for consistency

  // List Card common properties
  const listCardMinHeight = 300;
  const listTitleVariant = "h5"; // Using h5 for list titles for consistency

  // Common style for content cards (charts, lists, etc.)
  const contentCardStyle = {
    minHeight: listCardMinHeight, // Default, can be overridden by chartCardMinHeight for charts
    display: 'flex',
    flexDirection: 'column',
    border: `1px solid ${alpha(theme.palette.primary.dark, 0.4)}`, // Subtle border
    backgroundColor: alpha(theme.palette.background.paper, 0.7), // Slightly more transparent paper
     boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.3)}`, // Softer shadow than metric cards
    '&:hover': {
        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
    }
  };


  return (
    // <ThemeProvider theme={localDarkTheme}> // Removed ThemeProvider
      <Box sx={{ p: 3, backgroundColor: theme.palette.background.default, color: theme.palette.text.primary, minHeight: `calc(100vh - ${appBarHeight})` }}>
        <CssBaseline /> {/* Ensure CssBaseline is still applied, typically done at a higher level but good for standalone too */}
        <Typography variant="h1" gutterBottom textAlign="center" mb={1} sx={{ color: theme.palette.primary.main }}>债权申报数据大屏</Typography>
        <Typography variant="subtitle1" textAlign="center" sx={{ mb: 5, color: theme.palette.text.secondary }}>
          {selectedCaseId 
            ? `实时监控案件ID: ${selectedCaseId.replace(/^case:/, '')} 的债权申报与审核动态` 
            : user 
              ? "请从案件列表选择一个案件进行监控" 
              : "请先登录并选择案件"}
        </Typography>

        {/* Metric Cards Grid - Row 1 (New Metrics + First Two Original) */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Metric: Today's Submissions Count */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              ...metricCardStyle(theme, 'statOrange'), 
              transition: theme.transitions.create(['transform', 'box-shadow', 'background-color', 'border-color'], { duration: theme.transitions.duration.short }),
              borderColor: isTodaysSubmissionsUpdating ? theme.palette.warning.light : theme.palette.statOrange?.main || theme.palette.orange[400], // Fallback if statOrange not in theme
              transform: isTodaysSubmissionsUpdating ? 'scale(1.02)' : 'scale(1)',
            }}>
              <CardContent sx={metricCardContentStyle}>
                <Typography variant="h2" gutterBottom sx={metricTitleStyle(theme)}>今日提交笔数</Typography>
                {isTodaysSubmissionsLoading ? <Skeleton variant="text" width="80%" sx={{fontSize: '2.75rem', margin: 'auto'}} /> : (
                  <Typography 
                    variant="digitalMetric" 
                    sx={{
                      ...metricValueStyle(theme, 'statOrange'),
                      transition: 'transform 0.3s ease-in-out, color 0.3s linear',
                      transform: isTodaysSubmissionsUpdating ? 'scale(1.1)' : 'scale(1)',
                      color: isTodaysSubmissionsUpdating ? theme.palette.warning.light : theme.palette.statOrange?.main || theme.palette.orange[400],
                      textShadow: isTodaysSubmissionsUpdating 
                        ? `0 0 10px ${alpha(theme.palette.warning.light, 0.7)}` 
                        : `0 0 6px ${alpha(theme.palette.statOrange?.main || theme.palette.orange[400], 0.5)}`,
                    }}
                  >
                    {liveTodaysSubmissionsCount}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Metric: Today's Reviewed Claims Count */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              ...metricCardStyle(theme, 'statRed'), 
              transition: theme.transitions.create(['transform', 'box-shadow', 'background-color', 'border-color'], { duration: theme.transitions.duration.short }),
              borderColor: isTodaysReviewedUpdating ? theme.palette.warning.light : theme.palette.statRed?.main || theme.palette.red[400], // Fallback if statRed not in theme
              transform: isTodaysReviewedUpdating ? 'scale(1.02)' : 'scale(1)',
            }}>
              <CardContent sx={metricCardContentStyle}>
                <Typography variant="h2" gutterBottom sx={metricTitleStyle(theme)}>今日审核笔数</Typography>
                {isTodaysReviewedLoading ? <Skeleton variant="text" width="80%" sx={{fontSize: '2.75rem', margin: 'auto'}} /> : (
                  <Typography variant="digitalMetric" sx={{
                    ...metricValueStyle(theme, 'statRed'),
                    transition: 'transform 0.3s ease-in-out, color 0.3s linear',
                    transform: isTodaysReviewedUpdating ? 'scale(1.1)' : 'scale(1)',
                    color: isTodaysReviewedUpdating ? theme.palette.warning.light : theme.palette.statRed?.main || theme.palette.red[400],
                    textShadow: isTodaysReviewedUpdating ? `0 0 10px ${alpha(theme.palette.warning.light, 0.7)}` : `0 0 6px ${alpha(theme.palette.statRed?.main || theme.palette.red[400], 0.5)}`,
                  }}>
                    {liveTodaysReviewedClaimsCount}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Metric 1: Total Number of Claims (Live) - Now 3rd item in this row */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              ...metricCardStyle(theme, 'statBlue'), 
              transition: theme.transitions.create(['transform', 'box-shadow', 'background-color', 'border-color'], { duration: theme.transitions.duration.short }),
              borderColor: isTotalClaimsUpdating ? theme.palette.warning.light : theme.palette.statBlue.main,
              transform: isTotalClaimsUpdating ? 'scale(1.02)' : 'scale(1)',
            }}>
              <CardContent sx={metricCardContentStyle}>
                <Typography variant="h2" gutterBottom sx={metricTitleStyle(theme)}>当前申请总笔数</Typography>
                {isTotalClaimsLoading ? <Skeleton variant="text" width="80%" sx={{fontSize: '2.75rem', margin: 'auto'}} /> : (
                  <Typography 
                    variant="digitalMetric" 
                    sx={{
                      ...metricValueStyle(theme, 'statBlue'),
                      transition: 'transform 0.3s ease-in-out, color 0.3s linear',
                      transform: isTotalClaimsUpdating ? 'scale(1.1)' : 'scale(1)',
                      color: isTotalClaimsUpdating ? theme.palette.warning.light : theme.palette.statBlue.main,
                      textShadow: isTotalClaimsUpdating 
                        ? `0 0 10px ${alpha(theme.palette.warning.light, 0.7)}` 
                        : `0 0 6px ${alpha(theme.palette.statBlue.main, 0.5)}`,
                    }}
                  >
                    {liveTotalClaims}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Metric 2: Total Approved Claims (Live) - Now 4th item in this row */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              ...metricCardStyle(theme, 'statGreen'),
              transition: theme.transitions.create(['transform', 'box-shadow', 'background-color', 'border-color'], { duration: theme.transitions.duration.short }),
              borderColor: isApprovedClaimsCountUpdating ? theme.palette.warning.light : theme.palette.statGreen.main,
              transform: isApprovedClaimsCountUpdating ? 'scale(1.02)' : 'scale(1)',
            }}>
              <CardContent sx={metricCardContentStyle}>
                <Typography variant="h2" gutterBottom sx={metricTitleStyle(theme)}>当前已审批总笔数</Typography>
                {isApprovedClaimsCountLoading ? <Skeleton variant="text" width="80%" sx={{fontSize: '2.75rem', margin: 'auto'}} /> : (
                  <Typography variant="digitalMetric" sx={{
                    ...metricValueStyle(theme, 'statGreen'),
                    transition: 'transform 0.3s ease-in-out, color 0.3s linear',
                    transform: isApprovedClaimsCountUpdating ? 'scale(1.1)' : 'scale(1)',
                    color: isApprovedClaimsCountUpdating ? theme.palette.warning.light : theme.palette.statGreen.main,
                    textShadow: isApprovedClaimsCountUpdating ? `0 0 10px ${alpha(theme.palette.warning.light, 0.7)}` : `0 0 6px ${alpha(theme.palette.statGreen.main, 0.5)}`,
                  }}>
                    {liveApprovedClaimsCount}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        {/* Metric Cards Grid - Row 2 (Remaining Original Metrics) */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Metric 3: Total Pending Claims (Live) */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              ...metricCardStyle(theme, 'statYellow'),
              transition: theme.transitions.create(['transform', 'box-shadow', 'background-color', 'border-color'], { duration: theme.transitions.duration.short }),
              borderColor: isPendingClaimsCountUpdating ? theme.palette.warning.light : theme.palette.statYellow.main,
              transform: isPendingClaimsCountUpdating ? 'scale(1.02)' : 'scale(1)',
            }}>
              <CardContent sx={metricCardContentStyle}>
                <Typography variant="h2" gutterBottom sx={metricTitleStyle(theme)}>当前待审总笔数</Typography>
                {isPendingClaimsCountLoading ? <Skeleton variant="text" width="80%" sx={{fontSize: '2.75rem', margin: 'auto'}} /> : (
                  <Typography variant="digitalMetric" sx={{
                    ...metricValueStyle(theme, 'statYellow'),
                    transition: 'transform 0.3s ease-in-out, color 0.3s linear',
                    transform: isPendingClaimsCountUpdating ? 'scale(1.1)' : 'scale(1)',
                    color: isPendingClaimsCountUpdating ? theme.palette.warning.light : theme.palette.statYellow.main,
                    textShadow: isPendingClaimsCountUpdating ? `0 0 10px ${alpha(theme.palette.warning.light, 0.7)}` : `0 0 6px ${alpha(theme.palette.statYellow.main, 0.5)}`,
                  }}>
                    {livePendingClaimsCount}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Metric 4: Number of Unique Claimants (Live) */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              ...metricCardStyle(theme, 'statPurple'),
              transition: theme.transitions.create(['transform', 'box-shadow', 'background-color', 'border-color'], { duration: theme.transitions.duration.short }),
              borderColor: isUniqueClaimantsCountUpdating ? theme.palette.warning.light : theme.palette.statPurple.main,
              transform: isUniqueClaimantsCountUpdating ? 'scale(1.02)' : 'scale(1)',
            }}>
              <CardContent sx={metricCardContentStyle}>
                <Typography variant="h2" gutterBottom sx={metricTitleStyle(theme)}>当前申请债权人数量</Typography>
                {isUniqueClaimantsCountLoading ? <Skeleton variant="text" width="80%" sx={{fontSize: '2.75rem', margin: 'auto'}} /> : (
                  <Typography variant="digitalMetric" sx={{
                    ...metricValueStyle(theme, 'statPurple'),
                    transition: 'transform 0.3s ease-in-out, color 0.3s linear',
                    transform: isUniqueClaimantsCountUpdating ? 'scale(1.1)' : 'scale(1)',
                    color: isUniqueClaimantsCountUpdating ? theme.palette.warning.light : theme.palette.statPurple.main,
                    textShadow: isUniqueClaimantsCountUpdating ? `0 0 10px ${alpha(theme.palette.warning.light, 0.7)}` : `0 0 6px ${alpha(theme.palette.statPurple.main, 0.5)}`,
                  }}>
                    {liveUniqueClaimantsCount}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Metric 5: Total Claimed Amount (Live) */}
          <Grid item xs={12} md={4}>
            <Card sx={{
              ...metricCardStyle(theme, 'statBlue'),
              transition: theme.transitions.create(['transform', 'box-shadow', 'background-color', 'border-color'], { duration: theme.transitions.duration.short }),
              borderColor: isTotalClaimAmountUpdating ? theme.palette.warning.light : theme.palette.statBlue.main,
              transform: isTotalClaimAmountUpdating ? 'scale(1.02)' : 'scale(1)',
            }}>
              <CardContent sx={metricCardContentStyle}>
                <Typography variant="h2" gutterBottom sx={metricTitleStyle(theme)}>当前申请总金额</Typography>
                {isTotalClaimAmountLoading ? <Skeleton variant="text" width="80%" sx={{fontSize: '2.75rem', margin: 'auto'}} /> : (
                  <Typography variant="digitalMetric" sx={{
                    ...metricValueStyle(theme, 'statBlue'),
                    transition: 'transform 0.3s ease-in-out, color 0.3s linear',
                    transform: isTotalClaimAmountUpdating ? 'scale(1.1)' : 'scale(1)',
                    color: isTotalClaimAmountUpdating ? theme.palette.warning.light : theme.palette.statBlue.main,
                    textShadow: isTotalClaimAmountUpdating ? `0 0 10px ${alpha(theme.palette.warning.light, 0.7)}` : `0 0 6px ${alpha(theme.palette.statBlue.main, 0.5)}`,
                  }}>
                    {liveTotalClaimAmount.toLocaleString()} <Typography component="span" variant="h5" sx={{ml:0.5, opacity:0.7}}>元</Typography>
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          {/* Metric 6: Total Approved Amount (Live) */}
          <Grid item xs={12} md={4}>
            <Card sx={{
              ...metricCardStyle(theme, 'statGreen'),
              transition: theme.transitions.create(['transform', 'box-shadow', 'background-color', 'border-color'], { duration: theme.transitions.duration.short }),
              borderColor: isApprovedClaimAmountUpdating ? theme.palette.warning.light : theme.palette.statGreen.main,
              transform: isApprovedClaimAmountUpdating ? 'scale(1.02)' : 'scale(1)',
            }}>
              <CardContent sx={metricCardContentStyle}>
                <Typography variant="h2" gutterBottom sx={metricTitleStyle(theme)}>当前已审批总金额</Typography>
                {isApprovedClaimAmountLoading ? <Skeleton variant="text" width="80%" sx={{fontSize: '2.75rem', margin: 'auto'}} /> : (
                  <Typography variant="digitalMetric" sx={{
                    ...metricValueStyle(theme, 'statGreen'),
                    transition: 'transform 0.3s ease-in-out, color 0.3s linear',
                    transform: isApprovedClaimAmountUpdating ? 'scale(1.1)' : 'scale(1)',
                    color: isApprovedClaimAmountUpdating ? theme.palette.warning.light : theme.palette.statGreen.main,
                    textShadow: isApprovedClaimAmountUpdating ? `0 0 10px ${alpha(theme.palette.warning.light, 0.7)}` : `0 0 6px ${alpha(theme.palette.statGreen.main, 0.5)}`,
                  }}>
                    {liveApprovedClaimAmount.toLocaleString()} <Typography component="span" variant="h5" sx={{ml:0.5, opacity:0.7}}>元</Typography>
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          {/* Metric 7: Total Pending Amount (Live) */}
          <Grid item xs={12} md={4}>
            <Card sx={{
              ...metricCardStyle(theme, 'statYellow'),
              transition: theme.transitions.create(['transform', 'box-shadow', 'background-color', 'border-color'], { duration: theme.transitions.duration.short }),
              borderColor: isPendingClaimAmountUpdating ? theme.palette.warning.light : theme.palette.statYellow.main,
              transform: isPendingClaimAmountUpdating ? 'scale(1.02)' : 'scale(1)',
            }}>
              <CardContent sx={metricCardContentStyle}>
                <Typography variant="h2" gutterBottom sx={metricTitleStyle(theme)}>当前待审总金额</Typography>
                {isPendingClaimAmountLoading ? <Skeleton variant="text" width="80%" sx={{fontSize: '2.75rem', margin: 'auto'}} /> : (
                  <Typography variant="digitalMetric" sx={{
                    ...metricValueStyle(theme, 'statYellow'),
                    transition: 'transform 0.3s ease-in-out, color 0.3s linear',
                    transform: isPendingClaimAmountUpdating ? 'scale(1.1)' : 'scale(1)',
                    color: isPendingClaimAmountUpdating ? theme.palette.warning.light : theme.palette.statYellow.main,
                    textShadow: isPendingClaimAmountUpdating ? `0 0 10px ${alpha(theme.palette.warning.light, 0.7)}` : `0 0 6px ${alpha(theme.palette.statYellow.main, 0.5)}`,
                  }}>
                    {livePendingClaimAmount.toLocaleString()} <Typography component="span" variant="h5" sx={{ml:0.5, opacity:0.7}}>元</Typography>
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        {/* Chart Grid */}
        <Grid container spacing={3}>
          {/* Review Progress Chart (Pie Chart) */}
          <Grid item xs={12} md={6} lg={3}>
            <Card sx={{...contentCardStyle, minHeight: chartCardMinHeight}}>
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', p:2 }}>
                <Typography variant={chartTitleVariant} component="h3" gutterBottom textAlign="center" sx={{color: theme.palette.text.primary, mb:1}}>
                  债权状态分布
                </Typography>
                <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1, mt:1 }}>
                  {isClaimsByStatusLoading ? (
                    <Skeleton variant="rectangular" width="100%" height={chartCardMinHeight - 80} sx={{alignSelf: 'center', mx: 'auto'}}/>
                  ) : liveClaimsByStatusData.length > 0 ? (
                  <PieChart
                    series={[{ 
                      data: liveClaimsByStatusData,
                      highlightScope: { faded: 'global', highlighted: 'item' },
                      faded: { innerRadius: 20, additionalRadius: -10, color: 'gray' },
                      innerRadius: 30,
                      outerRadius: 100,
                      paddingAngle: 2,
                      cornerRadius: 5,
                    }]}
                    slotProps={{ legend: { hidden: false, position: {vertical: 'bottom', horizontal: 'middle'}, labelStyle: {fontSize: 12, fill: theme.palette.text.secondary} } }}
                    height={250} // Adjusted height
                    // width prop is not strictly needed if parent Box controls size well
                    sx={{ flexGrow: 1 }} 
                  />
                  ) : (
                    <Typography variant="body2" color="text.disabled">暂无数据</Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* User Online Distribution Chart (Bar Chart) - Currently Mock Data */}
          <Grid item xs={12} md={6} lg={3}>
            <Card sx={{...contentCardStyle, minHeight: chartCardMinHeight}}>
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', p:2 }}>
                <Typography variant={chartTitleVariant} component="h3" gutterBottom textAlign="center" sx={{color: theme.palette.text.primary, mb:1}}>
                  用户在线分布
                </Typography>
                <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1, mt:1 }}>
                  {isUsersOnlineLoading ? (
                    <Skeleton variant="rectangular" width="100%" height={chartCardMinHeight - 80} sx={{alignSelf: 'center', mx: 'auto'}}/>
                  ) : liveUsersOnlineByRoleData.length > 0 ? (
                  <BarChart
                    dataset={liveUsersOnlineByRoleData}
                    xAxis={[{ scaleType: 'band', dataKey: 'role', label: '用户角色', labelStyle: {fill: theme.palette.text.secondary}, tickLabelStyle: {fill: theme.palette.text.secondary} }]}
                    yAxis={[{ label: '在线数量', labelStyle: {fill: theme.palette.text.secondary}, tickLabelStyle: {fill: theme.palette.text.secondary} }]}
                    series={[{ dataKey: 'count', label: '在线用户数' }]} // Color will be taken from data point
                    layout="vertical" // Or "horizontal"
                    height={250}
                    margin={chartMargin}
                    sx={{ flexGrow: 1 }}
                    grid={{ horizontal: true, vertical: false, strokeDasharray: "5 5", strokeOpacity: 0.3 }}
                    slotProps={{ legend: {hidden: true} }}
                  />
                  ) : (
                    <Typography variant="body2" color="text.disabled">暂无数据</Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Trend Chart (Daily Claims Count - Line Chart) */}
          <Grid item xs={12} md={6} lg={3}>
            <Card sx={{...contentCardStyle, minHeight: chartCardMinHeight}}>
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', p:2 }}>
                <Typography variant={chartTitleVariant} component="h3" gutterBottom textAlign="center" sx={{color: theme.palette.text.primary, mb:1}}>
                  每日债权申报趋势 (笔数)
                </Typography>
                 <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1, mt:1 }}>
                  {isDailyClaimsTrendLoading ? (
                    <Skeleton variant="rectangular" width="100%" height={chartCardMinHeight - 80} sx={{alignSelf: 'center', mx: 'auto'}}/>
                  ) : liveDailyClaimsTrendData.length > 0 ? (
                  <LineChart
                    xAxis={[{ 
                        dataKey: 'date', 
                        scaleType: 'band', 
                        label: '日期 (月-日)',
                        labelStyle: {fill: theme.palette.text.secondary}, tickLabelStyle: {fill: theme.palette.text.secondary}
                    }]}
                    yAxis={[{ label: '申报数量 (笔)', labelStyle: {fill: theme.palette.text.secondary}, tickLabelStyle: {fill: theme.palette.text.secondary} }]}
                    dataset={liveDailyClaimsTrendData}
                    series={[
                      { dataKey: 'count', label: '申报笔数', color: theme.palette.chartGreen.main, curve: "catmullRom" }, // Using catmullRom for smoother curve
                    ]}
                    height={250}
                    margin={chartMargin}
                    sx={{ flexGrow: 1 }}
                    grid={{ horizontal: true, vertical: false, strokeDasharray: "5 5", strokeOpacity: 0.3 }}
                    slotProps={{ legend: {hidden: true} }}
                  />
                  ) : (
                    <Typography variant="body2" color="text.disabled">暂无数据</Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Composition Chart (Claims by Nature - Pie Chart) */}
          <Grid item xs={12} md={6} lg={3}>
            <Card sx={{...contentCardStyle, minHeight: chartCardMinHeight}}>
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', p:2 }}>
                <Typography variant={chartTitleVariant} component="h3" gutterBottom textAlign="center" sx={{color: theme.palette.text.primary, mb:1}}>
                  债权性质构成
                </Typography>
                <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1, mt:1 }}>
                  {isClaimsByNatureLoading ? (
                    <Skeleton variant="rectangular" width="100%" height={chartCardMinHeight - 80} sx={{alignSelf: 'center', mx: 'auto'}}/>
                  ) : liveClaimsByNatureData.length > 0 ? (
                  <PieChart
                    series={[{ 
                        data: liveClaimsByNatureData,
                        highlightScope: { faded: 'global', highlighted: 'item' },
                        faded: { innerRadius: 20, additionalRadius: -10, color: 'gray' },
                        innerRadius: 30,
                        outerRadius: 100,
                        paddingAngle: 2,
                        cornerRadius: 5,
                    }]}
                    slotProps={{ legend: { hidden: false, position: {vertical: 'bottom', horizontal: 'middle'}, labelStyle: {fontSize: 12, fill: theme.palette.text.secondary} } }}
                    height={250}
                    sx={{ flexGrow: 1 }}
                  />
                  ) : (
                    <Typography variant="body2" color="text.disabled">暂无数据</Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Dynamic Lists Grid */}
        <Grid container spacing={3} sx={{ mt: 1 }}> 
          {/* Recently Submitted Claims List */}
          <Grid item xs={12} md={6}>
            <Card sx={{...contentCardStyle, minHeight: listCardMinHeight }}>
              <CardContent sx={{p:2, flexGrow:1, display:'flex', flexDirection:'column'}}>
                <Typography variant={listTitleVariant} component="h3" gutterBottom textAlign="center" sx={{color: theme.palette.text.primary, mb:1.5}}>
                  最新债权提交动态
                </Typography>
                {isRecentSubmissionsLoading ? (
                  <Box sx={{flexGrow: 1, display:'flex', flexDirection: 'column', justifyContent:'center', px:1}}>
                    <Skeleton variant="text" height={40} />
                    <Skeleton variant="text" height={40} />
                    <Skeleton variant="text" height={40} />
                    <Skeleton variant="text" height={40} />
                  </Box>
                ) : liveRecentSubmissions && liveRecentSubmissions.length > 0 ? (
                  <List sx={{ overflowY: 'auto', flexGrow: 1, maxHeight: listCardMinHeight - 60 /* approx title height + padding */ }}>
                    {liveRecentSubmissions.map((item, index) => (
                      <React.Fragment key={item.id}>
                        <ListItem alignItems="flex-start">
                          <ListItemIcon sx={{mr:1, mt:0.5, color: theme.palette.info.main }}>
                            <FileCopyIcon /> 
                          </ListItemIcon>
                          <ListItemText
                            primary={`债权ID: ${item.claimId} - ${item.claimantName}`}
                            secondary={
                              <Typography component="span" variant="body2" color="text.secondary">
                                金额: {item.amount.toLocaleString()} 元 - 时间: {item.time}
                              </Typography>
                            }
                            primaryTypographyProps={{ color: 'text.primary', fontWeight: 'medium', fontSize: '0.95rem' }}
                            secondaryTypographyProps={{ fontSize: '0.85rem' }}
                          />
                        </ListItem>
                        {index < liveRecentSubmissions.length - 1 && <Divider variant="inset" component="li" sx={{borderColor: alpha(theme.palette.grey[700], 0.5)}} />}
                      </React.Fragment>
                    ))}
                  </List>
                ) : (
                  <Box sx={{flexGrow:1, display:'flex', alignItems:'center', justifyContent:'center'}}>
                    <Typography variant="body1" color="text.secondary">暂无最新提交</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Recently Completed Review Actions List */}
          <Grid item xs={12} md={6}>
            <Card sx={{...contentCardStyle, minHeight: listCardMinHeight }}>
              <CardContent sx={{p:2, flexGrow:1, display:'flex', flexDirection:'column'}}>
                <Typography variant={listTitleVariant} component="h3" gutterBottom textAlign="center" sx={{color: theme.palette.text.primary, mb:1.5}}>
                  最新审核动态
                </Typography>
                 {isRecentReviewsLoading ? (
                  <Box sx={{flexGrow: 1, display:'flex', flexDirection: 'column', justifyContent:'center', px:1}}>
                    <Skeleton variant="text" height={40} />
                    <Skeleton variant="text" height={40} />
                    <Skeleton variant="text" height={40} />
                    <Skeleton variant="text" height={40} />
                  </Box>
                ) : liveRecentReviewActions && liveRecentReviewActions.length > 0 ? (
                  <List sx={{ overflowY: 'auto', flexGrow: 1, maxHeight: listCardMinHeight - 60 }}>
                    {liveRecentReviewActions.map((item, index) => (
                      <React.Fragment key={item.id}>
                        <ListItem alignItems="flex-start">
                          <ListItemIcon sx={{mr:1, mt:0.5, 
                            color: item.action === "审核通过" ? theme.palette.statGreen.main : 
                                   item.action === "已驳回" ? theme.palette.statRed.main : 
                                   theme.palette.statYellow.main // Default for other statuses like '补充材料'
                          }}>
                            {item.action === "审核通过" ? <CheckCircleIcon /> : 
                             item.action === "已驳回" ? <CancelIcon /> : 
                             <InfoIcon />}
                          </ListItemIcon>
                          <ListItemText
                            primary={`债权ID: ${item.claimId} - ${item.action}`}
                            secondary={
                              <Typography component="span" variant="body2" color="text.secondary">
                                审核人: {item.reviewerName} - 确认金额: {item.reviewedAmount.toLocaleString()} 元 - 时间: {item.time}
                              </Typography>
                            }
                            primaryTypographyProps={{ color: 'text.primary', fontWeight: 'medium', fontSize: '0.95rem' }}
                            secondaryTypographyProps={{ fontSize: '0.85rem' }}
                          />
                        </ListItem>
                        {index < liveRecentReviewActions.length - 1 && <Divider variant="inset" component="li" sx={{borderColor: alpha(theme.palette.grey[700], 0.5)}} />}
                      </React.Fragment>
                    ))}
                  </List>
                ) : (
                  <Box sx={{flexGrow:1, display:'flex', alignItems:'center', justifyContent:'center'}}>
                    <Typography variant="body1" color="text.secondary">暂无最新审核动态</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ mt: 5, display: 'block' }}>
          此数据大屏将关联到具体案件，通过SurrealDB实时消息监控债权申报和审核变化。
          图表库 `@mui/x-charts` 已用于基本可视化。实时动态列表已更新为动态数据。
        </Typography>
      </Box>
    // </ThemeProvider> // Removed ThemeProvider
  );
};

export default ClaimDataDashboardPage;