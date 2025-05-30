import React from 'react';
import { Box, BoxProps } from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface PageContainerProps extends BoxProps {
  children: React.ReactNode;
  // 是否使用特殊背景（如登录页、数据大屏）
  variant?: 'default' | 'login' | 'dashboard';
}

const PageContainer: React.FC<PageContainerProps> = ({ 
  children, 
  variant = 'default',
  sx,
  ...otherProps 
}) => {
  const theme = useTheme();

  // 根据不同的 variant 返回不同的背景样式
  const getBackgroundStyle = () => {
    switch (variant) {
      case 'login':
        // 登录页面特殊背景：Teal 色系渐变
        return {
          background: theme.palette.mode === 'dark'
            ? `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.background.default} 100%)`
            : `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.background.default} 100%)`,
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column' as const,
        };
      
      case 'dashboard':
        // 数据大屏特殊背景：深色渐变（主要用于深色模式）
        return {
          background: theme.palette.mode === 'dark'
            ? `linear-gradient(180deg, ${theme.palette.background.default} 0%, ${theme.palette.grey[900]} 100%)`
            : theme.palette.background.default,
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column' as const,
        };
      
      default:
        // 默认背景：使用主题的默认背景色
        return {
          backgroundColor: theme.palette.background.default,
          minHeight: '100%', // 改为 100% 避免高度叠加
        };
    }
  };

  return (
    <Box
      sx={{
        ...getBackgroundStyle(),
        color: theme.palette.text.primary,
        transition: theme.transitions.create(['background-color', 'background'], {
          duration: theme.transitions.duration.standard,
        }),
        ...sx,
      }}
      {...otherProps}
    >
      {children}
    </Box>
  );
};

export default PageContainer;
