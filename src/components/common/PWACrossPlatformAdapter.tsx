import React, { useState, useEffect } from 'react';
import {
  Box,
  useTheme,
  useMediaQuery,
  GlobalStyles,
  css
} from '@mui/material';
import { styled } from '@mui/material/styles';

interface PWACrossPlatformAdapterProps {
  children: React.ReactNode;
}

/**
 * PWA跨平台适配器
 * 
 * 为不同平台和设备提供优化的PWA体验
 */
export const PWACrossPlatformAdapter: React.FC<PWACrossPlatformAdapterProps> = ({
  children
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown');
  const [isStandalone, setIsStandalone] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [safeArea, setSafeArea] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  });

  useEffect(() => {
    detectPlatform();
    detectStandaloneMode();
    detectOrientation();
    detectSafeArea();
    
    // 监听方向变化
    const handleOrientationChange = () => {
      detectOrientation();
      detectSafeArea();
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

  const detectPlatform = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform('ios');
    } else if (/android/.test(userAgent)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }
  };

  const detectStandaloneMode = () => {
    // 检测PWA独立模式
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');
    
    setIsStandalone(isStandaloneMode);
  };

  const detectOrientation = () => {
    const isPortrait = window.innerHeight > window.innerWidth;
    setOrientation(isPortrait ? 'portrait' : 'landscape');
  };

  const detectSafeArea = () => {
    // 获取安全区域信息（主要用于iOS刘海屏等）
    if (CSS.supports('padding: env(safe-area-inset-top)')) {
      const computedStyle = getComputedStyle(document.documentElement);
      setSafeArea({
        top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0'),
        right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0'),
        bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0'),
        left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0')
      });
    }
  };

  // 根据平台和设备生成样式
  const platformStyles = css`
    /* 基础CSS变量 */
    :root {
      --safe-area-inset-top: env(safe-area-inset-top, 0px);
      --safe-area-inset-right: env(safe-area-inset-right, 0px);
      --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
      --safe-area-inset-left: env(safe-area-inset-left, 0px);
    }

    /* PWA独立模式样式 */
    ${isStandalone && css`
      body {
        padding-top: var(--safe-area-inset-top);
        padding-right: var(--safe-area-inset-right);
        padding-bottom: var(--safe-area-inset-bottom);
        padding-left: var(--safe-area-inset-left);
      }
    `}

    /* iOS特定样式 */
    ${platform === 'ios' && css`
      /* 禁用iOS Safari的弹性滚动 */
      body {
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: none;
      }

      /* 禁用iOS的双击缩放 */
      input, textarea, select {
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
      }

      /* iOS状态栏适配 */
      ${isStandalone && css`
        .MuiAppBar-root {
          padding-top: var(--safe-area-inset-top);
        }
      `}
    `}

    /* Android特定样式 */
    ${platform === 'android' && css`
      /* Android导航栏适配 */
      body {
        padding-bottom: env(safe-area-inset-bottom, 0px);
      }

      /* 改善Android上的点击反馈 */
      button, .MuiButton-root {
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
      }
    `}

    /* 移动设备通用样式 */
    ${isMobile && css`
      /* 优化触摸操作 */
      .MuiButton-root {
        min-height: 44px; /* Apple Human Interface Guidelines */
        min-width: 44px;
      }

      .MuiIconButton-root {
        min-height: 44px;
        min-width: 44px;
      }

      /* 改善滚动性能 */
      .MuiList-root {
        -webkit-overflow-scrolling: touch;
      }

      /* 移动端字体优化 */
      body {
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
    `}

    /* 桌面设备样式 */
    ${isDesktop && css`
      /* 键盘导航支持 */
      .MuiButton-root:focus-visible,
      .MuiIconButton-root:focus-visible {
        outline: 2px solid ${theme.palette.primary.main};
        outline-offset: 2px;
      }

      /* 桌面端悬停效果 */
      .MuiButton-root:hover {
        transform: translateY(-1px);
        transition: transform 0.2s;
      }
    `}

    /* 横屏模式适配 */
    ${orientation === 'landscape' && isMobile && css`
      /* 横屏时减少垂直空间占用 */
      .MuiAppBar-root {
        min-height: 48px;
      }

      .MuiToolbar-root {
        min-height: 48px;
      }
    `}
  `;

  const AdaptiveContainer = styled(Box)(({ theme }) => ({
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    
    // 安全区域适配
    paddingTop: isStandalone ? 'var(--safe-area-inset-top)' : 0,
    paddingRight: isStandalone ? 'var(--safe-area-inset-right)' : 0,
    paddingBottom: isStandalone ? 'var(--safe-area-inset-bottom)' : 0,
    paddingLeft: isStandalone ? 'var(--safe-area-inset-left)' : 0,
    
    // 平台特定样式
    ...(platform === 'ios' && {
      WebkitOverflowScrolling: 'touch',
      overscrollBehavior: 'none'
    }),
    
    // 移动端优化
    ...(isMobile && {
      touchAction: 'manipulation', // 禁用双击缩放
      WebkitTapHighlightColor: 'transparent'
    })
  }));

  return (
    <>
      <GlobalStyles styles={platformStyles} />
      <AdaptiveContainer
        data-platform={platform}
        data-standalone={isStandalone}
        data-orientation={orientation}
        data-device={isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'}
      >
        {children}
      </AdaptiveContainer>
    </>
  );
};

// 键盘快捷键支持组件
interface KeyboardShortcutsProps {
  shortcuts: Array<{
    key: string;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    action: () => void;
    description: string;
  }>;
  enabled?: boolean;
}

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({
  shortcuts,
  enabled = true
}) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      shortcuts.forEach(shortcut => {
        const isMatch = 
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          !!event.ctrlKey === !!shortcut.ctrl &&
          !!event.altKey === !!shortcut.alt &&
          !!event.shiftKey === !!shortcut.shift;

        if (isMatch) {
          event.preventDefault();
          shortcut.action();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);

  return null;
};

// 触摸手势支持组件
interface TouchGesturesProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPinch?: (scale: number) => void;
  children: React.ReactNode;
  threshold?: number;
}

export const TouchGestures: React.FC<TouchGesturesProps> = ({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onPinch,
  children,
  threshold = 50
}) => {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const deltaX = touchStart.x - touchEnd.x;
    const deltaY = touchStart.y - touchEnd.y;

    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
    const isVerticalSwipe = Math.abs(deltaY) > Math.abs(deltaX);

    if (isHorizontalSwipe && Math.abs(deltaX) > threshold) {
      if (deltaX > 0 && onSwipeLeft) {
        onSwipeLeft();
      } else if (deltaX < 0 && onSwipeRight) {
        onSwipeRight();
      }
    } else if (isVerticalSwipe && Math.abs(deltaY) > threshold) {
      if (deltaY > 0 && onSwipeUp) {
        onSwipeUp();
      } else if (deltaY < 0 && onSwipeDown) {
        onSwipeDown();
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  return (
    <Box
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      sx={{
        touchAction: 'pan-x pan-y', // 允许滚动但处理手势
        userSelect: 'none'
      }}
    >
      {children}
    </Box>
  );
};

// 平台检测Hook
export const usePlatformDetection = () => {
  const [platformInfo, setPlatformInfo] = useState({
    platform: 'unknown' as 'ios' | 'android' | 'desktop' | 'unknown',
    isStandalone: false,
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    hasNotch: false,
    canInstall: false
  });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    
    let platform: typeof platformInfo.platform = 'unknown';
    if (/iphone|ipad|ipod/.test(userAgent)) {
      platform = 'ios';
    } else if (/android/.test(userAgent)) {
      platform = 'android';
    } else {
      platform = 'desktop';
    }

    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    const hasNotch = 
      platform === 'ios' && 
      (CSS.supports('padding: env(safe-area-inset-top)') ||
       CSS.supports('padding: constant(safe-area-inset-top)'));

    setPlatformInfo({
      platform,
      isStandalone,
      isMobile,
      isTablet,
      isDesktop,
      hasNotch,
      canInstall: 'serviceWorker' in navigator && 'PushManager' in window
    });
  }, [isMobile, isTablet, isDesktop]);

  return platformInfo;
};

export default {
  PWACrossPlatformAdapter,
  KeyboardShortcuts,
  TouchGestures,
  usePlatformDetection
};