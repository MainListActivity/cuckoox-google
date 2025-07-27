import React from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  SvgIcon,
  useTheme,
  alpha,
  Fab,
  Zoom,
  useScrollTrigger,
} from '@mui/material';
import {
  mdiArrowLeft,
  mdiDotsVertical,
  mdiPlus,
} from '@mdi/js';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';
import { touchFriendlyIconButtonSx, touchFriendlyFabSx } from '@/src/utils/touchTargetUtils';

interface MobileOptimizedLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onMenuClick?: () => void;
  showFab?: boolean;
  fabIcon?: string;
  onFabClick?: () => void;
  fabLabel?: string;
  headerActions?: React.ReactNode;
  backgroundColor?: string;
}

/**
 * 移动端优化布局组件
 * 提供移动端友好的页面结构和交互
 */
const MobileOptimizedLayout: React.FC<MobileOptimizedLayoutProps> = ({
  children,
  title,
  subtitle,
  onBack,
  onMenuClick,
  showFab = false,
  fabIcon = mdiPlus,
  onFabClick,
  fabLabel = '添加',
  headerActions,
  backgroundColor,
}) => {
  const theme = useTheme();
  const { isMobile } = useResponsiveLayout();
  
  // 滚动触发器，用于FAB的显示/隐藏
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 100,
  });

  if (!isMobile) {
    // 非移动端直接返回子组件
    return <>{children}</>;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: backgroundColor || theme.palette.background.default,
      }}
    >
      {/* 移动端顶部导航栏 */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <Toolbar sx={{ px: 1, minHeight: '56px !important' }}>
          {/* 返回按钮 */}
          {onBack && (
            <IconButton
              edge="start"
              onClick={onBack}
              sx={{ 
                mr: 1,
                ...touchFriendlyIconButtonSx,
              }}
              aria-label="返回"
            >
              <SvgIcon>
                <path d={mdiArrowLeft} />
              </SvgIcon>
            </IconButton>
          )}

          {/* 标题区域 */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h6"
              noWrap
              sx={{
                fontSize: '1.1rem',
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ display: 'block', lineHeight: 1 }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>

          {/* 头部操作按钮 */}
          {headerActions || (
            onMenuClick && (
              <IconButton
                edge="end"
                onClick={onMenuClick}
                sx={touchFriendlyIconButtonSx}
                aria-label="菜单"
              >
                <SvgIcon>
                  <path d={mdiDotsVertical} />
                </SvgIcon>
              </IconButton>
            )
          )}
        </Toolbar>
      </AppBar>

      {/* 主内容区域 */}
      <Box
        component="main"
        sx={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          // 为FAB留出空间
          pb: showFab ? 10 : 2,
        }}
      >
        {children}
      </Box>

      {/* 浮动操作按钮 */}
      {showFab && onFabClick && (
        <Zoom in={!trigger}>
          <Fab
            color="primary"
            aria-label={fabLabel}
            onClick={onFabClick}
            sx={{
              position: 'fixed',
              bottom: 16,
              right: 16,
              zIndex: theme.zIndex.fab,
              ...touchFriendlyFabSx,
              // 添加触摸反馈动画
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: theme.shadows[8],
              },
              '&:active': {
                transform: 'scale(0.95)',
              },
            }}
          >
            <SvgIcon>
              <path d={fabIcon} />
            </SvgIcon>
          </Fab>
        </Zoom>
      )}
    </Box>
  );
};

export default MobileOptimizedLayout;