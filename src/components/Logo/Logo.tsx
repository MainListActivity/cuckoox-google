import React from 'react';
import { Box, useTheme, useMediaQuery } from '@mui/material';

export interface LogoProps {
  size?: 'small' | 'medium' | 'large' | 'auto';
  variant?: 'full' | 'icon' | 'text';
  color?: 'primary' | 'white' | 'dark';
  href?: string;
  onClick?: () => void;
}

const Logo: React.FC<LogoProps> = ({
  size = 'auto',
  variant = 'full',
  color: _color = 'primary',
  href,
  onClick,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // 自动尺寸逻辑
  const getActualSize = () => {
    if (size !== 'auto') return size;
    if (isMobile) return 'small';
    if (isTablet) return 'medium';
    return 'large';
  };

  // 自动变体逻辑
  const getActualVariant = () => {
    if (variant !== 'full') return variant;
    const actualSize = getActualSize();
    if (actualSize === 'small') return 'icon';
    return 'full';
  };

  const actualSize = getActualSize();
  const actualVariant = getActualVariant();

  // 尺寸配置
  const sizeConfig = {
    small: { width: 32, height: 32 },
    medium: { width: 48, height: 48 },
    large: { width: 240, height: 64 },
  };

  // 根据variant选择SVG内容
  const renderSVG = () => {
    const { width, height } = sizeConfig[actualSize];
    
    if (actualVariant === 'icon') {
      // Icon version - CX bird transformation
      return (
        <svg
          width={width}
          height={height}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: theme.palette.primary.light, stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: theme.palette.primary.dark, stopOpacity: 1 }} />
            </linearGradient>
            <filter id="iconShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
              <feOffset dx="0" dy="2" result="offset"/>
              <feFlood floodColor="#000000" floodOpacity="0.15"/>
              <feComposite in2="offset" operator="in"/>
              <feMerge> 
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/> 
              </feMerge>
            </filter>
          </defs>
          
          <rect width="48" height="48" rx="8" fill="#FFFFFF" filter="url(#iconShadow)"/>
          
          <g transform="translate(8, 8)" filter="url(#iconShadow)">
            {/* C letter transformed into bird body and head */}
            <path d="M28 16 C28 10, 22 6, 16 6 C10 6, 6 10, 6 16 C6 22, 10 26, 14 26 C16 26, 18 25, 19 23 L17 22 C16 23, 15 24, 14 24 C12 24, 8 21, 8 16 C8 11, 12 8, 16 8 C20 8, 26 11, 26 16 C26 19, 25 21, 23 22 L25 24 C27 22, 28 19, 28 16 Z" 
                  fill="url(#iconGradient)" stroke="#FFFFFF" strokeWidth="0.3"/>
            
            {/* Bird beak extending from C opening */}
            <path d="M6 16 L2 15 L4 17 L6 16 Z" fill={theme.palette.primary.dark}/>
            
            {/* Bird eye inside C */}
            <circle cx="14" cy="13" r="1.5" fill="#FFFFFF"/>
            <circle cx="14.5" cy="12.5" r="0.8" fill="#37474F"/>
            
            {/* X letter transformed into wings - simplified version */}
            <path d="M19 10 L25 4 C26 3, 27 3, 28 4 C29 5, 29 6, 28 7 L23 12 C22 13, 21 12, 20 11 Z" 
                  fill={theme.palette.primary.light} opacity="0.9"/>
            <path d="M23 20 L29 26 C30 27, 31 27, 32 26 C33 25, 33 24, 32 23 L26 17 C25 16, 24 17, 23 18 Z" 
                  fill={theme.palette.primary.light} opacity="0.9"/>
            <path d="M19 22 L25 28 C26 29, 27 29, 28 28 C29 27, 29 26, 28 25 L22 19 C21 18, 20 19, 19 20 Z" 
                  fill="url(#iconGradient)" opacity="0.8"/>
            <path d="M23 10 L29 4 C30 3, 31 3, 32 4 C33 5, 33 6, 32 7 L26 13 C25 14, 24 13, 23 12 Z" 
                  fill="url(#iconGradient)" opacity="0.8"/>
            
            {/* Clock hands in bird body center */}
            <g stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" opacity="0.8">
              <line x1="16" y1="16" x2="16" y2="14"/>
              <line x1="16" y1="16" x2="18" y2="15"/>
            </g>
            <circle cx="16" cy="16" r="0.8" fill="#FFFFFF"/>
          </g>
        </svg>
      );
    }

    if (actualVariant === 'text') {
      return (
        <svg
          width={width}
          height={height}
          viewBox="0 0 160 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="textGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: theme.palette.primary.main, stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: theme.palette.primary.dark, stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          
          <g fill="url(#textGradient)" fontFamily="Roboto, -apple-system, BlinkMacSystemFont, sans-serif" fontWeight="500">
            <text x="0" y="20" fontSize="18" letterSpacing="0.5px">Cuckoo</text>
            <text x="75" y="20" fontSize="20" fontWeight="600" fill={theme.palette.primary.light}>X</text>
          </g>
        </svg>
      );
    }

    // Full logo with CX bird transformation
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 240 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="birdGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: theme.palette.primary.light, stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: theme.palette.primary.dark, stopOpacity: 1 }} />
          </linearGradient>
          <linearGradient id="textGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: theme.palette.primary.main, stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: theme.palette.primary.dark, stopOpacity: 1 }} />
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
            <feOffset dx="0" dy="2" result="offset"/>
            <feFlood floodColor="#000000" floodOpacity="0.15"/>
            <feComposite in2="offset" operator="in"/>
            <feMerge> 
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/> 
            </feMerge>
          </filter>
        </defs>
        
        <g filter="url(#shadow)">
          {/* C letter transformed into bird body and head */}
          <path d="M48 32 C48 20, 36 12, 24 12 C12 12, 4 20, 4 32 C4 44, 12 52, 20 52 C24 52, 28 50, 30 46 L26 44 C24 46, 22 48, 20 48 C14 48, 8 42, 8 32 C8 22, 14 16, 24 16 C34 16, 44 22, 44 32 C44 38, 42 42, 38 44 L42 48 C46 44, 48 38, 48 32 Z" 
                fill="url(#birdGradient)" stroke="#FFFFFF" strokeWidth="0.5"/>
          
          {/* Bird beak extending from C opening */}
          <path d="M4 32 L-4 30 L-2 34 L4 32 Z" fill={theme.palette.primary.dark}/>
          
          {/* Bird eye inside C */}
          <circle cx="20" cy="26" r="3" fill="#FFFFFF"/>
          <circle cx="21" cy="25" r="1.5" fill="#37474F"/>
          
          {/* X letter transformed into exaggerated wings */}
          <path d="M30 20 L42 8 C44 6, 46 6, 48 8 C50 10, 50 12, 48 14 L38 24 C36 26, 34 24, 32 22 Z" 
                fill={theme.palette.primary.light} opacity="0.9"/>
          <path d="M38 40 L50 52 C52 54, 54 54, 56 52 C58 50, 58 48, 56 46 L44 34 C42 32, 40 34, 38 36 Z" 
                fill={theme.palette.primary.light} opacity="0.9"/>
          <path d="M30 44 L42 56 C44 58, 46 58, 48 56 C50 54, 50 52, 48 50 L36 38 C34 36, 32 38, 30 40 Z" 
                fill="url(#birdGradient)" opacity="0.8"/>
          <path d="M38 20 L50 8 C52 6, 54 6, 56 8 C58 10, 58 12, 56 14 L44 26 C42 28, 40 26, 38 24 Z" 
                fill="url(#birdGradient)" opacity="0.8"/>
          
          {/* Clock hands in bird body center */}
          <g stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8">
            <line x1="24" y1="32" x2="24" y2="28"/>
            <line x1="24" y1="32" x2="28" y2="30"/>
          </g>
          <circle cx="24" cy="32" r="1" fill="#FFFFFF"/>
        </g>
        
        <g fill="url(#textGradient)" fontFamily="Roboto, -apple-system, BlinkMacSystemFont, sans-serif" fontWeight="500">
          <text x="80" y="32" fontSize="18" letterSpacing="0.5px">Cuckoo</text>
          <text x="150" y="32" fontSize="20" fontWeight="600" fill={theme.palette.primary.light}>X</text>
          <text x="80" y="48" fontSize="10" fill={theme.palette.primary.dark} opacity="0.8" letterSpacing="1px">
            破产案件全生命周期管理
          </text>
        </g>
        
        {/* Decorative feather elements */}
        <path d="M200 20 Q205 16 210 20 Q205 24 200 20" fill={theme.palette.primary.light} opacity="0.4"/>
        <path d="M210 45 Q215 41 220 45 Q215 49 210 45" fill={theme.palette.primary.light} opacity="0.3"/>
        <circle cx="225" cy="30" r="1" fill={theme.palette.primary.light} opacity="0.5"/>
      </svg>
    );
  };

  const LogoContent = (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        cursor: href || onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease-in-out',
        '&:hover': {
          transform: href || onClick ? 'scale(1.02)' : 'none',
        },
      }}
      onClick={onClick}
    >
      {renderSVG()}
    </Box>
  );

  if (href) {
    return (
      <Box
        component="a"
        href={href}
        sx={{ textDecoration: 'none', display: 'inline-flex' }}
      >
        {LogoContent}
      </Box>
    );
  }

  return LogoContent;
};

export default Logo; 