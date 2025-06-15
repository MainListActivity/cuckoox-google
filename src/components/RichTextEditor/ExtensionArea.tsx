import React, { useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  useTheme,
  alpha,
} from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import SvgIcon from '@mui/material/SvgIcon';
import { useTranslation } from 'react-i18next';
import type { ExtensionAreaProps } from './types';

const ExtensionArea: React.FC<ExtensionAreaProps> = ({
  tabs,
  content,
  isOpen,
  height,
  currentTabId,
  onTabChange,
  onToggle,
  onHeightChange,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const resizingRef = useRef<boolean>(false);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(300);

  // 处理拖动调整高度
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    resizingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = height;

    const handleResizeMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;

      const deltaY = startYRef.current - e.clientY;
      const newHeight = Math.max(100, Math.min(600, startHeightRef.current + deltaY));
      onHeightChange(newHeight);
    };

    const handleResizeEnd = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }, [height, onHeightChange]);

  if (tabs.length === 0) return null;

  const currentTab = tabs.find(tab => tab.id === currentTabId);

  return (
    <Box
      sx={{
        borderTop: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        height: isOpen ? `${height}px` : '48px',
        transition: 'height 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 拖动调整高度的手柄 */}
      {isOpen && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '6px',
            cursor: 'ns-resize',
            backgroundColor: 'transparent',
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
            },
            zIndex: 1,
          }}
          onMouseDown={handleResizeStart}
        />
      )}

      {/* 面板标题栏 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          borderBottom: isOpen ? `1px solid ${theme.palette.divider}` : 'none',
          cursor: 'pointer',
          minHeight: '48px',
        }}
        onClick={onToggle}
      >
        {/* 左侧: 当前标签页标题 */}
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {currentTab?.label || t('extension_area', '扩展区域')}
        </Typography>

        {/* 中间: 标签页切换器 */}
        {isOpen && tabs.length > 1 && (
          <Tabs
            value={currentTabId}
            onChange={(event, value) => {
              event.stopPropagation();
              onTabChange(value);
            }}
            sx={{ mx: 2, flex: 1 }}
            variant="scrollable"
            scrollButtons="auto"
          >
            {tabs.map((tab) => (
              <Tab
                key={tab.id}
                value={tab.id}
                label={tab.label}
                icon={tab.icon ? (
                  <SvgIcon fontSize="small">
                    <path d={tab.icon} />
                  </SvgIcon>
                ) : undefined}
                iconPosition="start"
                sx={{ minHeight: 36, py: 0.5 }}
              />
            ))}
          </Tabs>
        )}

        {/* 右侧: 折叠/展开按钮 */}
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          sx={{ ml: 'auto' }}
        >
          {isOpen ? <ExpandMore /> : <ExpandLess />}
        </IconButton>
      </Box>

      {/* 面板内容区域 */}
      {isOpen && (
        <Box 
          sx={{ 
            overflowY: 'auto', 
            height: `calc(100% - 48px)`,
            position: 'relative',
          }}
        >
          {content ? (
            content.renderContent ? (
              content.renderContent()
            ) : (
              <DefaultContentRenderer content={content} />
            )
          ) : (
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Typography color="text.secondary">
                {t('no_extension_content', '暂无可用的扩展信息')}
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

// 默认内容渲染器组件
const DefaultContentRenderer: React.FC<{ content: any }> = ({ content }) => {
  const { t } = useTranslation();

  if (!content) return null;

  return (
    <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <Typography color="text.secondary">
        {t('unsupported_content_type', '无法显示此类型的扩展信息')}
      </Typography>
    </Box>
  );
};

export default ExtensionArea; 