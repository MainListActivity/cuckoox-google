/**
 * 触摸友好交互设计工具
 * 提供44px最小触摸目标的工具函数和样式
 */

import { SxProps, Theme } from '@mui/material/styles';

// 44px 最小触摸目标常量
export const MIN_TOUCH_TARGET = 44;

/**
 * 触摸友好按钮样式
 * 确保所有交互元素满足44px最小触摸目标
 */
export const touchFriendlyButtonSx: SxProps<Theme> = {
  minWidth: MIN_TOUCH_TARGET,
  minHeight: MIN_TOUCH_TARGET,
  borderRadius: 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/**
 * 触摸友好 IconButton 样式
 */
export const touchFriendlyIconButtonSx: SxProps<Theme> = {
  ...touchFriendlyButtonSx,
  padding: 1,
  '&.MuiIconButton-sizeSmall': {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
  },
  '&.MuiIconButton-sizeMedium': {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
  },
};

/**
 * 移动端优化的触摸目标样式
 * 在移动端提供更大的触摸区域
 */
export const mobileOptimizedTouchSx = (theme: Theme): SxProps<Theme> => ({
  [theme.breakpoints.down('md')]: {
    minWidth: MIN_TOUCH_TARGET + 4, // 移动端增加4px
    minHeight: MIN_TOUCH_TARGET + 4,
    padding: 1.5,
  },
  [theme.breakpoints.up('md')]: touchFriendlyIconButtonSx,
});

/**
 * FAB 按钮触摸友好样式
 */
export const touchFriendlyFabSx: SxProps<Theme> = {
  width: 56, // 标准 FAB 尺寸
  height: 56,
  '&.MuiSpeedDial-fab': {
    width: 56,
    height: 56,
  },
  // 移动端增大触摸区域
  '@media (max-width: 959px)': {
    width: 64,
    height: 64,
  },
};

/**
 * 触摸友好的菜单项样式
 */
export const touchFriendlyMenuItemSx: SxProps<Theme> = {
  minHeight: MIN_TOUCH_TARGET,
  py: 1.5,
  px: 2,
  '&.MuiMenuItem-dense': {
    minHeight: MIN_TOUCH_TARGET,
  },
};

/**
 * 触摸友好的列表项样式
 */
export const touchFriendlyListItemSx: SxProps<Theme> = {
  minHeight: MIN_TOUCH_TARGET,
  py: 1,
  '&.MuiListItemButton-dense': {
    minHeight: MIN_TOUCH_TARGET,
  },
};

/**
 * 触摸友好的文本字段样式
 */
export const touchFriendlyTextFieldSx: SxProps<Theme> = {
  '& .MuiInputBase-root': {
    minHeight: MIN_TOUCH_TARGET,
  },
  '& .MuiOutlinedInput-input': {
    py: 1.5,
  },
};

/**
 * 检查元素是否满足触摸目标要求
 */
export const validateTouchTarget = (width: number, height: number): boolean => {
  return width >= MIN_TOUCH_TARGET && height >= MIN_TOUCH_TARGET;
};

/**
 * 为组件添加触摸友好的属性
 */
export const addTouchFriendlyProps = (baseProps: any = {}) => ({
  ...baseProps,
  sx: {
    ...touchFriendlyIconButtonSx,
    ...baseProps.sx,
  },
});

/**
 * 移动端触摸优化的组件包装器
 */
export const withMobileTouchOptimization = (baseProps: any = {}, isMobile: boolean = false) => ({
  ...baseProps,
  sx: isMobile ? mobileOptimizedTouchSx : {
    ...touchFriendlyIconButtonSx,
    ...baseProps.sx,
  },
});

/**
 * 触摸友好的间距配置
 */
export const touchFriendlySpacing = {
  button: {
    horizontal: 1, // 按钮之间的水平间距
    vertical: 1.5, // 按钮之间的垂直间距
  },
  card: {
    padding: 2, // 卡片内边距
    margin: 1, // 卡片外边距
  },
  list: {
    itemPadding: 1.5, // 列表项内边距
    itemSpacing: 0.5, // 列表项间距
  },
};

/**
 * 触摸友好的手势处理配置
 */
export const touchGestureConfig = {
  tap: {
    threshold: 10, // 点击移动阈值 (px)
    timeout: 300, // 点击超时 (ms)
  },
  longPress: {
    duration: 500, // 长按时长 (ms)
    movementThreshold: 10, // 长按移动阈值 (px)
  },
  swipe: {
    threshold: 50, // 滑动阈值 (px)
    velocity: 0.3, // 滑动速度阈值
  },
};

/**
 * 响应式触摸目标工具函数
 */
export const getResponsiveTouchTargetSize = (
  deviceType: 'mobile' | 'tablet' | 'desktop'
): number => {
  switch (deviceType) {
    case 'mobile':
      return MIN_TOUCH_TARGET + 4; // 48px
    case 'tablet':
      return MIN_TOUCH_TARGET + 2; // 46px
    case 'desktop':
      return MIN_TOUCH_TARGET; // 44px
    default:
      return MIN_TOUCH_TARGET;
  }
};

/**
 * 触摸友好动画配置
 */
export const touchFriendlyAnimations = {
  ripple: {
    color: 'rgba(0, 0, 0, 0.04)',
    duration: 300,
  },
  hover: {
    duration: 150,
    scale: 1.02,
  },
  press: {
    duration: 100,
    scale: 0.98,
  },
};

export default {
  MIN_TOUCH_TARGET,
  touchFriendlyButtonSx,
  touchFriendlyIconButtonSx,
  mobileOptimizedTouchSx,
  touchFriendlyFabSx,
  touchFriendlyMenuItemSx,
  touchFriendlyListItemSx,
  touchFriendlyTextFieldSx,
  validateTouchTarget,
  addTouchFriendlyProps,
  withMobileTouchOptimization,
  touchFriendlySpacing,
  touchGestureConfig,
  getResponsiveTouchTargetSize,
  touchFriendlyAnimations,
};