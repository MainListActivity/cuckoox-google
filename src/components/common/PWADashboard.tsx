import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Alert,
  Stack,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import Icon from '@mdi/react';
import {
  mdiCellphone,
  mdiWifi,
  mdiSpeedometer,
  mdiShield,
  mdiBell,
  mdiSync,
  mdiInformation,
  mdiRefresh,
  mdiDownload
} from '@mdi/js';

// 导入PWA相关组件
import { NetworkStatusIndicator } from './NetworkStatusIndicator';
import { OfflineStatusIndicator } from './OfflineStatusIndicator';
import { PWAPerformanceMonitor } from './PWAPerformanceMonitor';
import { PushNotificationManager } from './PushNotificationManager';
import { PWACrossPlatformAdapter, usePlatformDetection } from './PWACrossPlatformAdapter';

// 导入Hooks
import { useNetworkState } from '../../hooks/useNetworkState';
import { usePushNotification } from '../../hooks/usePushNotification';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';
import { usePWAInstall, usePWAUpdate } from '../../utils/pwaUtils';

interface PWADashboardProps {
  /**
   * VAPID公钥（用于推送通知）
   */
  vapidPublicKey?: string;
  
  /**
   * 服务器端点
   */
  serverEndpoint?: string;
  
  /**
   * 用户ID
   */
  userId?: string;
  
