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
  SvgIcon,
} from '@mui/material';
import { 
  grey, orange, red
} from '@mui/material/colors';
import { MoreVert } from '@mui/icons-material';
import { alpha, useTheme, Theme } from '@mui/material/styles';
import { 
  mdiChartLine,
  mdiTrendingUp,
  mdiClock,
  mdiAccountMultiple,
  mdiCurrencyUsd,
  mdiCheckCircle,
  mdiFolderOpen,
  mdiClipboardCheck,
  mdiTimerSand,
} from '@mdi/js';

// Import responsive components
import ResponsiveStatsCards, { StatCardData } from '@/src/components/common/ResponsiveStatsCards';
import MobileOptimizedLayout from '@/src/components/mobile/MobileOptimizedLayout';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';
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
  const { isMobile } = useResponsiveLayout();
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
  const { data: liveTotalClaims, isLoading: isTotalClaimsLoading } = useLiveClaimCountForCase(selectedCaseId ? String(selectedCaseId) : null);
  const [isTotalClaimsUpdating] = useIsUpdatingState(liveTotalClaims);

  const { data: liveApprovedClaimsCount, isLoading: isApprovedClaimsCountLoading } = useLiveApprovedClaimsCount(selectedCaseId ? String(selectedCaseId) : null);
  const [isApprovedClaimsCountUpdating] = useIsUpdatingState(liveApprovedClaimsCount);

  const { data: livePendingClaimsCount, isLoading: isPendingClaimsCountLoading } = useLivePendingClaimsCount(selectedCaseId ? String(selectedCaseId) : null);
  const [isPendingClaimsCountUpdating] = useIsUpdatingState(livePendingClaimsCount);

  const { data: liveUniqueClaimantsCount, isLoading: isUniqueClaimantsCountLoading } = useLiveUniqueClaimantsCount(selectedCaseId ? String(selectedCaseId) : null);
  const [isUniqueClaimantsCountUpdating] = useIsUpdatingState(liveUniqueClaimantsCount);

  const { data: liveTodaysSubmissionsCount, isLoading: isTodaysSubmissionsLoading } = useLiveTodaysSubmissionsCount(selectedCaseId ? String(selectedCaseId) : null);
  const [isTodaysSubmissionsUpdating] = useIsUpdatingState(liveTodaysSubmissionsCount);

  const { data: liveTodaysReviewedClaimsCount, isLoading: isTodaysReviewedLoading } = useLiveTodaysReviewedClaimsCount(selectedCaseId ? String(selectedCaseId) : null);
  const [isTodaysReviewedUpdating] = useIsUpdatingState(liveTodaysReviewedClaimsCount);
  
  const { data: liveTotalClaimAmount, isLoading: isTotalClaimAmountLoading } = useLiveTotalClaimAmount(selectedCaseId ? String(selectedCaseId) : null);
  const [isTotalClaimAmountUpdating] = useIsUpdatingState(liveTotalClaimAmount);

  const { data: liveApprovedClaimAmount, isLoading: isApprovedClaimAmountLoading } = useLiveApprovedClaimAmount(selectedCaseId ? String(selectedCaseId) : null);
  const [isApprovedClaimAmountUpdating] = useIsUpdatingState(liveApprovedClaimAmount);

  const { data: livePendingClaimAmount, isLoading: isPendingClaimAmountLoading } = useLivePendingClaimAmount(selectedCaseId ? String(selectedCaseId) : null);
  const [isPendingClaimAmountUpdating] = useIsUpdatingState(livePendingClaimAmount);

  // Live Data for Charts
  const { data: liveClaimsByStatusData, isLoading: isClaimsByStatusLoading } = useLiveClaimsByStatusChartData(selectedCaseId ? String(selectedCaseId) : null);
  const { data: liveUsersOnlineByRoleData, isLoading: isUsersOnlineLoading } = useLiveUsersOnlineByRoleChartData(selectedCaseId ? String(selectedCaseId) : null);
  const { data: liveDailyClaimsTrendData, isLoading: isDailyClaimsTrendLoading } = useLiveDailyClaimsTrendChartData(selectedCaseId ? String(selectedCaseId) : null);
  const { data: liveClaimsByNatureData, isLoading: isClaimsByNatureLoading } = useLiveClaimsByNatureChartData(selectedCaseId ? String(selectedCaseId) : null);

  // Live Data for Dynamic Lists
  const listLimit = 5; 
  const { data: liveRecentSubmissions, isLoading: isRecentSubmissionsLoading } = useLiveRecentSubmissions(selectedCaseId ? String(selectedCaseId) : null, listLimit);
  const { data: liveRecentReviewActions, isLoading: isRecentReviewsLoading } = useLiveRecentReviewActions(selectedCaseId ? String(selectedCaseId) : null, listLimit);

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

  // Prepare stats data for ResponsiveStatsCards
  const statsData: StatCardData[] = [
    {
      id: 'todays_submissions',
      label: '今日提交笔数',
      value: liveTodaysSubmissionsCount || 0,
      icon: mdiClock,
      color: theme.palette.statOrange?.main || orange[400],
      bgColor: alpha(theme.palette.statOrange?.main || orange[400], 0.1),
      loading: isTodaysSubmissionsLoading,
      showAnimation: isTodaysSubmissionsUpdating,
    },
    {
      id: 'todays_reviewed',
      label: '今日审核笔数',
      value: liveTodaysReviewedClaimsCount || 0,
      icon: mdiClipboardCheck,
      color: theme.palette.statRed?.main || red[400],
      bgColor: alpha(theme.palette.statRed?.main || red[400], 0.1),
      loading: isTodaysReviewedLoading,
      showAnimation: isTodaysReviewedUpdating,
    },
    {
      id: 'total_claims',
      label: '当前申请总笔数',
      value: liveTotalClaims || 0,
      icon: mdiFolderOpen,
      color: theme.palette.statBlue?.main || theme.palette.primary.main,
      bgColor: alpha(theme.palette.statBlue?.main || theme.palette.primary.main, 0.1),
      loading: isTotalClaimsLoading,
      showAnimation: isTotalClaimsUpdating,
    },
    {
      id: 'approved_claims',
      label: '当前已审批总笔数',
      value: liveApprovedClaimsCount || 0,
      icon: mdiCheckCircle,
      color: theme.palette.statGreen?.main || theme.palette.success.main,
      bgColor: alpha(theme.palette.statGreen?.main || theme.palette.success.main, 0.1),
      loading: isApprovedClaimsCountLoading,
      showAnimation: isApprovedClaimsCountUpdating,
    },
    {
      id: 'pending_claims',
      label: '当前待审总笔数',
      value: livePendingClaimsCount || 0,
      icon: mdiTimerSand,
      color: theme.palette.statYellow?.main || theme.palette.warning.main,
      bgColor: alpha(theme.palette.statYellow?.main || theme.palette.warning.main, 0.1),
      loading: isPendingClaimsCountLoading,
      showAnimation: isPendingClaimsCountUpdating,
    },
    {
      id: 'unique_claimants',
      label: '当前申请债权人数量',
      value: liveUniqueClaimantsCount || 0,
      icon: mdiAccountMultiple,
      color: theme.palette.statPurple?.main || theme.palette.info.main,
      bgColor: alpha(theme.palette.statPurple?.main || theme.palette.info.main, 0.1),
      loading: isUniqueClaimantsCountLoading,
      showAnimation: isUniqueClaimantsCountUpdating,
    },
    {
      id: 'total_amount',
      label: '当前申请总金额',
      value: `¥${formatAmount(liveTotalClaimAmount)}`,
      icon: mdiCurrencyUsd,
      color: theme.palette.statBlue?.main || theme.palette.primary.main,
      bgColor: alpha(theme.palette.statBlue?.main || theme.palette.primary.main, 0.1),
      loading: isTotalClaimAmountLoading,
      showAnimation: isTotalClaimAmountUpdating,
    },
    {
      id: 'approved_amount',
      label: '当前已审批总金额',
      value: `¥${formatAmount(liveApprovedClaimAmount)}`,
      icon: mdiTrendingUp,
      color: theme.palette.statGreen?.main || theme.palette.success.main,
      bgColor: alpha(theme.palette.statGreen?.main || theme.palette.success.main, 0.1),
      loading: isApprovedClaimAmountLoading,
      showAnimation: isApprovedClaimAmountUpdating,
    },
    {
      id: 'pending_amount',
      label: '当前待审总金额',
      value: `¥${formatAmount(livePendingClaimAmount)}`,
      icon: mdiChartLine,
      color: theme.palette.statYellow?.main || theme.palette.warning.main,
      bgColor: alpha(theme.palette.statYellow?.main || theme.palette.warning.main, 0.1),
      loading: isPendingClaimAmountLoading,
      showAnimation: isPendingClaimAmountUpdating,
    },
  ];

  // Mobile vs Desktop rendering
  if (isMobile) {
    return (
      <MobileOptimizedLayout
        title="数据大屏"
        showBackButton={false}
        fabConfig={{
          icon: mdiChartLine,
          action: () => handleRefreshData(),
          ariaLabel: "刷新数据",
        }}
      >
        <Box sx={{ p: 2 }}>
          {/* Statistics Cards - Mobile */}
          <Box sx={{ mb: 3 }}>
            <ResponsiveStatsCards
              stats={statsData}
              loading={isTotalClaimsLoading || isApprovedClaimsCountLoading || isPendingClaimsCountLoading}
              variant="compact"
              columns={{ xs: 2, sm: 2 }}
              showTrend={false}
              animationEnabled={true}
            />
          </Box>

          {/* Case Info Card - Mobile */}
          {selectedCaseId && (
            <Card sx={{ mb: 3, backgroundColor: alpha(theme.palette.primary.main, 0.1) }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h6" color="primary" gutterBottom>
                  当前监控案件
                </Typography>
                <Chip
                  label={`案件编号: ${caseNumber}`}
                  color="primary"
                  variant="filled"
                  size="small"
                />
              </CardContent>
            </Card>
          )}

          {/* Recent Activities Summary - Mobile Only */}
          <Grid container spacing={2}>
            <Grid size={12}>
              <Card sx={contentCardStyle}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom color="primary" textAlign="center">
                    最新动态
                  </Typography>
                  {isRecentSubmissionsLoading ? (
                    <Box>
                      <Skeleton variant="text" height={30} />
                      <Skeleton variant="text" height={30} />
                    </Box>
                  ) : liveRecentSubmissions && liveRecentSubmissions.length > 0 ? (
                    <List dense>
                      {liveRecentSubmissions.slice(0, 3).map((item, index) => (
                        <ListItem key={item.id} disableGutters>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <FileCopyIcon fontSize="small" color="info" />
                          </ListItemIcon>
                          <ListItemText
                            primary={`${item.claimantName} 提交债权`}
                            secondary={`¥${formatAmount(item.amount)}`}
                            primaryTypographyProps={{ fontSize: '0.85rem' }}
                            secondaryTypographyProps={{ fontSize: '0.75rem' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                      暂无最新提交
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </MobileOptimizedLayout>
    );
  }

  // Desktop rendering
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

      {/* Statistics Cards - Desktop */}
      <Box sx={{ mb: 4 }}>
        <ResponsiveStatsCards
          stats={statsData}
          loading={isTotalClaimsLoading || isApprovedClaimsCountLoading || isPendingClaimsCountLoading}
          variant="detailed"
          columns={{ xs: 2, sm: 2, md: 3, lg: 4, xl: 5 }}
          showTrend={false}
          animationEnabled={true}
        />
      </Box>
      
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