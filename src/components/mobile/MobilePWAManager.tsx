import React, { useState, useEffect, useCallback } from 'react';
import { useTheme, useMediaQuery } from '@mui/material';
import MobilePWAInstallGuide from './MobilePWAInstallGuide';
import MobilePWAInstallBanner from './MobilePWAInstallBanner';
import { 
  mobilePWADetector, 
  shouldShowInstallPrompt,
  getDeviceInfo 
} from '@/src/utils/mobilePWADetector';

interface MobilePWAManagerProps {
  // 横幅配置
  showBanner?: boolean;
  bannerDelay?: number;
  bannerPosition?: 'top' | 'bottom';
  bannerCompact?: boolean;
  bannerAutoHide?: number;
  
  // 引导对话框配置
  showGuideOnBannerClick?: boolean;
  guideAutoTrigger?: boolean;
  
  // 高级配置
  respectUserPreference?: boolean;
  enableAnalytics?: boolean;
  customAnalyticsHandler?: (event: string, data: any) => void;
  
  // 触发条件
  triggerOnPageView?: boolean;
  triggerOnUserEngagement?: boolean;
  triggerOnSpecificPages?: string[];
  
  // 回调函数
  onInstallStart?: () => void;
  onInstallSuccess?: () => void;
  onInstallDismiss?: () => void;
  onBannerShow?: () => void;
  onBannerDismiss?: () => void;
  onGuideOpen?: () => void;
  onGuideClose?: () => void;
}

interface PWAManagerState {
  showBanner: boolean;
  showGuide: boolean;
  userEngaged: boolean;
  pageViewCount: number;
  sessionStartTime: number;
}