  /**
   * 是否显示高级设置
   */
  showAdvancedSettings?: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`pwa-tabpanel-${index}`}
      aria-labelledby={`pwa-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

/**
 * PWA综合管理面板
 * 
 * 集成所有PWA功能的统一管理界面
 */
export const PWADashboard: React.FC<PWADashboardProps> = ({
  vapidPublicKey = '',
  serverEndpoint,
  userId,
  showAdvancedSettings = false
}) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [showInstallDialog, setShowInstallDialog] = useState(false);

  // PWA功能Hooks
  const { networkState, isOnline } = useNetworkState();
  const platformInfo = usePlatformDetection();
  const { 
    canInstall, 
    isInstalled, 
    showInstallPrompt 
  } = usePWAInstall();
  const { updateInfo } = usePWAUpdate();
  const {
    isSupported: pushSupported,
    permission: pushPermission,
    isSubscribed: pushSubscribed
  } = usePushNotification({
    vapidPublicKey,
    serverEndpoint,
    userId
  });
  const {
    metrics,
    appShellState,
    performanceGrades,
    isAppShellReady
  } = usePerformanceMonitor();

  // 计算PWA整体状态
  const pwaOverallStatus = {
    isFullyInstalled: isInstalled && isAppShellReady,
    hasGoodPerformance: performanceGrades.overall === 'good',
    hasNetworkSupport: isOnline,
    hasNotifications: pushSupported && pushSubscribed,
    isSecure: window.location.protocol === 'https:',
    grade: (() => {
      const checks = [
        isInstalled,
        isAppShellReady,
        performanceGrades.overall !== 'poor',
        isOnline,
        window.location.protocol === 'https:'
      ];
      const passedChecks = checks.filter(Boolean).length;
      
      if (passedChecks >= 4) return 'excellent';
      if (passedChecks >= 3) return 'good';
      if (passedChecks >= 2) return 'fair';
      return 'poor';
    })()
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleInstallPWA = async () => {
    if (canInstall) {
      const success = await showInstallPrompt();
      if (success) {
        setShowInstallDialog(false);
      }
    }
  };

  const getStatusColor = (grade: string) => {
    switch (grade) {
      case 'excellent': return 'success';
      case 'good': return 'success';
      case 'fair': return 'warning';
      case 'poor': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (grade: string) => {
    switch (grade) {
      case 'excellent': return 'PWA状态优秀';
      case 'good': return 'PWA状态良好';
      case 'fair': return 'PWA状态一般';
      case 'poor': return 'PWA需要优化';
      default: return 'PWA状态未知';
    }
  };

  return (
    <PWACrossPlatformAdapter>
      <Box sx={{ width: '100%' }}>
        {/* PWA状态概览 */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
              <Box display="flex" alignItems="center" gap={2}>
                <Icon path={mdiCellphone} size={1.5} />
                <Box>
                  <Typography variant="h5" gutterBottom>
                    PWA应用状态
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    渐进式Web应用功能总览
                  </Typography>
                </Box>
              </Box>
              <Chip
                label={getStatusText(pwaOverallStatus.grade)}
                color={getStatusColor(pwaOverallStatus.grade) as any}
                size="large"
                icon={<Icon path={mdiInformation} size={0.8} />}
              />
            </Stack>

            {/* 快速状态指示器 */}
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Box textAlign="center">
                  <Chip
                    label={isInstalled ? '已安装' : '未安装'}
                    color={isInstalled ? 'success' : 'default'}
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="caption" display="block">
                    PWA安装状态
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box textAlign="center">
                  <Chip
                    label={isOnline ? '在线' : '离线'}
                    color={isOnline ? 'success' : 'warning'}
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="caption" display="block">
                    网络状态
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box textAlign="center">
                  <Chip
                    label={performanceGrades.overall}
                    color={getStatusColor(performanceGrades.overall) as any}
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="caption" display="block">
                    性能等级
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box textAlign="center">
                  <Chip
                    label={pushSubscribed ? '已启用' : '未启用'}
                    color={pushSubscribed ? 'success' : 'default'}
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="caption" display="block">
                    推送通知
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* 安装提示 */}
            {canInstall && !isInstalled && (
              <Alert 
                severity="info" 
                sx={{ mt: 2 }}
                action={
                  <Button 
                    size="small"
                    onClick={() => setShowInstallDialog(true)}
                    startIcon={<Icon path={mdiDownload} size={0.7} />}
                  >
                    立即安装
                  </Button>
                }
              >
                检测到您可以将此应用安装到设备桌面，获得更好的使用体验。
              </Alert>
            )}

            {/* 更新提示 */}
            {updateInfo?.isUpdateAvailable && (
              <Alert 
                severity="warning" 
                sx={{ mt: 2 }}
                action={
                  <Button 
                    size="small"
                    onClick={updateInfo.skipWaiting}
                    startIcon={<Icon path={mdiRefresh} size={0.7} />}
                  >
                    立即更新
                  </Button>
                }
              >
                检测到应用有新版本可用，建议立即更新以获得最新功能。
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* 详细功能选项卡 */}
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={currentTab} 
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab 
                icon={<Icon path={mdiWifi} size={0.8} />}
                label="网络状态" 
                id="pwa-tab-0" 
              />
              <Tab 
                icon={<Icon path={mdiSpeedometer} size={0.8} />}
                label="性能监控" 
                id="pwa-tab-1" 
              />
              <Tab 
                icon={<Icon path={mdiBell} size={0.8} />}
                label="推送通知" 
                id="pwa-tab-2" 
              />
              {showAdvancedSettings && (
                <Tab 
                  icon={<Icon path={mdiShield} size={0.8} />}
                  label="安全设置" 
                  id="pwa-tab-3" 
                />
              )}
              <Tab 
                icon={<Icon path={mdiSync} size={0.8} />}
                label="同步设置" 
                id="pwa-tab-4" 
              />
            </Tabs>
          </Box>

          {/* 网络状态标签页 */}
          <TabPanel value={currentTab} index={0}>
            <Stack spacing={3}>
              <NetworkStatusIndicator
                networkState={networkState}
                showDetails={true}
                size="large"
              />
              <OfflineStatusIndicator
                mode="card"
                showQuality={true}
                showReconnect={true}
                showSyncStatus={true}
              />
            </Stack>
          </TabPanel>

          {/* 性能监控标签页 */}
          <TabPanel value={currentTab} index={1}>
            <PWAPerformanceMonitor
              showDetails={true}
              autoRefresh={true}
              refreshInterval={30000}
            />
          </TabPanel>

          {/* 推送通知标签页 */}
          <TabPanel value={currentTab} index={2}>
            {vapidPublicKey ? (
              <PushNotificationManager
                vapidPublicKey={vapidPublicKey}
                serverEndpoint={serverEndpoint}
                userId={userId}
                showSettings={true}
              />
            ) : (
              <Alert severity="warning">
                推送通知功能需要配置VAPID公钥
              </Alert>
            )}
          </TabPanel>

          {/* 安全设置标签页 */}
          {showAdvancedSettings && (
            <TabPanel value={currentTab} index={3}>
              <Alert severity="info" sx={{ mb: 2 }}>
                安全功能在后台自动运行，包括数据加密、自动锁定等。
              </Alert>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        数据加密
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        敏感数据自动加密存储
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        自动锁定
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        30分钟无活动后自动锁定
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </TabPanel>
          )}

          {/* 同步设置标签页 */}
          <TabPanel value={currentTab} index={showAdvancedSettings ? 4 : 3}>
            <Alert severity="info" sx={{ mb: 2 }}>
              数据同步功能基于SurrealDB Live Query实现，在网络恢复时自动同步。
            </Alert>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      实时同步
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {isOnline ? '✓ 实时同步已启用' : '⚠ 离线状态，暂停同步'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      后台同步
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      应用后台时保持数据同步
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>
        </Card>

        {/* PWA安装对话框 */}
        <Dialog 
          open={showInstallDialog} 
          onClose={() => setShowInstallDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <Icon path={mdiDownload} size={1} />
              安装PWA应用
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              将CuckooX安装到您的设备，享受更好的使用体验：
            </Typography>
            <Box component="ul" sx={{ pl: 2 }}>
              <li>独立窗口运行，无浏览器地址栏</li>
              <li>更快的启动速度</li>
              <li>离线访问支持</li>
              <li>推送通知功能</li>
              <li>桌面快捷图标</li>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              平台：{platformInfo.platform} | 
              设备：{platformInfo.isMobile ? '移动设备' : platformInfo.isTablet ? '平板' : '桌面'}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowInstallDialog(false)}>
              取消
            </Button>
            <Button 
              onClick={handleInstallPWA}
              variant="contained"
              startIcon={<Icon path={mdiDownload} size={0.8} />}
            >
              立即安装
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PWACrossPlatformAdapter>
  );
};

export default PWADashboard;