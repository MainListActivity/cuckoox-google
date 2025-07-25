import React, { useState, useEffect } from 'react';
import {
  Snackbar,
  Alert,
  Button,
  Box,
  Typography,
  CircularProgress
} from '@mui/material';
import { mdiRefresh, mdiDownload } from '@mdi/js';
import Icon from '@mdi/react';
import { usePWAUpdate } from '@/src/utils/pwaUtils';

interface PWAUpdateNotificationProps {
  autoCheckInterval?: number; // 自动检查更新间隔（毫秒）
}

const PWAUpdateNotification: React.FC<PWAUpdateNotificationProps> = ({
  autoCheckInterval = 30 * 60 * 1000 // 默认30分钟检查一次
}) => {
  const { updateInfo, checkForUpdates } = usePWAUpdate();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  // 自动检查更新
  useEffect(() => {
    const checkUpdates = async () => {
      try {
        await checkForUpdates();
      } catch (error) {
        console.error('Failed to check for updates:', error);
      }
    };

    // 立即检查一次
    checkUpdates();

    // 设置定期检查
    const interval = setInterval(checkUpdates, autoCheckInterval);

    return () => clearInterval(interval);
  }, [checkForUpdates, autoCheckInterval]);

  // 监听更新信息变化
  useEffect(() => {
    if (updateInfo?.isUpdateAvailable) {
      setShowNotification(true);
    }
  }, [updateInfo]);

  // 处理更新
  const handleUpdate = async () => {
    if (!updateInfo?.skipWaiting) return;

    setIsUpdating(true);
    try {
      await updateInfo.skipWaiting();
      // skipWaiting 会刷新页面，所以这里的代码可能不会执行
    } catch (error) {
      console.error('Failed to update:', error);
      setIsUpdating(false);
    }
  };

  // 关闭通知
  const handleClose = () => {
    setShowNotification(false);
  };

  if (!updateInfo?.isUpdateAvailable) {
    return null;
  }

  return (
    <Snackbar
      open={showNotification}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ mt: 8 }} // 避免与其他通知重叠
    >
      <Alert
        severity="info"
        onClose={handleClose}
        sx={{
          width: '100%',
          alignItems: 'center'
        }}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              color="inherit"
              size="small"
              onClick={handleUpdate}
              disabled={isUpdating}
              startIcon={
                isUpdating ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <Icon path={mdiRefresh} size={0.7} />
                )
              }
            >
              {isUpdating ? '更新中...' : '立即更新'}
            </Button>
          </Box>
        }
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            <Icon 
              path={mdiDownload} 
              size={0.8} 
              style={{ marginRight: 8, verticalAlign: 'middle' }} 
            />
            应用更新可用
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            发现新版本，建议立即更新以获得最新功能和修复
          </Typography>
        </Box>
      </Alert>
    </Snackbar>
  );
};

export default PWAUpdateNotification;