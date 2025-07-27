import { useState, useEffect } from 'react';
import { useTheme, useMediaQuery } from '@mui/material';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type ScreenSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ResponsiveLayoutState {
  deviceType: DeviceType;
  screenSize: ScreenSize;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isSmallScreen: boolean;
  isLargeScreen: boolean;
  orientation: 'portrait' | 'landscape';
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * 响应式布局Hook
 * 提供设备类型检测、屏幕尺寸信息和布局相关的工具函数
 */
export const useResponsiveLayout = (): ResponsiveLayoutState => {
  const theme = useTheme();
  
  // MUI断点检测
  const isXs = useMediaQuery(theme.breakpoints.only('xs'));
  const isSm = useMediaQuery(theme.breakpoints.only('sm'));
  const isMd = useMediaQuery(theme.breakpoints.only('md'));
  const isLg = useMediaQuery(theme.breakpoints.only('lg'));
  const isXl = useMediaQuery(theme.breakpoints.only('xl'));
  
  // 设备类型检测
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  
  // 屏幕尺寸检测
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('xl'));

  // 视口尺寸状态
  const [viewportSize, setViewportSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  // 监听视口尺寸变化
  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 确定当前屏幕尺寸
  const getScreenSize = (): ScreenSize => {
    if (isXs) return 'xs';
    if (isSm) return 'sm';
    if (isMd) return 'md';
    if (isLg) return 'lg';
    if (isXl) return 'xl';
    return 'md'; // 默认值
  };

  // 确定设备类型
  const getDeviceType = (): DeviceType => {
    if (isMobile) return 'mobile';
    if (isTablet) return 'tablet';
    return 'desktop';
  };

  // 确定屏幕方向
  const getOrientation = (): 'portrait' | 'landscape' => {
    return viewportSize.height > viewportSize.width ? 'portrait' : 'landscape';
  };

  return {
    deviceType: getDeviceType(),
    screenSize: getScreenSize(),
    isMobile,
    isTablet,
    isDesktop,
    isSmallScreen,
    isLargeScreen,
    orientation: getOrientation(),
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
  };
};

/**
 * 响应式值Hook
 * 根据不同断点返回不同的值
 */
export const useResponsiveValue = <T>(values: {
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  mobile?: T;
  tablet?: T;
  desktop?: T;
}): T | undefined => {
  const { screenSize, deviceType } = useResponsiveLayout();

  // 优先使用设备类型值
  if (values[deviceType] !== undefined) {
    return values[deviceType];
  }

  // 使用屏幕尺寸值
  if (values[screenSize] !== undefined) {
    return values[screenSize];
  }

  // 回退到最接近的值
  const fallbackOrder: ScreenSize[] = ['xl', 'lg', 'md', 'sm', 'xs'];
  const currentIndex = fallbackOrder.indexOf(screenSize);
  
  for (let i = currentIndex; i < fallbackOrder.length; i++) {
    if (values[fallbackOrder[i]] !== undefined) {
      return values[fallbackOrder[i]];
    }
  }

  return undefined;
};

/**
 * 响应式间距Hook
 * 根据设备类型返回合适的间距值
 */
export const useResponsiveSpacing = () => {
  const { deviceType } = useResponsiveLayout();

  const getSpacing = (mobile: number, tablet: number, desktop: number): number => {
    switch (deviceType) {
      case 'mobile':
        return mobile;
      case 'tablet':
        return tablet;
      case 'desktop':
        return desktop;
      default:
        return mobile;
    }
  };

  return {
    // 页面边距
    pageMargin: getSpacing(1, 2, 3),
    // 卡片间距
    cardSpacing: getSpacing(1, 1.5, 2),
    // 组件间距
    componentSpacing: getSpacing(1, 1.5, 2),
    // 按钮间距
    buttonSpacing: getSpacing(0.5, 1, 1),
    // 表格单元格间距
    tableCellPadding: getSpacing(0.5, 1, 1.5),
    // 工具函数
    getSpacing,
  };
};

export default useResponsiveLayout;