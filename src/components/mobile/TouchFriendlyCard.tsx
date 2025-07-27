import React, { useState, useRef } from 'react';
import {
  Card,
  CardContent,
  Box,
  IconButton,
  useTheme,
  alpha,
  SvgIcon,
  Tooltip,
  Fade,
} from '@mui/material';
import { 
  touchFriendlyIconButtonSx, 
  touchGestureConfig,
  touchFriendlyAnimations,
} from '@/src/utils/touchTargetUtils';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';

export interface TouchFriendlyAction {
  icon: string;
  label: string;
  onClick: () => void;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  disabled?: boolean;
}

interface TouchFriendlyCardProps {
  children: React.ReactNode;
  actions?: TouchFriendlyAction[];
  onTap?: () => void;
  onLongPress?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  elevation?: number;
  borderRadius?: number;
  showRipple?: boolean;
  longPressEnabled?: boolean;
  swipeEnabled?: boolean;
  className?: string;
  sx?: any;
}

/**
 * 触摸友好的卡片组件
 * 支持多种手势操作和44px最小触摸目标
 */
const TouchFriendlyCard: React.FC<TouchFriendlyCardProps> = ({
  children,
  actions = [],
  onTap,
  onLongPress,
  onSwipeLeft,
  onSwipeRight,
  elevation = 2,
  borderRadius = 3,
  showRipple = true,
  longPressEnabled = true,
  swipeEnabled = true,
  className,
  sx = {},
}) => {
  const theme = useTheme();
  const { isMobile } = useResponsiveLayout();
  const [isPressed, setIsPressed] = useState(false);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  
  // 手势识别状态
  const gestureRef = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    isLongPressing: false,
    longPressTimer: null as NodeJS.Timeout | null,
  });

  // 触摸开始处理
  const handleTouchStart = (event: React.TouchEvent) => {
    if (!isMobile) return;
    
    const touch = event.touches[0];
    const now = Date.now();
    
    gestureRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: now,
      isLongPressing: false,
      longPressTimer: null,
    };

    setIsPressed(true);

    // 添加涟漪效果
    if (showRipple) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      const newRipple = {
        id: now,
        x,
        y,
      };
      
      setRipples(prev => [...prev, newRipple]);
      
      // 自动清理涟漪
      setTimeout(() => {
        setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
      }, touchFriendlyAnimations.ripple.duration);
    }

    // 长按检测
    if (longPressEnabled && onLongPress) {
      gestureRef.current.longPressTimer = setTimeout(() => {
        gestureRef.current.isLongPressing = true;
        onLongPress();
        
        // 触觉反馈（如果支持）
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }, touchGestureConfig.longPress.duration);
    }
  };

  // 触摸移动处理
  const handleTouchMove = (event: React.TouchEvent) => {
    if (!isMobile) return;
    
    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - gestureRef.current.startX);
    const deltaY = Math.abs(touch.clientY - gestureRef.current.startY);
    const maxDelta = Math.max(deltaX, deltaY);

    // 如果移动超过阈值，取消长按
    if (maxDelta > touchGestureConfig.longPress.movementThreshold) {
      if (gestureRef.current.longPressTimer) {
        clearTimeout(gestureRef.current.longPressTimer);
        gestureRef.current.longPressTimer = null;
      }
    }
  };

  // 触摸结束处理
  const handleTouchEnd = (event: React.TouchEvent) => {
    if (!isMobile) return;
    
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - gestureRef.current.startX;
    const deltaY = touch.clientY - gestureRef.current.startY;
    const deltaTime = Date.now() - gestureRef.current.startTime;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    setIsPressed(false);

    // 清理长按定时器
    if (gestureRef.current.longPressTimer) {
      clearTimeout(gestureRef.current.longPressTimer);
      gestureRef.current.longPressTimer = null;
    }

    // 如果已经触发了长按，不处理其他手势
    if (gestureRef.current.isLongPressing) {
      return;
    }

    // 滑动检测
    if (swipeEnabled && (absX > touchGestureConfig.swipe.threshold || absY > touchGestureConfig.swipe.threshold)) {
      const velocity = Math.max(absX, absY) / deltaTime;
      
      if (velocity > touchGestureConfig.swipe.velocity) {
        if (absX > absY) {
          // 水平滑动
          if (deltaX > 0 && onSwipeRight) {
            onSwipeRight();
            return;
          } else if (deltaX < 0 && onSwipeLeft) {
            onSwipeLeft();
            return;
          }
        }
      }
    }

    // 点击检测
    if (absX < touchGestureConfig.tap.threshold && 
        absY < touchGestureConfig.tap.threshold && 
        deltaTime < touchGestureConfig.tap.timeout) {
      if (onTap) {
        onTap();
      }
    }
  };

  // 鼠标事件处理（桌面端）
  const handleMouseDown = () => {
    if (isMobile) return;
    setIsPressed(true);
  };

  const handleMouseUp = () => {
    if (isMobile) return;
    setIsPressed(false);
    if (onTap) {
      onTap();
    }
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    setIsPressed(false);
  };

  return (
    <Card
      className={className}
      elevation={isPressed ? elevation + 2 : elevation}
      sx={{
        borderRadius,
        cursor: onTap ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        transform: isPressed ? 'scale(0.98)' : 'scale(1)',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': !isMobile ? {
          transform: 'scale(1.02)',
          boxShadow: theme.shadows[elevation + 2],
        } : {},
        ...sx,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* 涟漪效果 */}
      {showRipple && ripples.map(ripple => (
        <Fade key={ripple.id} in timeout={touchFriendlyAnimations.ripple.duration}>
          <Box
            sx={{
              position: 'absolute',
              borderRadius: '50%',
              backgroundColor: touchFriendlyAnimations.ripple.color,
              width: 100,
              height: 100,
              left: ripple.x - 50,
              top: ripple.y - 50,
              pointerEvents: 'none',
              transform: 'scale(0)',
              animation: `ripple ${touchFriendlyAnimations.ripple.duration}ms ease-out`,
              '@keyframes ripple': {
                to: {
                  transform: 'scale(2)',
                  opacity: 0,
                },
              },
            }}
          />
        </Fade>
      ))}

      <CardContent sx={{ position: 'relative', zIndex: 1 }}>
        {children}
        
        {/* 操作按钮 */}
        {actions.length > 0 && (
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: 0.5,
              mt: 2,
              pt: 1.5,
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            {actions.map((action, index) => (
              <Tooltip key={index} title={action.label}>
                <IconButton
                  color={action.color || 'default'}
                  disabled={action.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                  }}
                  sx={touchFriendlyIconButtonSx}
                  aria-label={action.label}
                >
                  <SvgIcon>
                    <path d={action.icon} />
                  </SvgIcon>
                </IconButton>
              </Tooltip>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default TouchFriendlyCard;