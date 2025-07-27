import React from 'react';
import { Box, Container, useTheme, useMediaQuery } from '@mui/material';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  disableGutters?: boolean;
  variant?: 'default' | 'mobile-optimized' | 'desktop-only';
  className?: string;
}

/**
 * 响应式容器组件，为不同设备尺寸提供优化的布局
 * 支持PWA在各种设备上的最佳显示效果
 */
const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  maxWidth = 'lg',
  disableGutters = false,
  variant = 'default',
  className
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  // 根据设备类型调整容器属性
  const getContainerProps = () => {
    switch (variant) {
      case 'mobile-optimized':
        return {
          maxWidth: isMobile ? false : maxWidth,
          disableGutters: isMobile ? true : disableGutters,
          sx: {
            px: isMobile ? 1 : 3,
            py: isMobile ? 1 : 2,
          }
        };
      
      case 'desktop-only':
        return {
          maxWidth,
          disableGutters,
          sx: {
            display: isMobile ? 'none' : 'block',
            px: 3,
            py: 2,
          }
        };
      
      default:
        return {
          maxWidth,
          disableGutters,
          sx: {
            px: { xs: 1, sm: 2, md: 3 },
            py: { xs: 1, sm: 1.5, md: 2 },
          }
        };
    }
  };

  const containerProps = getContainerProps();

  return (
    <Container
      {...containerProps}
      className={className}
    >
      <Box
        sx={{
          width: '100%',
          minHeight: isMobile ? 'calc(100vh - 64px)' : 'auto',
          ...containerProps.sx,
        }}
      >
        {children}
      </Box>
    </Container>
  );
};

export default ResponsiveContainer;