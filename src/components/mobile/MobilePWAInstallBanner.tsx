import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  IconButton,
  Typography,
  Slide,
  Paper,
  useTheme,
  useMediaQuery,
  Avatar,
  Chip
} from '@mui/material';
import {
  mdiClose,
  mdiDownload,
  mdiCellphone,
  mdiRocket,
  mdiTrendingUp
} from '@mdi/js';
import Icon from '@mdi/react';
import { 
  mobilePWADetector, 
  shouldShowInstallPrompt,
  getDeviceInfo 
} from '@/src/utils/mobilePWADetector';

interface MobilePWAInstallBannerProps {
  onInstallClick: () => void;
  autoShow?: boolean;
  showDelay?: number;
  autoHideDelay?: number;
  position?: 'top' | 'bottom';
  compact?: boolean;
}

const MobilePWAInstallBanner: React.FC<MobilePWAInstallBannerProps> = ({
  onInstallClick,
  autoShow = true,
  showDelay = 3000,
  autoHideDelay = 10000,
  position = 'bottom',
  compact = false
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState(getDeviceInfo());

  // 检查是否应该显示横幅
  const checkShouldShow = useCallback(() => {
    if (!isMobile || dismissed) return false;
    return shouldShowInstallPrompt();
  }, [isMobile, dismissed]);

  // 显示横幅
  const showBanner = useCallback(() => {
    if (checkShouldShow()) {
      setVisible(true);
      mobilePWADetector.markPromptShown();
      
      // 自动隐藏
      if (autoHideDelay > 0) {
        setTimeout(() => {
          setVisible(false);
        }, autoHideDelay);
      }
    }
  }, [checkShouldShow, autoHideDelay]);

  // 初始化和自动显示逻辑
  useEffect(() => {
    if (!autoShow) return;

    const timer = setTimeout(() => {
      showBanner();
    }, showDelay);

    return () => clearTimeout(timer);
  }, [autoShow, showDelay, showBanner]);

  // 监听安装状态变化
  useEffect(() => {
    const unsubscribe = mobilePWADetector.subscribe((installState) => {
      if (installState.isInstalled) {
        setVisible(false);
        setDismissed(true);
      }
    });

    return unsubscribe;
  }, []);

  // 处理关闭
  const handleDismiss = useCallback(() => {
    setVisible(false);
    setDismissed(true);
    mobilePWADetector.markInstallDismissed();
  }, []);

  // 处理安装点击
  const handleInstallClick = useCallback(() => {
    setVisible(false);
    onInstallClick();
  }, [onInstallClick]);

  // 如果不是移动端或不应该显示，返回null
  if (!isMobile || !visible) {
    return null;
  }

  // 获取横幅样式
  const getBannerStyles = () => {
    const baseStyles = {
      position: 'fixed' as const,
      left: theme.spacing(1),
      right: theme.spacing(1),
      zIndex: theme.zIndex.snackbar,
      borderRadius: theme.spacing(1),
      boxShadow: theme.shadows[8]
    };

    if (position === 'top') {
      return {
        ...baseStyles,
        top: theme.spacing(2)
      };
    } else {
      return {
        ...baseStyles,
        bottom: theme.spacing(2)
      };
    }
  };

  // 紧凑模式横幅
  if (compact) {
    return (
      <Slide 
        in={visible} 
        direction={position === 'top' ? 'down' : 'up'}
        mountOnEnter 
        unmountOnExit
      >
        <Paper sx={getBannerStyles()}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            p: 1.5,
            bgcolor: 'primary.main',
            color: 'primary.contrastText'
          }}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 1.5, width: 32, height: 32 }}>
              <Icon path={mdiCellphone} size={0.7} />
            </Avatar>
            
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                安装CuckooX应用
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9, lineHeight: 1.2 }}>
                更快启动，离线访问
              </Typography>
            </Box>

            <Button
              size="small"
              variant="contained"
              color="secondary"
              onClick={handleInstallClick}
              sx={{ 
                mr: 0.5,
                minWidth: 60,
                px: 1,
                fontSize: '0.75rem'
              }}
            >
              安装
            </Button>

            <IconButton
              size="small"
              onClick={handleDismiss}
              sx={{ color: 'inherit', ml: 0.5 }}
            >
              <Icon path={mdiClose} size={0.6} />
            </IconButton>
          </Box>
        </Paper>
      </Slide>
    );
  }

  // 标准模式横幅
  return (
    <Slide 
      in={visible} 
      direction={position === 'top' ? 'down' : 'up'}
      mountOnEnter 
      unmountOnExit
    >
      <Paper sx={getBannerStyles()}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          p: 2,
          bgcolor: 'primary.main',
          color: 'primary.contrastText'
        }}>
          {/* 应用图标 */}
          <Avatar sx={{ 
            bgcolor: 'rgba(255,255,255,0.2)', 
            mr: 2,
            width: 48,
            height: 48
          }}>
            <Icon path={mdiCellphone} size={1} />
          </Avatar>
          
          {/* 内容区域 */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                安装CuckooX应用
              </Typography>
              {deviceInfo.supportsNativeInstall && (
                <Chip 
                  label="一键安装" 
                  size="small" 
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.2)',
                    color: 'inherit',
                    fontSize: '0.7rem',
                    height: 20
                  }}
                />
              )}
            </Box>
            
            <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
              享受更快的启动速度和离线访问功能
            </Typography>

            {/* 优势标签 */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Icon path={mdiRocket} size={0.5} />
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                  启动快3倍
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Icon path={mdiTrendingUp} size={0.5} />
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                  更流畅
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* 操作按钮 */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, ml: 1 }}>
            <Button
              variant="contained"
              color="secondary"
              size={isSmallScreen ? 'small' : 'medium'}
              onClick={handleInstallClick}
              startIcon={<Icon path={mdiDownload} size={0.7} />}
              sx={{ 
                minWidth: isSmallScreen ? 80 : 100,
                fontSize: isSmallScreen ? '0.75rem' : '0.875rem'
              }}
            >
              安装
            </Button>
            
            <IconButton
              size="small"
              onClick={handleDismiss}
              sx={{ 
                color: 'rgba(255,255,255,0.7)',
                alignSelf: 'center'
              }}
            >
              <Icon path={mdiClose} size={0.7} />
            </IconButton>
          </Box>
        </Box>
      </Paper>
    </Slide>
  );
};

export default MobilePWAInstallBanner;