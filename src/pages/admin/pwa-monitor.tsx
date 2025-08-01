import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Breadcrumbs,
  Link,
  Alert,
  AlertTitle,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Icon from '@mdi/react';
import { mdiHome, mdiCog, mdiCellphone } from '@mdi/js';

import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';
import { useAuth } from '@/src/contexts/AuthContext';
import { PWADashboard } from '@/src/components/common/PWADashboard';

/**
 * PWA监控管理页面
 * 
 * 为管理员提供PWA应用状态监控和管理功能，包括：
 * - PWA安装状态监控
 * - 网络状态和离线功能监控
 * - 性能指标监控
 * - 推送通知管理
 * - 安全和同步设置监控
 */
const AdminPWAMonitorPage: React.FC = () => {
  const navigate = useNavigate();
  const { isMobile } = useResponsiveLayout();
  const { user } = useAuth();

  // 检查管理员权限
  const isAdmin = user?.github_id === '--admin--';

  if (!isAdmin) {
    return (
      <Box sx={{ p: isMobile ? 2 : 3 }}>
        <Alert severity="error">
          <AlertTitle>访问受限</AlertTitle>
          您没有权限访问PWA监控功能。只有系统管理员可以查看此页面。
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: isMobile ? 2 : 3 }}>
      {/* 面包屑导航 */}
      <Breadcrumbs 
        aria-label="breadcrumb" 
        sx={{ mb: 2 }}
        separator={<Typography color="text.secondary">/</Typography>}
      >
        <Link
          component="button"
          variant="body2"
          onClick={() => navigate('/')}
          sx={{ 
            display: 'flex', 
            alignItems: 'center',
            textDecoration: 'none',
            color: 'text.secondary',
            '&:hover': {
              color: 'primary.main',
              textDecoration: 'underline'
            }
          }}
        >
          <Icon path={mdiHome} size={0.8} style={{ marginRight: '4px' }} />
          首页
        </Link>
        <Link
          component="button"
          variant="body2"
          onClick={() => navigate('/admin')}
          sx={{ 
            display: 'flex', 
            alignItems: 'center',
            textDecoration: 'none',
            color: 'text.secondary',
            '&:hover': {
              color: 'primary.main',
              textDecoration: 'underline'
            }
          }}
        >
          <Icon path={mdiCog} size={0.8} style={{ marginRight: '4px' }} />
          系统管理
        </Link>
        <Typography 
          color="text.primary" 
          variant="body2"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <Icon path={mdiCellphone} size={0.8} style={{ marginRight: '4px' }} />
          PWA监控
        </Typography>
      </Breadcrumbs>

      {/* 页面标题 */}
      <Typography 
        variant={isMobile ? "h5" : "h4"} 
        component="h1" 
        gutterBottom
        sx={{ 
          mb: isMobile ? 2 : 3,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        <Icon path={mdiCellphone} size={isMobile ? 1.2 : 1.5} />
        PWA应用监控
      </Typography>

      {/* 页面描述 */}
      <Typography 
        variant="body1" 
        color="text.secondary" 
        sx={{ mb: 3 }}
      >
        监控和管理渐进式Web应用(PWA)功能，包括安装状态、网络状态、性能指标、推送通知等。
        此功能帮助管理员了解用户的PWA使用情况，优化应用体验。
      </Typography>

      {/* PWA监控面板 */}
      <Paper 
        elevation={1} 
        sx={{ 
          overflow: 'hidden',
          '& .MuiCardContent-root': {
            p: isMobile ? 2 : 3
          }
        }}
      >
        <PWADashboard
          vapidPublicKey={import.meta.env.VITE_VAPID_PUBLIC_KEY || ''}
          serverEndpoint={import.meta.env.VITE_API_BASE_URL || ''}
          userId={user?.id?.toString()}
          showAdvancedSettings={true}
        />
      </Paper>

      {/* 使用说明 */}
      <Alert 
        severity="info" 
        sx={{ mt: 3 }}
        icon={<Icon path={mdiCellphone} size={1} />}
      >
        <AlertTitle>PWA监控说明</AlertTitle>
        <Typography variant="body2" component="div">
          <Box component="ul" sx={{ pl: 2, mt: 1, mb: 0 }}>
            <li><strong>PWA状态</strong>：显示应用的安装状态、网络连接和整体性能等级</li>
            <li><strong>网络监控</strong>：实时监控网络连接状态和离线功能工作情况</li>
            <li><strong>性能监控</strong>：跟踪应用性能指标，包括加载时间和响应速度</li>
            <li><strong>推送通知</strong>：管理推送通知权限和发送状态</li>
            <li><strong>安全同步</strong>：监控数据同步状态和安全设置</li>
          </Box>
        </Typography>
      </Alert>

      {/* 管理员提示 */}
      <Alert 
        severity="warning" 
        sx={{ mt: 2 }}
      >
        <AlertTitle>管理员注意事项</AlertTitle>
        <Typography variant="body2">
          PWA功能的启用和配置会影响所有用户的使用体验。请在进行任何更改前仔细测试，
          确保不会影响正常的系统功能。推荐在非工作时间进行PWA相关的配置更新。
        </Typography>
      </Alert>
    </Box>
  );
};

export default AdminPWAMonitorPage;