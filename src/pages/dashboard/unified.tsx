import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  Skeleton,
  IconButton,
  Menu,
  MenuItem,
  Chip,
} from '@mui/material';
import { 
  grey, orange, red
} from '@mui/material/colors';
import { MoreVert } from '@mui/icons-material';
import { alpha, useTheme, Theme } from '@mui/material/styles';
import { PieChart, BarChart, LineChart } from '@mui/x-charts';
import { 
  FileCopyOutlined as FileCopyIcon, 
  CheckCircleOutline as CheckCircleIcon,
  CancelOutlined as CancelIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';

import { useAuth } from '@/src/contexts/AuthContext';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { 
  useLiveClaimCountForCase,
  useLiveTotalClaimAmount,
  useLiveApprovedClaimAmount,
  useLivePendingClaimAmount,
  useLiveApprovedClaimsCount,
  useLivePendingClaimsCount,
  useLiveUniqueClaimantsCount,
  useLiveTodaysSubmissionsCount,
  useLiveTodaysReviewedClaimsCount,
  useLiveClaimsByStatusChartData,
  useLiveUsersOnlineByRoleChartData,
  useLiveDailyClaimsTrendChartData,
  useLiveClaimsByNatureChartData,
  useLiveRecentSubmissions,
  useLiveRecentReviewActions,
} from '@/src/hooks/useLiveDashboardData';
import { formatAmount } from '@/src/utils/formatters';

// Common styles for the metric cards with trend support
const metricCardStyle = (theme: Theme, borderColorKey: string) => ({
  borderWidth: '1px',
  borderColor: theme.palette[borderColorKey]?.main || theme.palette.primary.main,
  backgroundColor: alpha(theme.palette.background.paper, 0.6),
  boxShadow: `inset 0 1px 2px ${alpha(theme.palette.common.black, 0.7)}, 0 1px 1px ${alpha(theme.palette.common.white, 0.05)}`,
  borderRadius: theme.shape.borderRadius * 1.5,
  transition: theme.transitions.create(['transform', 'box-shadow', 'background-color'], {
    duration: theme.transitions.duration.short,
  }),
  '&:hover': {
    transform: 'scale(1.05)',
    boxShadow: `inset 0 1px 3px ${alpha(theme.palette.common.black, 0.8)}, 0 4px 12px ${alpha(theme.palette[borderColorKey]?.main || theme.palette.primary.main, 0.4)}`,
    backgroundColor: alpha(theme.palette.background.paper, 0.7),
  },
});

const metricCardContentStyle = {
  textAlign: 'center',
  py: 2.5,
};

const metricTitleStyle = (theme: Theme) => ({
  color: theme.palette.text.secondary,
});

const metricValueStyle = (theme: Theme, colorKey: string) => ({
  color: theme.palette[colorKey]?.main || theme.palette.primary.main,
  ...theme.typography.digitalMetric,
  textShadow: `0 0 6px ${alpha(theme.palette[colorKey]?.main || theme.palette.primary.main, 0.5)}`,
});

const UnifiedDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, selectedCaseId } = useAuth();
  const { showSuccess } = useSnackbar();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Menu handlers from index.tsx
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleExportReport = () => {
    showSuccess('报表导出功能开发中...');
    handleMenuClose();
  };

  const handleRefreshData = () => {
    showSuccess('数据已刷新');
    handleMenuClose();
  };

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
    handleMenuClose();
  };

  // Helper function for updating visual cue
  const useIsUpdatingState = <T,>(currentData: T): [boolean, React.Dispatch<React.SetStateAction<boolean>>] => {
    const [isUpdating, setIsUpdating] = useState(false);
    const previousDataRef = React.useRef<T | null>(null);

    useEffect(() => {
      if (previousDataRef.current !== null && JSON.stringify(currentData) !== JSON.stringify(previousDataRef.current)) {
        setIsUpdating(true);
        const timer = setTimeout(() => setIsUpdating(false), 700);
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

  // Live Data for Charts
  const { data: liveClaimsByStatusData, isLoading: isClaimsByStatusLoading } = useLiveClaimsByStatusChartData(selectedCaseId);
  const { data: liveUsersOnlineByRoleData, isLoading: isUsersOnlineLoading } = useLiveUsersOnlineByRoleChartData(selectedCaseId);
  const { data: liveDailyClaimsTrendData, isLoading: isDailyClaimsTrendLoading } = useLiveDailyClaimsTrendChartData(selectedCaseId);
  const { data: liveClaimsByNatureData, isLoading: isClaimsByNatureLoading } = useLiveClaimsByNatureChartData(selectedCaseId);

  // Live Data for Dynamic Lists
  const listLimit = 5; 
  const { data: liveRecentSubmissions, isLoading: isRecentSubmissionsLoading } = useLiveRecentSubmissions(selectedCaseId, listLimit);
  const { data: liveRecentReviewActions, isLoading: isRecentReviewsLoading } = useLiveRecentReviewActions(selectedCaseId, listLimit);

  // Constants
  const appBarHeight = '64px';
  const chartCardMinHeight = 350; 
  const chartMargin = { top: 10, right: 10, bottom: 30, left: 40 };
  const chartTitleVariant = "h5";
  const listCardMinHeight = 300;
  const listTitleVariant = "h5";

  // Common style for content cards
  const contentCardStyle = {
    minHeight: listCardMinHeight,
    display: 'flex',
    flexDirection: 'column',
    border: `1px solid ${alpha(theme.palette.primary.dark, 0.4)}`,
    backgroundColor: alpha(theme.palette.background.paper, 0.7),
    boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.3)}`,
    '&:hover': {
        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
    }
  };

  // Extract case number from selectedCaseId
  const caseNumber = selectedCaseId ? String(selectedCaseId).replace(/^case:/, '') : '';

  return (
    <Box sx={{ p: 3, backgroundColor: theme.palette.background.default, color: theme.palette.text.primary, minHeight: `calc(100vh - ${appBarHeight})` }}>
      <CssBaseline />
      
      {/* Page Header with Actions */}
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h1" gutterBottom textAlign="left" sx={{ color: theme.palette.primary.main, mb: 1 }}>
            {t('dashboard.title', '债权申报数据大屏')}
          </Typography>
          <Typography variant="subtitle1" sx={{ mb: 2, color: theme.palette.text.secondary }}>
            {selectedCaseId 
              ? `实时监控案件 ${caseNumber} 的债权申报与审核动态` 
              : user 
                ? "请从案件列表选择一个案件进行监控" 
                : "请先登录并选择案件"}
          </Typography>
        </Box>
        <Box>
          {caseNumber && (
            <Chip
              label={`${t('dashboard.caseNumber', '案件编号')}: ${caseNumber}`}
              color="primary"
              variant="outlined"
              sx={{ mr: 1 }}
            />
          )}
          <IconButton onClick={handleMenuOpen}>
            <MoreVert />
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
            <MenuItem onClick={handleExportReport}>{t('dashboard.exportReport', '导出报表')}</MenuItem>
            <MenuItem onClick={handleRefreshData}>{t('dashboard.refreshData', '刷新数据')}</MenuItem>
            <MenuItem onClick={handleFullscreen}>{t('dashboard.fullscreen', '全屏显示')}</MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Metric Cards Grid - Row 1 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Today's Submissions Count */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{
            ...metricCardStyle(theme, 'statOrange'), 
            borderColor: isTodaysSubmissionsUpdating ? theme.palette.warning.light : theme.palette.statOrange?.main || orange[400],
            transform: isTodaysSubmissionsUpdating ? 'scale(1.02)' : 'scale(1)',
          }}>
            <CardContent sx={metricCardContentStyle}>
              <Typography variant="h2" gutterBottom sx={metricTitleStyle(theme)}>今日提交笔数</Typography>
              {isTodaysSubmissionsLoading ? <Skeleton variant="text" width="80%" sx={{fontSize: '2.75rem', margin: 'auto'}} /> : (
                <Typography 
                  variant="digitalMetric" 
                  sx={{
                    ...metricValueStyle(theme, 'statOrange'),
                    transform: isTodaysSubmissionsUpdating ? 'scale(1.1)' : 'scale(1)',
                    color: isTodaysSubmissionsUpdating ? theme.palette.warning.light : theme.palette.statOrange?.main || orange[400],
                  }}
                >
                  {liveTodaysSubmissionsCount}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Today's Reviewed Claims Count */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{
            ...metricCardStyle(theme, 'statRed'), 
            borderColor: isTodaysReviewedUpdating ? theme.palette.warning.light : theme.palette.statRed?.main || red[400],
            transform: isTodaysReviewedUpdating ? 'scale(1.02)' : 'scale(1)',
          }}>
            <CardContent sx={metricCardContentStyle}>
              <Typography variant="h2" gutterBottom sx={metricTitleStyle(theme)}>今日审核笔数</Typography>
              {isTodaysReviewedLoading ? <Skeleton variant="text" width="80%" sx={{fontSize: '2.75rem', margin: 'auto'}} /> : (
                <Typography variant="digitalMetric" sx={{
                  ...metricValueStyle(theme, 'statRed'),
                  transform: isTodaysReviewedUpdating ? 'scale(1.1)' : 'scale(1)',
                  color: isTodaysReviewedUpdating ? theme.palette.warning.light : theme.palette.statRed?.main || red[400],
                }}>
                  {liveTodaysReviewedClaimsCount}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Total Number of Claims */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{
            ...metricCardStyle(theme, 'statBlue'), 
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
                    transform: isTotalClaimsUpdating ? 'scale(1.1)' : 'scale(1)',
                    color: isTotalClaimsUpdating ? theme.palette.warning.light : theme.palette.statBlue.main,
                  }}
                >
                  {liveTotalClaims}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Total Approved Claims */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{
            ...metricCardStyle(theme, 'statGreen'),
            borderColor: isApprovedClaimsCountUpdating ? theme.palette.warning.light : theme.palette.statGreen.main,
            transform: isApprovedClaimsCountUpdating ? 'scale(1.02)' : 'scale(1)',
          }}>
            <CardContent sx={metricCardContentStyle}>
              <Typography variant="h2" gutterBottom sx={metricTitleStyle(theme)}>当前已审批总笔数</Typography>
              {isApprovedClaimsCountLoading ? <Skeleton variant="text" width="80%" sx={{fontSize: '2.75rem', margin: 'auto'}} /> : (
                <Typography variant="digitalMetric" sx={{
                  ...metricValueStyle(theme, 'statGreen'),
                  transform: isApprovedClaimsCountUpdating ? 'scale(1.1)' : 'scale(1)',
                  color: isApprovedClaimsCountUpdating ? theme.palette.warning.light : theme.palette.statGreen.main,
                }}>
                  {liveApprovedClaimsCount}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Metric Cards Grid - Row 2 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Total Pending Claims */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{
            ...metricCardStyle(theme, 'statYellow'),
            borderColor: isPendingClaimsCountUpdating ? theme.palette.warning.light : theme.palette.statYellow.main,
            transform: isPendingClaimsCountUpdating ? 'scale(1.02)' : 'scale(1)',
          }}>
            <CardContent sx={metricCardContentStyle}>
              <Typography variant="h2" gutterBottom sx={metricTitleStyle(theme)}>当前待审总笔数</Typography>
              {isPendingClaimsCountLoading ? <Skeleton variant="text" width="80%" sx={{fontSize: '2.75rem', margin: 'auto'}} /> : (
                <Typography variant="digitalMetric" sx={{
                  ...metricValueStyle(theme, 'statYellow'),
                  transform: isPendingClaimsCountUpdating ? 'scale(1.1)' : 'scale(1)',
                  color: isPendingClaimsCountUpdating ? theme.palette.warning.light : theme.palette.statYellow.main,
                }}>
                  {livePendingClaimsCount}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Number of Unique Claimants */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{
            ...metricCardStyle(theme, 'statPurple'),
            borderColor: isUniqueClaimantsCountUpdating ? theme.palette.warning.light : theme.palette.statPurple.main,
            transform: isUniqueClaimantsCountUpdating ? 'scale(1.02)' : 'scale(1)',
          }}>
            <CardContent sx={metricCardContentStyle}>
              <Typography variant="h2" gutterBottom sx={metricTitleStyle(theme)}>当前申请债权人数量</Typography>
              {isUniqueClaimantsCountLoading ? <Skeleton variant="text" width="80%" sx={{fontSize: '2.75rem', margin: 'auto'}} /> : (
                <Typography variant="digitalMetric" sx={{
                  ...metricValueStyle(theme, 'statPurple'),
                  transform: isUniqueClaimantsCountUpdating ? 'scale(1.1)' : 'scale(1)',
                  color: isUniqueClaimantsCountUpdating ? theme.palette.warning.light : theme.palette.statPurple.main,
                }}>
                  {liveUniqueClaimantsCount}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Amount Cards Grid - Row 3 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Total Claimed Amount */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{
            ...metricCardStyle(theme, 'statBlue'),
            borderColor: isTotalClaimAmountUpdating ? theme.palette.warning.light : theme.palette.statBlue.main,
            transform: isTotalClaimAmountUpdating ? 'scale(1.02)' : 'scale(1)',
          }}>
            <CardContent sx={metricCardContentStyle}>
              <Typography variant="h2" gutterBottom sx={metricTitleStyle(theme)}>当前申请总金额</Typography>
              {isTotalClaimAmountLoading ? <Skeleton variant="text" width="80%" sx={{fontSize: '2.75rem', margin: 'auto'}} /> : (
                <Typography variant="digitalMetric" sx={{
                  ...metricValueStyle(theme, 'statBlue'),
                  transform: isTotalClaimAmountUpdating ? 'scale(1.1)' : 'scale(1)',
                  color: isTotalClaimAmountUpdating ? theme.palette.warning.light : theme.palette.statBlue.main,
                }}>
                  ¥{formatAmount(liveTotalClaimAmount)}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Total Approved Amount */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{
            ...metricCardStyle(theme, 'statGreen'),
            borderColor: isApprovedClaimAmountUpdating ? theme.palette.warning.light : theme.palette.statGreen.main,
            transform: isApprovedClaimAmountUpdating ? 'scale(1.02)' : 'scale(1)',
          }}>
            <CardContent sx={metricCardContentStyle}>
              <Typography variant="h2" gutterBottom sx={metricTitleStyle(theme)}>当前已审批总金额</Typography>
              {isApprovedClaimAmountLoading ? <Skeleton variant="text" width="80%" sx={{fontSize: '2.75rem', margin: 'auto'}} /> : (
                <Typography variant="digitalMetric" sx={{
                  ...metricValueStyle(theme, 'statGreen'),
                  transform: isApprovedClaimAmountUpdating ? 'scale(1.1)' : 'scale(1)',
                  color: isApprovedClaimAmountUpdating ? theme.palette.warning.light : theme.palette.statGreen.main,
                }}>
                  ¥{formatAmount(liveApprovedClaimAmount)}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Total Pending Amount */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{
            ...metricCardStyle(theme, 'statYellow'),
            borderColor: isPendingClaimAmountUpdating ? theme.palette.warning.light : theme.palette.statYellow.main,
            transform: isPendingClaimAmountUpdating ? 'scale(1.02)' : 'scale(1)',
          }}>
            <CardContent sx={metricCardContentStyle}>
              <Typography variant="h2" gutterBottom sx={metricTitleStyle(theme)}>当前待审总金额</Typography>
              {isPendingClaimAmountLoading ? <Skeleton variant="text" width="80%" sx={{fontSize: '2.75rem', margin: 'auto'}} /> : (
                <Typography variant="digitalMetric" sx={{
                  ...metricValueStyle(theme, 'statYellow'),
                  transform: isPendingClaimAmountUpdating ? 'scale(1.1)' : 'scale(1)',
                  color: isPendingClaimAmountUpdating ? theme.palette.warning.light : theme.palette.statYellow.main,
                }}>
                  ¥{formatAmount(livePendingClaimAmount)}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Chart Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Claims Status Distribution Chart */}
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
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

        {/* User Online Distribution Chart */}
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
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
                  series={[{ dataKey: 'count', label: '在线用户数' }]}
                  layout="vertical"
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

        {/* Daily Claims Trend Chart */}
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
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
                    { dataKey: 'count', label: '申报笔数', color: theme.palette.chartGreen.main, curve: "catmullRom" },
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

        {/* Claims by Nature Chart */}
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
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
        {/* Recent Submissions List */}
        <Grid size={{ xs: 12, md: 6 }}>
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
                <List sx={{ overflowY: 'auto', flexGrow: 1, maxHeight: listCardMinHeight - 60 }}>
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
                              金额: ¥{formatAmount(item.amount)} - 时间: {item.time}
                            </Typography>
                          }
                          primaryTypographyProps={{ color: 'text.primary', fontWeight: 'medium', fontSize: '0.95rem' }}
                          secondaryTypographyProps={{ fontSize: '0.85rem' }}
                        />
                      </ListItem>
                      {index < liveRecentSubmissions.length - 1 && <Divider variant="inset" component="li" sx={{borderColor: alpha(grey[700], 0.5)}} />}
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

        {/* Recent Review Actions List */}
        <Grid size={{ xs: 12, md: 6 }}>
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
                                 theme.palette.statYellow.main
                        }}>
                          {item.action === "审核通过" ? <CheckCircleIcon /> : 
                           item.action === "已驳回" ? <CancelIcon /> : 
                           <InfoIcon />}
                        </ListItemIcon>
                        <ListItemText
                          primary={`债权ID: ${item.claimId} - ${item.action}`}
                          secondary={
                            <Typography component="span" variant="body2" color="text.secondary">
                              审核人: {item.reviewerName} - 确认金额: ¥{formatAmount(item.reviewedAmount)} - 时间: {item.time}
                            </Typography>
                          }
                          primaryTypographyProps={{ color: 'text.primary', fontWeight: 'medium', fontSize: '0.95rem' }}
                          secondaryTypographyProps={{ fontSize: '0.85rem' }}
                        />
                      </ListItem>
                      {index < liveRecentReviewActions.length - 1 && <Divider variant="inset" component="li" sx={{borderColor: alpha(grey[700], 0.5)}} />}
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
        此数据大屏实时监控债权申报和审核变化，通过SurrealDB Live Query技术实现毫秒级数据同步。
      </Typography>
    </Box>
  );
};

export default UnifiedDashboardPage;