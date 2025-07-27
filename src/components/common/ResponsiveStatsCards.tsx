import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  SvgIcon,
  useTheme,
  alpha,
  Skeleton,
} from '@mui/material';
import { useResponsiveLayout, useResponsiveSpacing } from '@/src/hooks/useResponsiveLayout';

export interface StatCardData {
  id: string;
  label: string;
  value: string | number;
  icon: string;
  color: string;
  bgColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  subtitle?: string;
  loading?: boolean;
}

interface ResponsiveStatsCardsProps {
  stats: StatCardData[];
  loading?: boolean;
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  variant?: 'default' | 'compact' | 'detailed';
  showTrend?: boolean;
  onCardClick?: (stat: StatCardData) => void;
}

/**
 * 响应式统计卡片组件
 * 根据屏幕尺寸自动调整布局和显示内容
 */
const ResponsiveStatsCards: React.FC<ResponsiveStatsCardsProps> = ({
  stats,
  loading = false,
  columns = { xs: 1, sm: 2, md: 2, lg: 4, xl: 4 },
  variant = 'default',
  showTrend = false,
  onCardClick,
}) => {
  const theme = useTheme();
  const { isMobile, isTablet } = useResponsiveLayout();
  const { cardSpacing } = useResponsiveSpacing();

  const getCardHeight = () => {
    switch (variant) {
      case 'compact':
        return isMobile ? 80 : 100;
      case 'detailed':
        return isMobile ? 140 : 160;
      default:
        return isMobile ? 100 : 120;
    }
  };

  const getIconSize = () => {
    if (variant === 'compact') return isMobile ? 32 : 40;
    if (variant === 'detailed') return isMobile ? 48 : 56;
    return isMobile ? 40 : 48;
  };

  const renderStatCard = (stat: StatCardData, index: number) => {
    const cardHeight = getCardHeight();
    const iconSize = getIconSize();

    if (loading || stat.loading) {
      return (
        <Card
          key={stat.id}
          sx={{
            height: cardHeight,
            borderRadius: isMobile ? 2 : 3,
            boxShadow: isMobile ? 1 : 2,
          }}
        >
          <CardContent sx={{ p: cardSpacing, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" height={24} />
                <Skeleton variant="text" width="40%" height={32} sx={{ mt: 0.5 }} />
                {variant === 'detailed' && (
                  <Skeleton variant="text" width="80%" height={16} sx={{ mt: 0.5 }} />
                )}
              </Box>
              <Skeleton variant="circular" width={iconSize} height={iconSize} />
            </Box>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card
        key={stat.id}
        sx={{
          height: cardHeight,
          borderRadius: isMobile ? 2 : 3,
          boxShadow: isMobile ? 1 : 2,
          cursor: onCardClick ? 'pointer' : 'default',
          transition: 'all 0.3s ease',
          '&:hover': onCardClick ? {
            transform: 'translateY(-2px)',
            boxShadow: isMobile ? 3 : 4,
          } : {},
        }}
        onClick={() => onCardClick?.(stat)}
      >
        <CardContent sx={{ p: cardSpacing, height: '100%' }}>
          {variant === 'compact' ? (
            // 紧凑模式：水平布局
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant={isMobile ? 'h6' : 'h5'}
                  sx={{
                    fontWeight: 700,
                    color: stat.color,
                    lineHeight: 1.2,
                  }}
                  noWrap
                >
                  {stat.value}
                </Typography>
                <Typography
                  variant={isMobile ? 'caption' : 'body2'}
                  color="text.secondary"
                  noWrap
                >
                  {stat.label}
                </Typography>
              </Box>
              <Box
                sx={{
                  width: iconSize,
                  height: iconSize,
                  borderRadius: 1.5,
                  backgroundColor: stat.bgColor || alpha(stat.color, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ml: 1,
                }}
              >
                <SvgIcon sx={{ fontSize: iconSize * 0.6, color: stat.color }}>
                  <path d={stat.icon} />
                </SvgIcon>
              </Box>
            </Box>
          ) : (
            // 默认和详细模式：垂直布局
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant={isMobile ? 'h5' : 'h4'}
                    sx={{
                      fontWeight: 700,
                      color: stat.color,
                      lineHeight: 1.1,
                    }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography
                    variant={isMobile ? 'body2' : 'body1'}
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    {stat.label}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: iconSize,
                    height: iconSize,
                    borderRadius: 2,
                    backgroundColor: stat.bgColor || alpha(stat.color, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <SvgIcon sx={{ fontSize: iconSize * 0.6, color: stat.color }}>
                    <path d={stat.icon} />
                  </SvgIcon>
                </Box>
              </Box>

              {/* 详细模式的额外信息 */}
              {variant === 'detailed' && (
                <Box sx={{ mt: 'auto' }}>
                  {stat.subtitle && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      {stat.subtitle}
                    </Typography>
                  )}
                  {showTrend && stat.trend && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: stat.trend.isPositive ? theme.palette.success.main : theme.palette.error.main,
                          fontWeight: 600,
                        }}
                      >
                        {stat.trend.isPositive ? '+' : ''}{stat.trend.value}%
                      </Typography>
                      {stat.trend.label && (
                        <Typography variant="caption" color="text.secondary">
                          {stat.trend.label}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Grid container spacing={cardSpacing} sx={{ mb: cardSpacing * 2 }}>
      {stats.map((stat, index) => (
        <Grid
          key={stat.id}
          size={{
            xs: columns.xs || 1,
            sm: columns.sm || 2,
            md: columns.md || 2,
            lg: columns.lg || 4,
            xl: columns.xl || 4,
          }}
        >
          {renderStatCard(stat, index)}
        </Grid>
      ))}
    </Grid>
  );
};

export default ResponsiveStatsCards;