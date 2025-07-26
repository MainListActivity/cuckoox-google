import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Alert,
  AlertTitle,
  Snackbar,
  Button,
  LinearProgress,
  Typography,
  Fade,
  Card,
  CardContent,
  CardActions,
  Stack,
  Chip,
  SxProps,
  Theme
} from '@mui/material';
import Icon from '@mdi/react';
import {
  mdiCloudOffOutline,
  mdiCloudCheckOutline,
  mdiWifiStrength1,
  mdiWifiStrength2,
  mdiWifiStrength3,
  mdiWifiStrength4,
  mdiWifiOff,
  mdiRefresh,
  mdiCloudSyncOutline
} from '@mdi/js';
import { useNetworkState } from '../../hooks/useNetworkState';

interface OfflineStatusProps {
  /**
   * 显示模式
   */
  mode?: 'banner' | 'snackbar' | 'card' | 'indicator';
  
  /**
   * 是否显示网络质量信息
   */
  showQuality?: boolean;
  
  /**
   * 是否显示重连按钮
   */
  showReconnect?: boolean;
  
  /**
   * 是否显示数据同步状态
   */
  showSyncStatus?: boolean;
  
  /**
   * 自定义样式
   */
  sx?: SxProps<Theme>;
  
  /**
   * 重连回调
   */
  onReconnect?: () => Promise<void>;
  
  /**
   * 同步数据回调
   */
  onSync?: () => Promise<void>;
}

/**
 * 离线状态指示器组件
 * 
 * 提供多种形式的网络状态显示和用户交互
 */
