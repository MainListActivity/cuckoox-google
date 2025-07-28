import React, { useState, useEffect } from 'react';
import {
  Box,
  Chip,
  Tooltip,
  IconButton,
  Popover,
  Typography,
  LinearProgress,
  Alert,
  Stack
} from '@mui/material';
import Icon from '@mdi/react';
import {
  mdiWifi,
  mdiWifiOff,
  mdiSignalCellular1,
  mdiSignalCellular2,
  mdiSignalCellular3,
  mdiSignalCellularOutline,
  mdiSpeedometer,
  mdiCloudOffOutline,
  mdiRefresh
} from '@mdi/js';
import type { NetworkState } from '../workers/network-state-manager';

interface NetworkStatusIndicatorProps {
  /**
   * 网络状态数据
   */
  networkState: NetworkState;
  
  /**
   * 是否显示详细信息
   */
  showDetails?: boolean;
  
  /**
   * 点击刷新的回调
   */
  onRefresh?: () => void;
  
  /**
   * 组件大小
   */
  size?: 'small' | 'medium' | 'large';
  
  /**
   * 是否隐藏离线提示
   */
  hideOfflineAlert?: boolean;
}

/**
 * 网络状态指示器组件
 * 
 * 显示当前网络连接状态，包括：
 * - 在线/离线状态
 * - 网络类型和质量
 * - 连接速度信息
 * - 详细的网络参数
 */
export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
  networkState,
  showDetails = false,
  onRefresh,
  size = 'medium',
  hideOfflineAlert = false
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (showDetails) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleRefresh = async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => setIsRefreshing(false), 1000);
      }
    }
  };

  const open = Boolean(anchorEl);

  // 计算网络质量
  const getNetworkQuality = (): number => {
    if (!networkState.isOnline) return 0;

    let score = 100;

    // 根据有效类型调整分数
    const typeScores = {
      'slow-2g': 20,
      '2g': 40,
      '3g': 70,
      '4g': 100
    };
    score = typeScores[networkState.effectiveType] || 100;

    // 根据延迟调整
    if (networkState.rtt > 1000) score *= 0.5;
    else if (networkState.rtt > 500) score *= 0.7;
    else if (networkState.rtt > 200) score *= 0.9;

    // 根据带宽调整
    if (networkState.downlink < 0.5) score *= 0.5;
    else if (networkState.downlink < 1.5) score *= 0.7;
    else if (networkState.downlink < 5) score *= 0.9;

    return Math.round(Math.max(0, Math.min(100, score)));
  };

  // 获取状态图标
  const getStatusIcon = () => {
    if (!networkState.isOnline) {
      return mdiWifiOff;
    }

    const quality = getNetworkQuality();
    if (networkState.connectionType === 'wifi') {
      return mdiWifi;
    }

    // 移动网络信号强度
    if (quality >= 75) return mdiSignalCellular3;
    if (quality >= 50) return mdiSignalCellular2;
    if (quality >= 25) return mdiSignalCellular1;
    return mdiSignalCellularOutline;
  };

  // 获取状态颜色
  const getStatusColor = () => {
    if (!networkState.isOnline) return 'error';
    
    const quality = getNetworkQuality();
    if (quality >= 70) return 'success';
    if (quality >= 40) return 'warning';
    return 'error';
  };

  // 获取状态文本
  const getStatusText = () => {
    if (!networkState.isOnline) return '离线';
    
    const quality = getNetworkQuality();
    if (quality >= 80) return '网络良好';
    if (quality >= 60) return '网络一般';
    if (quality >= 30) return '网络较慢';
    return '网络很慢';
  };

  // 获取网络类型显示文本
  const getConnectionTypeText = () => {
    const typeMap = {
      'wifi': 'WiFi',
      '4g': '4G',
      '3g': '3G',
      '2g': '2G',
      'unknown': '未知'
    };
    return typeMap[networkState.connectionType] || '未知';
  };

  const iconSize = size === 'small' ? 16 : size === 'large' ? 24 : 20;

  return (
    <Box>
      {/* 离线警告（如果需要） */}
      {!hideOfflineAlert && !networkState.isOnline && (
        <Alert 
          severity="warning" 
          icon={<Icon path={mdiCloudOffOutline} size={0.8} />}
          sx={{ mb: 1 }}
        >
          当前处于离线状态，部分功能可能不可用
        </Alert>
      )}

      {/* 网络状态指示器 */}
      <Tooltip 
        title={`${getStatusText()} - ${getConnectionTypeText()}`}
        arrow
      >
        <Chip
          icon={<Icon path={getStatusIcon()} size={iconSize / 16} />}
          label={getStatusText()}
          color={getStatusColor() as any}
          variant={networkState.isOnline ? 'filled' : 'outlined'}
          size={size}
          onClick={showDetails ? handleClick : undefined}
          clickable={showDetails}
          sx={{
            cursor: showDetails ? 'pointer' : 'default',
            '& .MuiChip-icon': {
              color: 'inherit'
            }
          }}
        />
      </Tooltip>

      {/* 刷新按钮 */}
      {onRefresh && (
        <Tooltip title="刷新网络状态">
          <IconButton
            size={size}
            onClick={handleRefresh}
            disabled={isRefreshing}
            sx={{ ml: 1 }}
          >
            <Icon 
              path={mdiRefresh} 
              size={iconSize / 16}
              spin={isRefreshing}
            />
          </IconButton>
        </Tooltip>
      )}

      {/* 详细信息弹出框 */}
      {showDetails && (
        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'center',
          }}
        >
          <Box sx={{ p: 2, minWidth: 280 }}>
            <Typography variant="h6" gutterBottom>
              网络连接详情
            </Typography>

            <Stack spacing={2}>
              {/* 基本状态 */}
              <Box>
                <Typography variant="body2" color="text.secondary">
                  连接状态
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Icon path={getStatusIcon()} size={0.8} />
                  <Typography>
                    {networkState.isOnline ? '在线' : '离线'} - {getConnectionTypeText()}
                  </Typography>
                </Box>
              </Box>

              {/* 网络质量 */}
              {networkState.isOnline && (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    网络质量
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <LinearProgress
                      variant="determinate"
                      value={getNetworkQuality()}
                      color={getStatusColor() as any}
                      sx={{ flexGrow: 1, height: 6 }}
                    />
                    <Typography variant="body2">
                      {getNetworkQuality()}%
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* 技术参数 */}
              {networkState.isOnline && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    技术参数
                  </Typography>
                  <Stack spacing={1}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2">有效类型：</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {networkState.effectiveType.toUpperCase()}
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
                    {networkState.saveData && (
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">数据节省：</Typography>
                        <Typography variant="body2" fontWeight="medium" color="warning.main">
                          已启用
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </Box>
              )}

              {/* 最后更新时间 */}
              <Box>
                <Typography variant="body2" color="text.secondary">
                  最后更新：{new Date(networkState.timestamp).toLocaleTimeString()}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Popover>
      )}
    </Box>
  );
};

export default NetworkStatusIndicator;