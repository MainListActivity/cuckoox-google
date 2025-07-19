import React from 'react';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Divider,
  Button,
  CircularProgress
} from '@mui/material';
import {
  WifiOff as OfflineIcon,
  Wifi as OnlineIcon,
  Sync as SyncIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useOfflineManager } from '../hooks/useOfflineManager';

/**
 * 离线状态指示器组件
 * 显示网络状态、离线操作队列状态，并提供离线管理功能
 */
export const OfflineStatusIndicator: React.FC = () => {
  const {
    offlineStatus,
    syncStatus,
    isLoading,
    isOffline,
    pendingOperations,
    hasFailedOperations,
    startOfflineSync,
    clearCompletedOperations,
    retryFailedOperations
  } = useOfflineManager();

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await startOfflineSync();
    } finally {
      setIsSyncing(false);
    }
    handleClose();
  };

  const handleClearCompleted = async () => {
    await clearCompletedOperations();
    handleClose();
  };

  const handleRetryFailed = async () => {
    await retryFailedOperations();
    handleClose();
  };

  // 确定状态图标和颜色
  const getStatusIcon = () => {
    if (isLoading) {
      return <CircularProgress size={16} />;
    }
    
    if (isOffline) {
      return <OfflineIcon />;
    }
    
    if (hasFailedOperations) {
      return <ErrorIcon />;
    }
    
    if (pendingOperations > 0) {
      return <WarningIcon />;
    }
    
    return <OnlineIcon />;
  };

  const getStatusColor = (): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    if (isOffline) return 'error';
    if (hasFailedOperations) return 'error';
    if (pendingOperations > 0) return 'warning';
    return 'success';
  };

  const getStatusText = () => {
    if (isOffline) return '离线';
    if (hasFailedOperations) return '同步失败';
    if (pendingOperations > 0) return `待同步 ${pendingOperations}`;
    return '在线';
  };

  // 格式化网络信息
  const formatNetworkInfo = () => {
    if (!offlineStatus?.networkStatus) return '未知';
    
    const { connectionType, effectiveType, downlink, rtt } = offlineStatus.networkStatus;
    const parts = [];
    
    if (connectionType) parts.push(connectionType);
    if (effectiveType) parts.push(effectiveType);
    if (downlink) parts.push(`${downlink}Mbps`);
    if (rtt) parts.push(`${rtt}ms`);
    
    return parts.length > 0 ? parts.join(', ') : '未知';
  };

  return (
    <Box>
      <Tooltip title={`网络状态: ${getStatusText()}`}>
        <IconButton
          onClick={handleClick}
          size="small"
          color={getStatusColor()}
        >
          <Badge 
            badgeContent={pendingOperations > 0 ? pendingOperations : undefined}
            color="warning"
            max={99}
          >
            {getStatusIcon()}
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: { minWidth: 280, maxWidth: 400 }
        }}
      >
        {/* 网络状态 */}
        <MenuItem disabled>
          <Box sx={{ width: '100%' }}>
            <Typography variant="subtitle2" gutterBottom>
              网络状态
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isOffline ? <OfflineIcon color="error" /> : <OnlineIcon color="success" />}
              <Typography variant="body2">
                {isOffline ? '离线模式' : '在线模式'}
              </Typography>
            </Box>
            {offlineStatus?.networkStatus && (
              <Typography variant="caption" color="text.secondary">
                {formatNetworkInfo()}
              </Typography>
            )}
          </Box>
        </MenuItem>

        <Divider />

        {/* 操作统计 */}
        {offlineStatus?.operationStats && (
          <>
            <MenuItem disabled>
              <Box sx={{ width: '100%' }}>
                <Typography variant="subtitle2" gutterBottom>
                  离线操作队列
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  <Chip
                    label={`待处理: ${offlineStatus.operationStats.pending}`}
                    size="small"
                    color={offlineStatus.operationStats.pending > 0 ? 'warning' : 'default'}
                  />
                  <Chip
                    label={`同步中: ${offlineStatus.operationStats.syncing}`}
                    size="small"
                    color={offlineStatus.operationStats.syncing > 0 ? 'info' : 'default'}
                  />
                  <Chip
                    label={`已完成: ${offlineStatus.operationStats.completed}`}
                    size="small"
                    color={offlineStatus.operationStats.completed > 0 ? 'success' : 'default'}
                  />
                  <Chip
                    label={`失败: ${offlineStatus.operationStats.failed}`}
                    size="small"
                    color={offlineStatus.operationStats.failed > 0 ? 'error' : 'default'}
                  />
                </Box>
              </Box>
            </MenuItem>
            <Divider />
          </>
        )}

        {/* 同步状态 */}
        {syncStatus && (
          <>
            <MenuItem disabled>
              <Box sx={{ width: '100%' }}>
                <Typography variant="subtitle2" gutterBottom>
                  最近同步
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {syncStatus.status === 'started' && <CircularProgress size={16} />}
                  {syncStatus.status === 'completed' && <SuccessIcon color="success" />}
                  {syncStatus.status === 'failed' && <ErrorIcon color="error" />}
                  <Typography variant="body2">
                    {syncStatus.status === 'started' && '同步中...'}
                    {syncStatus.status === 'completed' && 
                      `已完成 (成功: ${syncStatus.successCount}, 失败: ${syncStatus.failureCount})`}
                    {syncStatus.status === 'failed' && `同步失败: ${syncStatus.error}`}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {new Date(syncStatus.timestamp).toLocaleString()}
                </Typography>
              </Box>
            </MenuItem>
            <Divider />
          </>
        )}

        {/* 操作按钮 */}
        <MenuItem onClick={handleSync} disabled={isSyncing}>
          <SyncIcon sx={{ mr: 1 }} />
          {isSyncing ? '同步中...' : '立即同步'}
        </MenuItem>

        {offlineStatus?.operationStats.completed > 0 && (
          <MenuItem onClick={handleClearCompleted}>
            <SuccessIcon sx={{ mr: 1 }} />
            清除已完成操作
          </MenuItem>
        )}

        {offlineStatus?.operationStats.failed > 0 && (
          <MenuItem onClick={handleRetryFailed}>
            <ErrorIcon sx={{ mr: 1 }} />
            重试失败操作
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};