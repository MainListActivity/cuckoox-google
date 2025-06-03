import React, { useState } from 'react';
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
import {
  LineChart,
  PieChart,
  ChartsTooltip,
} from '@mui/x-charts';
import { DefaultizedPieValueType } from '@mui/x-charts/models/seriesType/pie';
import StatCard from 'src/components/StatCard';
import RecentActivity from 'src/components/RecentActivity';
import { mockData, MockData, ClaimType, ReviewStatus, Activity } from 'src/data/mockData';
import { formatAmount } from 'src/utils/formatters';

export const Dashboard: React.FC = () => {
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
    success: theme.palette.success.main,
    warning: theme.palette.warning.main,
    error: theme.palette.error.main,
    info: theme.palette.info.main,
  };

  return (
    <Box>
      {/* 页面标题 */}
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h4" fontWeight="bold">
          债权申报数据大屏
        </Typography>
        <Box>
          <Chip
            label={`案件编号: 2024-001`}
            color="primary"
            variant="outlined"
            sx={{ mr: 1 }}
          />
          <IconButton onClick={handleMenuOpen}>
            <MoreVert />
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
            <MenuItem onClick={handleMenuClose}>导出报表</MenuItem>
            <MenuItem onClick={handleMenuClose}>刷新数据</MenuItem>
            <MenuItem onClick={handleMenuClose}>全屏显示</MenuItem>
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
          title="申请总额"
          value={`¥${formatAmount(mockData.summary.totalClaimAmount)}`}
          icon={<AttachMoney />}
          trend={12.5}
          color="primary"
        />
        <StatCard
          title="已审总额"
          value={`¥${formatAmount(mockData.summary.approvedAmount)}`}
          icon={<CheckCircle />}
          color="success"
          subtitle={`占比 ${((mockData.summary.approvedAmount / mockData.summary.totalClaimAmount) * 100).toFixed(1)}%`}
        />
        <StatCard
          title="申请总笔数"
          value={mockData.summary.totalClaims}
          icon={<Assignment />}
          trend={8.3}
          color="info"
        />
        <StatCard
          title="申报债权人数"
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
            债权申报趋势
          </Typography>
          <LineChart
            width={isMobile ? 300 : 600}
            height={300}
            series={[
              {
                data: mockData.trends.map((item: { amount: number }) => item.amount),
                area: true,
                label: '申报金额',
                color: chartColors.primary,
              },
              {
                data: mockData.trends.map((item: { claims: number }) => item.claims),
                label: '申报笔数',
                color: chartColors.secondary,
              },
            ]}
            xAxis={[
              {
                data: mockData.trends.map((item: { date: string }) => item.date),
                scaleType: 'band',
              },
            ]}
            yAxis={[
              { id: 'leftAxis', scaleType: 'linear' },
              { id: 'rightAxis', scaleType: 'linear' },
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
            在线用户分布
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
              <Typography color="textSecondary">管理人团队</Typography>
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
              <Typography color="textSecondary">债权人</Typography>
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
            债权性质分布
          </Typography>
          <PieChart
            width={isMobile ? 300 : 400}
            height={300}
            series={[
              {
                data: mockData.claimTypes,
                innerRadius: 30,
                outerRadius: isMobile ? 80 : 120,
                paddingAngle: 2,
                cornerRadius: 5,
                startAngle: -90,
                endAngle: 270,
                arcLabel: (item: Omit<DefaultizedPieValueType, "label"> & { label?: string }) => {
                  const typedItem = item as unknown as ClaimType;
                  return `${typedItem.label} ${(typedItem.value / mockData.summary.totalClaims * 100).toFixed(0)}%`;
                },
              },
            ]}
          >
            <ChartsTooltip />
          </PieChart>
        </Paper>

        {/* 审核状态 */}
        <Paper sx={{ p: 3, height: '400px' }}>
          <Typography variant="h6" gutterBottom>
            审核进度
          </Typography>
          <Box mt={3}>
            {mockData.reviewStatus.map((status: ReviewStatus) => (
              <Box key={status.name} mb={3}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">{status.name}</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {status.value} 笔
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(status.value / mockData.summary.totalClaims) * 100}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: theme.palette.grey[300],
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: status.color,
                      borderRadius: 4,
                    },
                  }}
                />
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>

      {/* 实时动态 */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          实时动态
        </Typography>
        <List>
          {mockData.recentActivities.map((activity: Activity, index: number) => (
            <React.Fragment key={activity.id}>
              <RecentActivity activity={activity} />
              {index < mockData.recentActivities.length - 1 && <Divider variant="inset" component="li" />}
            </React.Fragment>
          ))}
        </List>
      </Paper>
    </Box>
  );
};

export default Dashboard;