const MobilePWAManager: React.FC<MobilePWAManagerProps> = ({
  showBanner = true,
  bannerDelay = 5000,
  bannerPosition = 'bottom',
  bannerCompact = false,
  bannerAutoHide = 10000,
  
  showGuideOnBannerClick = true,
  guideAutoTrigger = false,
  
  respectUserPreference = true,
  enableAnalytics = true,
  customAnalyticsHandler,
  
  triggerOnPageView = true,
  triggerOnUserEngagement = true,
  triggerOnSpecificPages = [],
  
  onInstallStart,
  onInstallSuccess,
  onInstallDismiss,
  onBannerShow,
  onBannerDismiss,
  onGuideOpen,
  onGuideClose
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [state, setState] = useState<PWAManagerState>({
    showBanner: false,
    showGuide: false,
    userEngaged: false,
    pageViewCount: 0,
    sessionStartTime: Date.now()
  });

  // 分析数据发送
  const sendAnalytics = useCallback((event: string, data: any = {}) => {
    if (!enableAnalytics) return;

    const analyticsData = {
      event,
      timestamp: Date.now(),
      sessionDuration: Date.now() - state.sessionStartTime,
      deviceInfo: getDeviceInfo(),
      installState: mobilePWADetector.getInstallState(),
      ...data
    };

    if (customAnalyticsHandler) {
      customAnalyticsHandler(event, analyticsData);
    } else {
      // 默认发送到控制台（开发环境）
      console.log('PWA Analytics:', analyticsData);
      
      // 在生产环境中，这里可以发送到分析服务
      if (process.env.NODE_ENV === 'production') {
        // TODO: 发送到分析服务
        // analytics.track(event, analyticsData);
      }
    }
  }, [enableAnalytics, customAnalyticsHandler, state.sessionStartTime]);

  // 检查是否应该触发安装提示
  const checkTriggerConditions = useCallback(() => {
    if (!isMobile) return false;
    if (!shouldShowInstallPrompt()) return false;
    
    // 尊重用户偏好
    if (respectUserPreference) {
      const installState = mobilePWADetector.getInstallState();
      if (installState.dismissCount >= 3) return false;
    }

    // 页面视图触发
    if (triggerOnPageView && state.pageViewCount >= 2) return true;
    
    // 用户参与触发
    if (triggerOnUserEngagement && state.userEngaged) return true;
    
    // 特定页面触发
    if (triggerOnSpecificPages.length > 0) {
      const currentPath = window.location.pathname;
      return triggerOnSpecificPages.some(path => 
        currentPath.includes(path) || currentPath.match(new RegExp(path))
      );
    }

    return true;
  }, [
    isMobile, 
    respectUserPreference, 
    triggerOnPageView, 
    triggerOnUserEngagement, 
    triggerOnSpecificPages,
    state.pageViewCount,
    state.userEngaged
  ]);

  // 显示横幅
  const showInstallBanner = useCallback(() => {
    if (!showBanner || !checkTriggerConditions()) return;

    setState(prev => ({ ...prev, showBanner: true }));
    sendAnalytics('pwa_banner_shown', {
      trigger: 'auto',
      delay: bannerDelay,
      position: bannerPosition
    });
    onBannerShow?.();
  }, [
    showBanner, 
    checkTriggerConditions, 
    sendAnalytics, 
    bannerDelay, 
    bannerPosition, 
    onBannerShow
  ]);

  // 显示安装引导
  const showInstallGuide = useCallback(() => {
    setState(prev => ({ ...prev, showGuide: true }));
    sendAnalytics('pwa_guide_opened', {
      trigger: state.showBanner ? 'banner_click' : 'direct'
    });
    onGuideOpen?.();
  }, [sendAnalytics, state.showBanner, onGuideOpen]);

  // 初始化和页面视图跟踪
  useEffect(() => {
    // 记录页面视图
    setState(prev => ({ 
      ...prev, 
      pageViewCount: prev.pageViewCount + 1 
    }));

    // 延迟显示横幅
    const timer = setTimeout(() => {
      showInstallBanner();
    }, bannerDelay);

    return () => clearTimeout(timer);
  }, [bannerDelay, showInstallBanner]);

  // 用户参与度检测
  useEffect(() => {
    let engagementTimer: NodeJS.Timeout;
    let scrollDetected = false;
    let clickDetected = false;

    const handleScroll = () => {
      if (!scrollDetected) {
        scrollDetected = true;
        checkEngagement();
      }
    };

    const handleClick = () => {
      if (!clickDetected) {
        clickDetected = true;
        checkEngagement();
      }
    };

    const checkEngagement = () => {
      if (scrollDetected && clickDetected && !state.userEngaged) {
        setState(prev => ({ ...prev, userEngaged: true }));
        sendAnalytics('user_engaged');
      }
    };

    // 10秒后自动标记为参与
    engagementTimer = setTimeout(() => {
      if (!state.userEngaged) {
        setState(prev => ({ ...prev, userEngaged: true }));
        sendAnalytics('user_engaged', { trigger: 'timeout' });
      }
    }, 10000);

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('click', handleClick, { passive: true });

    return () => {
      clearTimeout(engagementTimer);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('click', handleClick);
    };
  }, [state.userEngaged, sendAnalytics]);

  // 监听PWA安装状态变化
  useEffect(() => {
    const unsubscribe = mobilePWADetector.subscribe((installState) => {
      if (installState.isInstalled) {
        setState(prev => ({ 
          ...prev, 
          showBanner: false, 
          showGuide: false 
        }));
        sendAnalytics('pwa_install_success');
        onInstallSuccess?.();
      }
    });

    return unsubscribe;
  }, [sendAnalytics, onInstallSuccess]);

  // 处理横幅点击
  const handleBannerClick = useCallback(() => {
    setState(prev => ({ ...prev, showBanner: false }));
    
    if (showGuideOnBannerClick) {
      showInstallGuide();
    }
    
    sendAnalytics('pwa_banner_clicked');
    onInstallStart?.();
  }, [showGuideOnBannerClick, showInstallGuide, sendAnalytics, onInstallStart]);

  // 处理横幅关闭
  const handleBannerDismiss = useCallback(() => {
    setState(prev => ({ ...prev, showBanner: false }));
    sendAnalytics('pwa_banner_dismissed');
    onBannerDismiss?.();
    onInstallDismiss?.();
  }, [sendAnalytics, onBannerDismiss, onInstallDismiss]);

  // 处理引导关闭
  const handleGuideClose = useCallback(() => {
    setState(prev => ({ ...prev, showGuide: false }));
    sendAnalytics('pwa_guide_closed');
    onGuideClose?.();
  }, [sendAnalytics, onGuideClose]);

  // 如果不是移动端，不渲染任何内容
  if (!isMobile) {
    return null;
  }

  return (
    <>
      {/* 安装横幅 */}
      <MobilePWAInstallBanner
        onInstallClick={handleBannerClick}
        autoShow={false} // 由Manager控制显示
        position={bannerPosition}
        compact={bannerCompact}
        autoHideDelay={bannerAutoHide}
      />

      {/* 安装引导对话框 */}
      <MobilePWAInstallGuide
        open={state.showGuide}
        onClose={handleGuideClose}
        autoTrigger={guideAutoTrigger}
        showBenefits={true}
        compact={bannerCompact}
      />
    </>
  );
};

export default MobilePWAManager;