export const OfflineStatusIndicator: React.FC<OfflineStatusProps> = ({
  mode = 'banner',
  showQuality = true,
  showReconnect = true,
  showSyncStatus = false,
  sx,
  onReconnect,
  onSync
}) => {
  const { 
    networkState, 
    isOnline, 
    isOffline, 
    networkQuality, 
    checkNetworkState,
    isChecking 
  } = useNetworkState();

  const [showSnackbar, setShowSnackbar] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // 监听网络状态变化
  useEffect(() => {
    if (isOffline && !wasOffline) {
      // 从在线变为离线
      setWasOffline(true);
      if (mode === 'snackbar') {
        setShowSnackbar(true);
      }
    } else if (isOnline && wasOffline) {
      // 从离线恢复在线
      setWasOffline(false);
      if (mode === 'snackbar') {
        setShowSnackbar(true);
        // 自动触发数据同步
        if (onSync) {
          handleSync();
        }
      }
    }
  }, [isOnline, isOffline, wasOffline, mode, handleSync]);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      await checkNetworkState();
      if (onReconnect) {
        await onReconnect();
      }
    } catch (error) {
      console.error('Reconnection failed:', error);
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleSync = useCallback(async () => {
    if (!onSync || !isOnline) return;
    
    setIsSyncing(true);
    try {
      await onSync();
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [onSync, isOnline]);

  const getNetworkIcon = () => {
    if (isOffline) return mdiWifiOff;
    
    if (networkQuality >= 80) return mdiWifiStrength4;
    if (networkQuality >= 60) return mdiWifiStrength3;
    if (networkQuality >= 40) return mdiWifiStrength2;
    return mdiWifiStrength1;
  };

  const getStatusColor = (): 'error' | 'warning' | 'success' => {
    if (isOffline) return 'error';
    if (networkQuality >= 70) return 'success';
    if (networkQuality >= 40) return 'warning';
    return 'error';
  };

  const getStatusText = () => {
    if (isOffline) return '当前处于离线状态';
    if (networkQuality >= 80) return '网络连接良好';
    if (networkQuality >= 60) return '网络连接一般';
    if (networkQuality >= 30) return '网络连接较慢';
    return '网络连接很慢';
  };

  // Banner 模式
  if (mode === 'banner') {
    if (isOnline && networkQuality >= 70) return null; // 网络良好时不显示

    return (
      <Fade in timeout={300}>
        <Alert
          severity={getStatusColor()}
          icon={<Icon path={getNetworkIcon()} size={1} />}
          sx={{ mb: 2, ...sx }}
          action={
            <Stack direction="row" spacing={1}>
              {showQuality && (
                <Chip
                  label={`${networkQuality}%`}
                  size="small"
                  color={getStatusColor()}
                  variant="outlined"
                />
              )}
              {showReconnect && (
                <Button
                  size="small"
                  onClick={handleReconnect}
                  disabled={isReconnecting || isChecking}
                  startIcon={<Icon path={mdiRefresh} size={0.7} spin={isReconnecting || isChecking} />}
                >
                  {isReconnecting ? '重连中...' : '检查网络'}
                </Button>
              )}
              {showSyncStatus && isOnline && onSync && (
                <Button
                  size="small"
                  onClick={handleSync}
                  disabled={isSyncing}
                  startIcon={<Icon path={mdiCloudSyncOutline} size={0.7} spin={isSyncing} />}
                >
                  {isSyncing ? '同步中...' : '同步数据'}
                </Button>
              )}
            </Stack>
          }
        >
          <AlertTitle>
            {isOffline ? '离线模式' : '网络状态'}
          </AlertTitle>
          {getStatusText()}
          {isOffline && (
            <>
              <br />
              <Typography variant="body2" component="span" sx={{ opacity: 0.8 }}>
                部分功能可能不可用，网络恢复后将自动同步数据
              </Typography>
            </>
          )}
          {showSyncStatus && lastSyncTime && (
            <>
              <br />
              <Typography variant="body2" component="span" sx={{ opacity: 0.8 }}>
                上次同步：{lastSyncTime.toLocaleTimeString()}
              </Typography>
            </>
          )}
        </Alert>
      </Fade>
    );
  }

  // Snackbar 模式
  if (mode === 'snackbar') {
    return (
      <Snackbar
        open={showSnackbar}
        autoHideDuration={isOffline ? null : 4000}
        onClose={() => setShowSnackbar(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={getStatusColor()}
          icon={<Icon path={isOffline ? mdiCloudOffOutline : mdiCloudCheckOutline} size={1} />}
          onClose={() => setShowSnackbar(false)}
          action={
            showReconnect && isOffline ? (
              <Button
                size="small"
                color="inherit"
                onClick={handleReconnect}
                disabled={isReconnecting}
              >
                重连
              </Button>
            ) : undefined
          }
        >
          {isOffline ? '网络连接已断开' : '网络连接已恢复'}
        </Alert>
      </Snackbar>
    );
  }

  // Card 模式
  if (mode === 'card') {
    return (
      <Card sx={{ ...sx }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} mb={2}>
            <Icon 
              path={getNetworkIcon()} 
              size={1.5} 
              color={isOffline ? '#f44336' : '#4caf50'} 
            />
            <Box flexGrow={1}>
              <Typography variant="h6" gutterBottom>
                网络状态
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {getStatusText()}
              </Typography>
            </Box>
            {showQuality && (
              <Box textAlign="center">
                <Typography variant="h4" color={getStatusColor()}>
                  {networkQuality}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  质量评分
                </Typography>
              </Box>
            )}
          </Stack>

          {showQuality && (
            <Box mb={2}>
              <LinearProgress
                variant="determinate"
                value={networkQuality}
                color={getStatusColor()}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          )}

          {isOnline && (
            <Stack spacing={1}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">连接类型：</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {networkState.connectionType.toUpperCase()}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">下载速度：</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {networkState.downlink.toFixed(1)} Mbps
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">延迟：</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {networkState.rtt}ms
                </Typography>
              </Box>
            </Stack>
          )}
        </CardContent>

        <CardActions>
          {showReconnect && (
            <Button
              size="small"
              onClick={handleReconnect}
              disabled={isReconnecting || isChecking}
              startIcon={<Icon path={mdiRefresh} size={0.7} spin={isReconnecting || isChecking} />}
            >
              {isReconnecting ? '检查中...' : '检查网络'}
            </Button>
          )}
          {showSyncStatus && isOnline && onSync && (
            <Button
              size="small"
              onClick={handleSync}
              disabled={isSyncing}
              startIcon={<Icon path={mdiCloudSyncOutline} size={0.7} spin={isSyncing} />}
            >
              {isSyncing ? '同步中...' : '同步数据'}
            </Button>
          )}
        </CardActions>
      </Card>
    );
  }

  // Indicator 模式（简单指示器）
  if (mode === 'indicator') {
    return (
      <Box 
        display="inline-flex" 
        alignItems="center" 
        gap={1}
        sx={sx}
      >
        <Icon 
          path={getNetworkIcon()} 
          size={0.8} 
          color={isOffline ? '#f44336' : '#4caf50'} 
        />
        {showQuality && (
          <Typography variant="body2" color="text.secondary">
            {networkQuality}%
          </Typography>
        )}
      </Box>
    );
  }

  return null;
};

export default OfflineStatusIndicator;