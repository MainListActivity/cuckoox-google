import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  Snackbar,
  Button,
  Box,
  Typography,
  Chip,
  LinearProgress,
  IconButton,
  Collapse,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import {
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  SignalWifi3Bar as SignalWifi3BarIcon,
  SignalWifi2Bar as SignalWifi2BarIcon,
  SignalWifi1Bar as SignalWifi1BarIcon,
  SignalWifiOff as SignalWifiOffIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus';

interface NetworkStatusMonitorProps {
  showDetailedInfo?: boolean;
  position?: 'top' | 'bottom';
  autoHide?: boolean;
  autoHideDelay?: number;
}

const NetworkStatusMonitor: React.FC<NetworkStatusMonitorProps> = ({
  showDetailedInfo = false,
  position = 'bottom',
  autoHide = true,
  autoHideDelay = 5000,
}) => {
  const networkStatus = useNetworkStatus();
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const isInitialized = useRef(false);

  const {
    isOnline,
    quality,
    connectionType,
    downlink,
    rtt,
    saveData,
    retryCount,
    lastRetryTime,
    testConnection,
    retry,
    resetRetryCount,
  } = networkStatus;

  // 监听网络状态变化
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      return;
    }
    
    setShowSnackbar(true);
  }, [isOnline]);

  // 自动隐藏通知
  useEffect(() => {
    if (showSnackbar && autoHide && isOnline) {
      const timer = setTimeout(() => {
        setShowSnackbar(false);
      }, autoHideDelay);
      return () => clearTimeout(timer);
    }
  }, [showSnackbar, autoHide, autoHideDelay, isOnline]);

  // 重试连接
  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retry();
    } finally {
      setIsRetrying(false);
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    setIsRetrying(true);
    try {
      await testConnection();
    } finally {
      setIsRetrying(false);
    }
  };

  // 获取质量图标
  const getQualityIcon = () => {
    switch (quality) {
      case 'excellent':
        return <WifiIcon color="success" />;
      case 'good':
        return <SignalWifi3BarIcon color="success" />;
      case 'fair':
        return <SignalWifi2BarIcon color="warning" />;
      case 'poor':
        return <SignalWifi1BarIcon color="error" />;
      case 'offline':
        return <SignalWifiOffIcon color="error" />;
      default:
        return <WifiOffIcon color="action" />;
    }
  };

  // 获取质量颜色
  const getQualityColor = (): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (quality) {
      case 'excellent':
      case 'good':
        return 'success';
      case 'fair':
        return 'warning';
      case 'poor':
      case 'offline':
        return 'error';
      default:
        return 'default';
    }
  };

  // 获取质量标签
  const getQualityLabel = () => {
    const labels = {
      excellent: '优秀',
      good: '良好',
      fair: '一般',
      poor: '较差',
      offline: '离线',
    };
    return labels[quality] || '未知';
  };

  // 获取连接类型标签
  const getConnectionTypeLabel = () => {
    const labels: Record<string, string> = {
      '4g': '4G',
      '3g': '3G',
      '2g': '2G',
      'slow-2g': '慢速2G',
      'wifi': 'WiFi',
      'ethernet': '以太网',
      'unknown': '未知',
    };
    return labels[connectionType] || connectionType;
  };

  // 格式化速度
  const formatSpeed = (speed: number) => {
    if (speed >= 1) {
      return `${speed.toFixed(1)} Mbps`;
    } else {
      return `${(speed * 1000).toFixed(0)} Kbps`;
    }
  };

  // 格式化延迟
  const formatLatency = (latency: number) => {
    return `${latency}ms`;
  };

  return (
    <>
      {/* 网络状态通知 */}
      <Snackbar
        open={showSnackbar}
        anchorOrigin={{ vertical: position, horizontal: 'center' }}
        onClose={() => setShowSnackbar(false)}
      >
        <Alert
          severity={isOnline ? 'success' : 'error'}
          action={
            <Box display="flex" alignItems="center" gap={1}>
              {!isOnline && (
                <Button
                  color="inherit"
                  size="small"
                  onClick={handleRetry}
                  disabled={isRetrying}
                  startIcon={isRetrying ? <LinearProgress size={16} /> : <RefreshIcon />}
                >
                  {isRetrying ? '重试中...' : '重试'}
                </Button>
              )}
              {showDetailedInfo && (
                <IconButton
                  size="small"
                  onClick={() => setShowDetails(!showDetails)}
                  color="inherit"
                >
                  {showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              )}
              <IconButton
                size="small"
                onClick={() => setShowSnackbar(false)}
                color="inherit"
              >
                <CloseIcon />
              </IconButton>
            </Box>
          }
        >
          <Box>
            <Typography variant="body2">
              {isOnline ? '网络连接已恢复' : '网络连接已断开'}
            </Typography>
            {isOnline && (
              <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                {getQualityIcon()}
                <Chip
                  label={getQualityLabel()}
                  color={getQualityColor()}
                  size="small"
                />
                <Typography variant="caption">
                  {getConnectionTypeLabel()}
                </Typography>
              </Box>
            )}
          </Box>
        </Alert>
      </Snackbar>

      {/* 详细网络信息 */}
      {showDetailedInfo && (
        <Collapse in={showDetails}>
          <Card sx={{ mt: 1, mx: 2 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                {getQualityIcon()}
                <Typography variant="h6">
                  网络状态详情
                </Typography>
                <Chip
                  label={isOnline ? '在线' : '离线'}
                  color={isOnline ? 'success' : 'error'}
                  size="small"
                />
              </Box>

              <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={2}>
                {/* 连接质量 */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    连接质量
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip
                      label={getQualityLabel()}
                      color={getQualityColor()}
                      size="small"
                    />
                    <Typography variant="body2" color="textSecondary">
                      {getConnectionTypeLabel()}
                    </Typography>
                  </Box>
                </Box>

                {/* 下载速度 */}
                {downlink > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      下载速度
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <SpeedIcon fontSize="small" />
                      <Typography variant="body2">
                        {formatSpeed(downlink)}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* 网络延迟 */}
                {rtt > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      网络延迟
                    </Typography>
                    <Typography variant="body2">
                      {formatLatency(rtt)}
                    </Typography>
                  </Box>
                )}

                {/* 节省流量模式 */}
                {saveData && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      流量模式
                    </Typography>
                    <Chip
                      label="节省流量"
                      color="info"
                      size="small"
                    />
                  </Box>
                )}

                {/* 重试信息 */}
                {retryCount > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      重试次数
                    </Typography>
                    <Typography variant="body2">
                      {retryCount} 次
                      {lastRetryTime && (
                        <Typography variant="caption" display="block" color="textSecondary">
                          最后重试: {lastRetryTime.toLocaleTimeString()}
                        </Typography>
                      )}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* 网络建议 */}
              {quality === 'poor' || quality === 'offline' && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    网络质量较差可能影响PDF处理性能。建议：
                  </Typography>
                  <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                    <Typography component="li" variant="body2">
                      检查WiFi信号强度或移动网络信号
                    </Typography>
                    <Typography component="li" variant="body2">
                      暂停其他占用带宽的应用
                    </Typography>
                    <Typography component="li" variant="body2">
                      考虑稍后重试或使用更稳定的网络
                    </Typography>
                  </Box>
                </Alert>
              )}
            </CardContent>

            <CardActions>
              <Button
                size="small"
                onClick={handleTestConnection}
                disabled={isRetrying}
                startIcon={<RefreshIcon />}
              >
                测试连接
              </Button>
              {retryCount > 0 && (
                <Button
                  size="small"
                  onClick={resetRetryCount}
                  color="secondary"
                >
                  清除重试记录
                </Button>
              )}
              <Button
                size="small"
                onClick={() => setShowDetails(false)}
              >
                收起
              </Button>
            </CardActions>
          </Card>
        </Collapse>
      )}
    </>
  );
};

export default NetworkStatusMonitor;