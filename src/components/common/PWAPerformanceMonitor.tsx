import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Grid,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import Icon from '@mdi/react';
import {
  mdiSpeedometer,
  mdiMemory,
  mdiCached,
  mdiRefresh,
  mdiTune,
  mdiInformation,
  mdiAlertCircle,
  mdiCheckCircle,
  mdiTimerOutline,
  mdiChartLine,
  mdiDelete
} from '@mdi/js';
import type { PerformanceMetrics, AppShellState } from '../workers/pwa-performance-manager';

interface PWAPerformanceMonitorProps {
  /**
   * 是否显示详细信息
   */
  showDetails?: boolean;
  
  /**
   * 刷新间隔（毫秒）
   */
  refreshInterval?: number;
  
  /**
   * 是否自动刷新
   */
  autoRefresh?: boolean;
  
  /**
   * 自定义样式
   */
  sx?: any;
}

/**
 * PWA性能监控组件
 * 
 * 显示应用性能指标和App Shell状态
 */
export const PWAPerformanceMonitor: React.FC<PWAPerformanceMonitorProps> = ({
  showDetails = true,
  refreshInterval = 30000,
  autoRefresh = true,
  sx
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fcp: 0,
    lcp: 0,
    fid: 0,
    cls: 0,
    ttfb: 0,
    memoryUsage: 0,
    cacheHitRate: 0
  });
  
  const [appShellState, setAppShellState] = useState<AppShellState>({
    isLoaded: false,
    coreResourcesCount: 0,
    loadedResourcesCount: 0,
    loadingProgress: 0,
    lastUpdated: new Date()
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    // 初始加载
    loadPerformanceData();

    // 设置自动刷新
    if (autoRefresh) {
      const interval = setInterval(loadPerformanceData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const loadPerformanceData = async () => {
    try {
      await Promise.all([
        loadPerformanceMetrics(),
        loadAppShellState()
      ]);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading performance data:', error);
    }
  };

  const loadPerformanceMetrics = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        
        if (registration.active) {
          registration.active.postMessage({
            type: 'get_performance_metrics',
            messageId: `perf_metrics_${Date.now()}`
          });

          // 监听响应
          const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'get_performance_metrics_response') {
              setMetrics(event.data.payload.metrics);
              navigator.serviceWorker.removeEventListener('message', handleMessage);
            }
          };

          navigator.serviceWorker.addEventListener('message', handleMessage);
        }
      }
    } catch (error) {
      console.error('Error loading performance metrics:', error);
    }
  };

  const loadAppShellState = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        
        if (registration.active) {
          registration.active.postMessage({
            type: 'get_app_shell_state',
            messageId: `app_shell_${Date.now()}`
          });

          // 监听响应
          const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'get_app_shell_state_response') {
              setAppShellState(event.data.payload.state);
              navigator.serviceWorker.removeEventListener('message', handleMessage);
            }
          };

          navigator.serviceWorker.addEventListener('message', handleMessage);
        }
      }
    } catch (error) {
      console.error('Error loading App Shell state:', error);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await loadPerformanceData();
    } finally {
      setIsLoading(false);
    }
  };

  const handleMemoryCleanup = async () => {
    setIsLoading(true);
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        
        if (registration.active) {
          registration.active.postMessage({
            type: 'force_memory_cleanup'
          });
        }
      }
      
      // 等待清理完成后刷新数据
      setTimeout(() => {
        loadPerformanceData();
        setIsLoading(false);
        setShowCleanupDialog(false);
      }, 2000);
    } catch (error) {
      console.error('Error during memory cleanup:', error);
      setIsLoading(false);
    }
  };

  const getPerformanceGrade = (metric: number, thresholds: { good: number; fair: number }): {
    grade: 'good' | 'fair' | 'poor';
    color: 'success' | 'warning' | 'error';
  } => {
    if (metric <= thresholds.good) {
      return { grade: 'good', color: 'success' };
    } else if (metric <= thresholds.fair) {
      return { grade: 'fair', color: 'warning' };
    } else {
      return { grade: 'poor', color: 'error' };
    }
  };

  const formatTime = (ms: number): string => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(2)}s`;
    }
    return `${Math.round(ms)}ms`;
  };

  const formatMemory = (mb: number): string => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)}GB`;
    }
    return `${Math.round(mb)}MB`;
  };

  const fcpGrade = getPerformanceGrade(metrics.fcp, { good: 1800, fair: 3000 });
  const lcpGrade = getPerformanceGrade(metrics.lcp, { good: 2500, fair: 4000 });
  const fidGrade = getPerformanceGrade(metrics.fid, { good: 100, fair: 300 });

  return (
    <Box sx={sx}>
      {/* 性能概览卡片 */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <Icon path={mdiSpeedometer} size={1.2} />
              <Typography variant="h6">
                性能监控
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Tooltip title="刷新数据">
                <IconButton size="small" onClick={handleRefresh} disabled={isLoading}>
                  <Icon path={mdiRefresh} size={0.8} spin={isLoading} />
                </IconButton>
              </Tooltip>
              <Tooltip title="内存清理">
                <IconButton size="small" onClick={() => setShowCleanupDialog(true)}>
                  <Icon path={mdiDelete} size={0.8} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          {/* App Shell 状态 */}
          <Box mb={3}>
            <Typography variant="subtitle2" gutterBottom>
              App Shell 状态
            </Typography>
            <Stack direction="row" alignItems="center" spacing={2}>
              <LinearProgress
                variant="determinate"
                value={appShellState.loadingProgress}
                color={appShellState.isLoaded ? 'success' : 'primary'}
                sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
              />
              <Typography variant="body2" fontWeight="medium">
                {appShellState.loadingProgress}%
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {appShellState.loadedResourcesCount} / {appShellState.coreResourcesCount} 核心资源已加载
            </Typography>
          </Box>

          {/* 核心性能指标 */}
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Stack alignItems="center" spacing={1}>
                  <Chip
                    label="FCP"
                    color={fcpGrade.color}
                    size="small"
                    icon={<Icon path={mdiTimerOutline} size={0.6} />}
                  />
                  <Typography variant="h6" fontWeight="bold">
                    {formatTime(metrics.fcp)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    首次内容绘制
                  </Typography>
                </Stack>
              </Box>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Stack alignItems="center" spacing={1}>
                  <Chip
                    label="LCP"
                    color={lcpGrade.color}
                    size="small"
                    icon={<Icon path={mdiChartLine} size={0.6} />}
                  />
                  <Typography variant="h6" fontWeight="bold">
                    {formatTime(metrics.lcp)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    最大内容绘制
                  </Typography>
                </Stack>
              </Box>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Stack alignItems="center" spacing={1}>
                  <Chip
                    label="FID"
                    color={fidGrade.color}
                    size="small"
                    icon={<Icon path={mdiTune} size={0.6} />}
                  />
                  <Typography variant="h6" fontWeight="bold">
                    {formatTime(metrics.fid)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    首次输入延迟
                  </Typography>
                </Stack>
              </Box>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Stack alignItems="center" spacing={1}>
                  <Chip
                    label="内存"
                    color={metrics.memoryUsage > 100 ? 'warning' : 'success'}
                    size="small"
                    icon={<Icon path={mdiMemory} size={0.6} />}
                  />
                  <Typography variant="h6" fontWeight="bold">
                    {formatMemory(metrics.memoryUsage)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    内存使用
                  </Typography>
                </Stack>
              </Box>
            </Grid>
          </Grid>

          {/* 详细信息 */}
          {showDetails && (
            <Box mt={3}>
              <Typography variant="subtitle2" gutterBottom>
                详细指标
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <Icon path={mdiTimerOutline} size={1} />
                  </ListItemIcon>
                  <ListItemText
                    primary={`TTFB: ${formatTime(metrics.ttfb)}`}
                    secondary="首字节时间"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Icon path={mdiChartLine} size={1} />
                  </ListItemIcon>
                  <ListItemText
                    primary={`CLS: ${metrics.cls.toFixed(3)}`}
                    secondary="累积布局偏移"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Icon path={mdiCached} size={1} />
                  </ListItemIcon>
                  <ListItemText
                    primary={`缓存命中率: ${metrics.cacheHitRate.toFixed(1)}%`}
                    secondary="资源缓存效率"
                  />
                </ListItem>
              </List>
            </Box>
          )}

          {/* 最后更新时间 */}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            最后更新：{lastUpdate.toLocaleTimeString()}
          </Typography>
        </CardContent>
      </Card>

      {/* 性能建议 */}
      {(fcpGrade.grade !== 'good' || lcpGrade.grade !== 'good' || fidGrade.grade !== 'good') && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>
            性能优化建议：
          </Typography>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {fcpGrade.grade !== 'good' && (
              <li>首次内容绘制较慢，建议优化关键渲染路径</li>
            )}
            {lcpGrade.grade !== 'good' && (
              <li>最大内容绘制较慢，建议优化主要内容的加载</li>
            )}
            {fidGrade.grade !== 'good' && (
              <li>首次输入延迟较高，建议减少主线程阻塞</li>
            )}
            {metrics.memoryUsage > 100 && (
              <li>内存使用较高，建议清理缓存或重启应用</li>
            )}
          </ul>
        </Alert>
      )}

      {/* 内存清理确认对话框 */}
      <Dialog open={showCleanupDialog} onClose={() => setShowCleanupDialog(false)}>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Icon path={mdiDelete} size={1} />
            内存清理
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography>
            是否要执行内存清理？这将清理过期缓存和未使用的资源，可能会暂时影响应用性能。
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            当前内存使用：{formatMemory(metrics.memoryUsage)}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCleanupDialog(false)}>
            取消
          </Button>
          <Button 
            onClick={handleMemoryCleanup} 
            disabled={isLoading}
            variant="contained"
          >
            {isLoading ? '清理中...' : '确认清理'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PWAPerformanceMonitor;