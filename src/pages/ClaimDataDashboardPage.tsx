import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  ThemeProvider,
  createTheme,
  CssBaseline,
} from '@mui/material';
import { teal, cyan, green, yellow, purple, grey } from '@mui/material/colors';
import { alpha } from '@mui/material/styles';

// Local Dark Theme Definition
const localDarkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: teal[300], light: teal[200] },
    secondary: { main: cyan[400] },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    text: {
      primary: '#ffffff',
      secondary: grey[400],
      disabled: grey[600],
    },
    statBlue: { main: cyan[400] },
    statGreen: { main: green[400] },
    statYellow: { main: yellow[400] },
    statPurple: { main: purple[300] },
    statRed: { main: yellow[700] }, // For rejected claims, if added
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
    h1: { fontWeight: 700, letterSpacing: '0.05em', color: teal[200], fontSize: '2.5rem' }, // Adjusted size
    h2: { fontWeight: 600, color: grey[300], fontSize: '1.25rem' }, // Card titles
    h3: { fontWeight: 700, color: cyan[300], fontSize: '2rem' }, // Large numbers in cards
    subtitle1: { color: grey[500], fontSize: '0.9rem' },
    body2: { fontSize: '0.8rem' },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          '&:hover': {
            transform: 'scale(1.03)',
            boxShadow: `0px 8px 20px ${alpha(theme.palette.primary.main, 0.25)}`,
          },
        }),
      },
    },
  },
});

const ClaimDataDashboardPage: React.FC = () => {
  // TODO: Fetch real-time data from SurrealDB for the selected case
  // TODO: Implement actual charts and visualizations

  // Mock data for placeholders
  const mockData = {
    usersLoggedIn: { admin: 2, manager: 5, creditor_user: 50 },
    claimsSubmitted: 120,
    claimsApproved: 80,
    claimsRejected: 15,
    claimsPending: 25,
    totalClaimAmount: 15000000,
    approvedClaimAmount: 9500000,
    pendingClaimAmount: 3000000,
    creditorCount: 95,
  };
  // Assume AppBar height is 64px for minHeight calculation
  const appBarHeight = '64px';


  return (
    <ThemeProvider theme={localDarkTheme}>
      <CssBaseline />
      <Box sx={{ p: 3, backgroundColor: 'background.default', color: 'text.primary', minHeight: `calc(100vh - ${appBarHeight})` }}>
        <Typography variant="h1" gutterBottom textAlign="center" mb={1}>债权申报数据大屏</Typography>
        <Typography variant="subtitle1" textAlign="center" sx={{ mb: 5 }}>实时监控案件ID: [Selected Case ID] 的债权申报与审核动态</Typography>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{borderColor: 'statBlue.main'}}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h2" gutterBottom sx={{color: 'text.secondary'}}>当前申请总笔数</Typography>
                <Typography variant="h3" sx={{color: 'statBlue.main'}}>{mockData.claimsSubmitted}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{borderColor: 'statGreen.main'}}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h2" gutterBottom sx={{color: 'text.secondary'}}>当前已审批总笔数</Typography>
                <Typography variant="h3" sx={{color: 'statGreen.main'}}>{mockData.claimsApproved}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{borderColor: 'statYellow.main'}}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h2" gutterBottom sx={{color: 'text.secondary'}}>当前待审总笔数</Typography>
                <Typography variant="h3" sx={{color: 'statYellow.main'}}>{mockData.claimsPending}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{borderColor: 'statPurple.main'}}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h2" gutterBottom sx={{color: 'text.secondary'}}>当前申请债权人数量</Typography>
                <Typography variant="h3" sx={{color: 'statPurple.main'}}>{mockData.creditorCount}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h2" gutterBottom sx={{color: 'text.secondary'}}>当前申请总金额</Typography>
                <Typography variant="h3" sx={{color: 'statBlue.main'}}>{mockData.totalClaimAmount.toLocaleString()} 元</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h2" gutterBottom sx={{color: 'text.secondary'}}>当前已审批总金额</Typography>
                <Typography variant="h3" sx={{color: 'statGreen.main'}}>{mockData.approvedClaimAmount.toLocaleString()} 元</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h2" gutterBottom sx={{color: 'text.secondary'}}>当前待审总金额</Typography>
                <Typography variant="h3" sx={{color: 'statYellow.main'}}>{mockData.pendingClaimAmount.toLocaleString()} 元</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <Card sx={{ minHeight: 300, display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="h5" component="h3" gutterBottom textAlign="center">债权状态分布 (Placeholder Chart)</Typography>
                <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                  <Typography variant="body2" color="text.disabled">Chart: Approved vs. Pending vs. Rejected Claims</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} lg={6}>
            <Card sx={{ minHeight: 300, display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="h5" component="h3" gutterBottom textAlign="center">用户活动 (Placeholder Chart)</Typography>
                <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                  <Typography variant="body2" color="text.disabled">Chart: Logged-in users by role (Admin, Manager, Creditor)</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ mt: 5, display: 'block' }}>
          此数据大屏将关联到具体案件，通过SurrealDB实时消息监控债权申报和审核变化。
          需要使用图表库（如Chart.js, Recharts, ECharts）来实现大气、美观、科技感十足的可视化效果。
          当前为样式和布局占位。
        </Typography>
      </Box>
    </ThemeProvider>
  );
};

export default ClaimDataDashboardPage;