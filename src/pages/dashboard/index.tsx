import React, { useState } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Paper,
  Typography,
  useTheme,
  useMediaQuery,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  LinearProgress,
  Avatar,
  List,
  Divider,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  People,
  AttachMoney,
  Assignment,
  CheckCircle,
  MoreVert,
  PersonOutline,
  BusinessCenter,
} from '@mui/icons-material';
import SvgIcon from '@mui/material/SvgIcon';
import {
  mdiMenu,
  mdiMenuOpen,
  mdiWeatherSunny,
  mdiWeatherNight,
  mdiViewDashboard,
  mdiBriefcase,
  mdiAccountGroup,
  mdiFileDocumentOutline,
  mdiChartBar,
  mdiVideo,
  mdiMessageTextOutline,
  mdiCog,
  mdiLogout,
  mdiTextBoxMultipleOutline,
  mdiFileUploadOutline,
  mdiBriefcaseSearchOutline,
  mdiClose,
} from '@mdi/js';
import {
  LineChart,
  PieChart,
} from '@mui/x-charts';
import StatCard from '@/src/components/dashboard/StatCard';
import RecentActivity from '@/src/components/dashboard/RecentActivity';
import { mockData } from '@/src/data/mockData';
import { formatAmount } from '@/src/utils/formatters';
import { useSnackbar } from '@/src/contexts/SnackbarContext';

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showSuccess } = useSnackbar();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // 图表颜色
  const chartColors = {
    primary: theme.palette.primary.main,
    secondary: theme.palette.secondary.main,
    success: theme.palette.success?.main || '#4caf50',
    warning: theme.palette.warning?.main || '#ff9800',
    error: theme.palette.error?.main || '#f44336',
    info: theme.palette.info?.main || '#2196f3',
  };

  return (
    <Box>
      {/* 页面标题 */}
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h4" fontWeight="bold">
          {t('dashboard.title', '债权申报数据大屏')}
        </Typography>
        <Box>
          <Chip
            label={`${t('dashboard.caseNumber', '案件编号')}: 2024-001`}
            color="primary"
            variant="outlined"
            sx={{ mr: 1 }}
          />
          <IconButton onClick={handleMenuOpen}>
            <MoreVert />
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
            <MenuItem onClick={handleMenuClose}>{t('dashboard.exportReport', '导出报表')}</MenuItem>
            <MenuItem onClick={handleMenuClose}>{t('dashboard.refreshData', '刷新数据')}</MenuItem>
            <MenuItem onClick={handleMenuClose}>{t('dashboard.fullscreen', '全屏显示')}</MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* 统计卡片 */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)',
          },
          gap: 3,
          mb: 3,
        }}
      >
        <StatCard
          title={t('dashboard.totalClaimAmount', '申请总额')}
          value={`¥${formatAmount(mockData.summary.totalClaimAmount)}`}
          icon={<AttachMoney />}
          trend={12.5}
          color="primary"
        />
        <StatCard
          title={t('dashboard.approvedAmount', '已审总额')}
          value={`¥${formatAmount(mockData.summary.approvedAmount)}`}
          icon={<CheckCircle />}
          color="success"
          subtitle={`${t('dashboard.percentage', '占比')} ${((mockData.summary.approvedAmount / mockData.summary.totalClaimAmount) * 100).toFixed(1)}%`}
        />
        <StatCard
          title={t('dashboard.totalClaims', '申请总笔数')}
          value={mockData.summary.totalClaims}
          icon={<Assignment />}
          trend={8.3}
          color="info"
        />
        <StatCard
          title={t('dashboard.totalCreditors', '申报债权人数')}
          value={mockData.summary.totalCreditors}
          icon={<People />}
          color="warning"
        />
      </Box>

      {/* 图表区域 */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: '2fr 1fr',
          },
          gap: 3,
          mb: 3,
        }}
      >
        {/* 趋势图 */}
        <Paper sx={{ p: 3, height: '400px' }}>
          <Typography variant="h6" gutterBottom>
            {t('dashboard.claimTrend', '债权申报趋势')}
          </Typography>
          <LineChart
            width={isMobile ? 300 : 600}
            height={300}
            series={[
              {
                data: mockData.trends.map((item) => item.amount),
                area: true,
                label: t('dashboard.claimAmount', '申报金额'),
                color: chartColors.primary,
              },
              {
                data: mockData.trends.map((item) => item.claims),
                label: t('dashboard.claimCount', '申报笔数'),
                color: chartColors.secondary,
              },
            ]}
            xAxis={[
              {
                data: mockData.trends.map((item) => item.date),
                scaleType: 'band',
              },
            ]}
            sx={{
              '.MuiLineElement-root': {
                strokeWidth: 2,
              },
            }}
          />
        </Paper>

        {/* 在线用户 */}
        <Paper sx={{ p: 3, height: '400px' }}>
          <Typography variant="h6" gutterBottom>
            {t('dashboard.onlineUsers', '在线用户分布')}
          </Typography>
          <Box
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            height="85%"
          >
            <Box textAlign="center" mb={4}>
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: 'primary.main',
                  mb: 2,
                  mx: 'auto',
                }}
              >
                <BusinessCenter fontSize="large" />
              </Avatar>
              <Typography variant="h4" fontWeight="bold">
                {mockData.onlineUsers.administrators}
              </Typography>
              <Typography color="textSecondary">{t('dashboard.adminTeam', '管理人团队')}</Typography>
            </Box>
            <Box textAlign="center">
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: 'secondary.main',
                  mb: 2,
                  mx: 'auto',
                }}
              >
                <PersonOutline fontSize="large" />
              </Avatar>
              <Typography variant="h4" fontWeight="bold">
                {mockData.onlineUsers.creditors}
              </Typography>
              <Typography color="textSecondary">{t('dashboard.creditors', '债权人')}</Typography>
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* 第二行图表 */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, 1fr)',
          },
          gap: 3,
          mb: 3,
        }}
      >
        {/* 债权性质分布 */}
        <Paper sx={{ p: 3, height: '400px' }}>
          <Typography variant="h6" gutterBottom>
            {t('dashboard.claimTypeDistribution', '债权性质分布')}
          </Typography>
          <Box display="flex" justifyContent="center">
            <PieChart
              width={isMobile ? 300 : 350}
              height={300}
              series={[
                {
                  data: mockData.claimTypes.map((type) => ({
                    id: type.label,
                    value: type.value,
                    label: type.label,
                    color: Object.values(chartColors)[mockData.claimTypes.indexOf(type) % Object.values(chartColors).length],
                  })),
                  innerRadius: 30,
                  outerRadius: 100,
                  paddingAngle: 1,
                  cornerRadius: 5,
                  startAngle: -90,
                  endAngle: 270,
                },
              ]}
            />
          </Box>
        </Paper>

        {/* 最近活动 */}
        <Paper sx={{ p: 3, height: '400px', overflow: 'auto' }}>
          <Typography variant="h6" gutterBottom>
            {t('dashboard.recentActivity', '最近活动')}
          </Typography>
          <List>
            {mockData.recentActivities.map((activity) => (
              <React.Fragment key={activity.id}>
                <RecentActivity activity={activity} />
                <Divider variant="inset" component="li" />
              </React.Fragment>
            ))}
          </List>
        </Paper>
      </Box>
    </Box>
  );
};

export default DashboardPage;
