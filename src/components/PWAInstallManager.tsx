import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  IconButton,
  Snackbar,
  Alert,
  Slide,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { mdiClose, mdiDownload, mdiCellphone, mdiMonitor } from '@mdi/js';
import Icon from '@mdi/react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface InstallPromptState {
  canInstall: boolean;
  isInstalled: boolean;
  installPrompt: BeforeInstallPromptEvent | null;
  platform: string;
}

interface PWAInstallManagerProps {
  autoShowPrompt?: boolean;
  showInstallBanner?: boolean;
  onInstallStateChange?: (state: InstallPromptState) => void;
}

const PWAInstallManager: React.FC<PWAInstallManagerProps> = ({
  autoShowPrompt = true,
  showInstallBanner = true,
  onInstallStateChange
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [installState, setInstallState] = useState<InstallPromptState>({
    canInstall: false,
    isInstalled: false,
    installPrompt: null,
    platform: 'unknown'
  });
  
  const [showDialog, setShowDialog] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // 检测PWA安装状态
  const checkInstallability = useCallback(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    const isInstalled = isStandalone || isInWebAppiOS;
    
    // 检测平台
    const userAgent = navigator.userAgent.toLowerCase();
    let platform = 'desktop';
    if (/android/.test(userAgent)) {
      platform = 'android';
    } else if (/iphone|ipad|ipod/.test(userAgent)) {
      platform = 'ios';
    }
    
    const newState: InstallPromptState = {
      ...installState,
      isInstalled,
      platform
    };
    
    setInstallState(newState);
    onInstallStateChange?.(newState);
    
    return newState;
  }, [installState, onInstallStateChange]);

  // 处理beforeinstallprompt事件
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const installPrompt = e as BeforeInstallPromptEvent;
      
      const newState: InstallPromptState = {
        canInstall: true,
        isInstalled: false,
        installPrompt,
        platform: installState.platform
      };
      
      setInstallState(newState);
      onInstallStateChange?.(newState);
      
      // 自动显示安装提示
      if (autoShowPrompt && showInstallBanner && !bannerDismissed) {
        setTimeout(() => setShowBanner(true), 2000); // 延迟2秒显示
      }
    };

    const handleAppInstalled = () => {
      const newState: InstallPromptState = {
        canInstall: false,
        isInstalled: true,
        installPrompt: null,
        platform: installState.platform
      };
      
      setInstallState(newState);
      onInstallStateChange?.(newState);
      setShowSuccessMessage(true);
      setShowBanner(false);
      setShowDialog(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    // 初始检查
    checkInstallability();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [autoShowPrompt, showInstallBanner, bannerDismissed, checkInstallability, installState.platform, onInstallStateChange]);

  // 显示安装提示
  const showInstallPrompt = useCallback(async () => {
    if (!installState.installPrompt) return false;
    
    try {
      await installState.installPrompt.prompt();
      const choiceResult = await installState.installPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('用户接受了PWA安装');
        return true;
      } else {
        console.log('用户拒绝了PWA安装');
        return false;
      }
    } catch (error) {
      console.error('PWA安装失败:', error);
      return false;
    }
  }, [installState.installPrompt]);

  // 处理安装按钮点击
  const handleInstallClick = async () => {
    setShowDialog(false);
    setShowBanner(false);
    await showInstallPrompt();
  };

  // 关闭横幅
  const handleBannerDismiss = () => {
    setShowBanner(false);
    setBannerDismissed(true);
    // 24小时后重新显示
    setTimeout(() => setBannerDismissed(false), 24 * 60 * 60 * 1000);
  };

  // 获取平台特定的安装说明
  const getInstallInstructions = () => {
    switch (installState.platform) {
      case 'ios':
        return {
          title: '安装到iPhone/iPad',
          steps: [
            '点击浏览器底部的分享按钮',
            '向下滚动找到"添加到主屏幕"',
            '点击"添加"完成安装'
          ],
          icon: mdiCellphone
        };
      case 'android':
        return {
          title: '安装到Android设备',
          steps: [
            '点击下方"安装应用"按钮',
            '在弹出的对话框中点击"安装"',
            '应用将添加到您的主屏幕'
          ],
          icon: mdiCellphone
        };
      default:
        return {
          title: '安装到桌面',
          steps: [
            '点击下方"安装应用"按钮',
            '在弹出的对话框中点击"安装"',
            '应用将添加到您的桌面'
          ],
          icon: mdiMonitor
        };
    }
  };

  const installInstructions = getInstallInstructions();

  // 如果已安装，不显示任何内容
  if (installState.isInstalled) {
    return (
      <Snackbar
        open={showSuccessMessage}
        autoHideDuration={6000}
        onClose={() => setShowSuccessMessage(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setShowSuccessMessage(false)} severity="success">
          CuckooX 已成功安装到您的设备！
        </Alert>
      </Snackbar>
    );
  }

  return (
    <>
      {/* 安装横幅 */}
      <Slide direction="down" in={showBanner} mountOnEnter unmountOnExit>
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: theme.zIndex.snackbar,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: theme.shadows[4]
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <Icon path={mdiDownload} size={1} style={{ marginRight: 12 }} />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                安装 CuckooX 应用
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                获得更好的使用体验，支持离线访问
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              color="secondary"
              size="small"
              onClick={() => setShowDialog(true)}
              sx={{ minWidth: 'auto' }}
            >
              安装
            </Button>
            <IconButton
              size="small"
              onClick={handleBannerDismiss}
              sx={{ color: 'inherit' }}
            >
              <Icon path={mdiClose} size={0.8} />
            </IconButton>
          </Box>
        </Box>
      </Slide>

      {/* 安装对话框 */}
      <Dialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Icon path={installInstructions.icon} size={1} />
          {installInstructions.title}
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body1" gutterBottom>
              将 CuckooX 安装到您的设备，享受以下优势：
            </Typography>
            <Box component="ul" sx={{ pl: 2, mt: 1 }}>
              <li>
                <Typography variant="body2">快速启动，无需打开浏览器</Typography>
              </li>
              <li>
                <Typography variant="body2">离线访问已缓存的数据</Typography>
              </li>
              <li>
                <Typography variant="body2">接收重要通知提醒</Typography>
              </li>
              <li>
                <Typography variant="body2">更流畅的用户体验</Typography>
              </li>
            </Box>
          </Box>

          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            安装步骤：
          </Typography>
          <Box component="ol" sx={{ pl: 2 }}>
            {installInstructions.steps.map((step, index) => (
              <li key={index}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  {step}
                </Typography>
              </li>
            ))}
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowDialog(false)}>
            取消
          </Button>
          {installState.canInstall && installState.platform !== 'ios' && (
            <Button
              variant="contained"
              onClick={handleInstallClick}
              startIcon={<Icon path={mdiDownload} size={0.8} />}
            >
              安装应用
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* 成功消息 */}
      <Snackbar
        open={showSuccessMessage}
        autoHideDuration={6000}
        onClose={() => setShowSuccessMessage(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setShowSuccessMessage(false)} severity="success">
          CuckooX 已成功安装到您的设备！
        </Alert>
      </Snackbar>
    </>
  );
};

export default PWAInstallManager;