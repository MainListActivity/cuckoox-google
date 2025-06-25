import React from 'react';
import {
  AppBar,
  Toolbar,
  Stack,
  Typography,
  Box,
  IconButton,
  Avatar,
  Tooltip,
  Button,
  CircularProgress,
  useTheme,
} from '@mui/material';
import { AddComment, Save } from '@mui/icons-material';
import SvgIcon from '@mui/material/SvgIcon';
import { mdiFileDocumentOutline, mdiInformation } from '@mdi/js';
import { useTranslation } from 'react-i18next';
import type { EditorToolbarProps } from './types';
import { useEffect, useRef } from 'react';

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  breadcrumbs,
  actions,
  contextInfo,
  showContextPanel,
  onToggleContextPanel,
  onAddComment,
  remoteCursors,
  onSave,
  isSaving = false,
  showSaveButton = true,
  saveButtonText,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const toolbarContainerRef = useRef<HTMLDivElement>(null);

  const handleSave = () => {
    if (onSave && !isSaving) {
      onSave();
    }
  };

  // 将Quill生成的toolbar移动到我们的容器中
  useEffect(() => {
    const moveToolbarToContainer = () => {
      const quillToolbar = document.querySelector('.ql-toolbar.ql-snow');
      const container = toolbarContainerRef.current;
      
      if (quillToolbar && container && !container.contains(quillToolbar)) {
        // 移动toolbar到我们的容器中
        container.appendChild(quillToolbar);
        
        // 应用自定义样式，确保没有border和shadow
        const toolbarElement = quillToolbar as HTMLElement;
        toolbarElement.style.position = 'static';
        toolbarElement.style.display = 'flex';
        toolbarElement.style.alignItems = 'center';
        toolbarElement.style.justifyContent = 'center';
        toolbarElement.style.border = 'none';
        toolbarElement.style.borderTop = 'none';
        toolbarElement.style.borderBottom = 'none';
        toolbarElement.style.borderLeft = 'none';
        toolbarElement.style.borderRight = 'none';
        toolbarElement.style.boxShadow = 'none';
        toolbarElement.style.setProperty('-webkit-box-shadow', 'none');
        toolbarElement.style.setProperty('-moz-box-shadow', 'none');
        toolbarElement.style.padding = '0';
        toolbarElement.style.margin = '0';
        toolbarElement.style.backgroundColor = 'transparent';
      }
    };

    // 延迟执行，确保Quill已经创建了toolbar
    const timer = setTimeout(moveToolbarToContainer, 100);
    
    // 也监听DOM变化
    const observer = new MutationObserver(moveToolbarToContainer);
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
        zIndex: 1000,
        '& .MuiToolbar-root': {
          minHeight: 56,
          px: 2,
        }
      }}
    >
      <Toolbar>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, width: '100%' }}>
          {/* Document Title & Breadcrumbs */}
          <Stack direction="column" sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            {breadcrumbs}
            <Stack direction="row" alignItems="center" spacing={1}>
              <SvgIcon sx={{ color: 'text.secondary', flexShrink: 0 }}>
                <path d={mdiFileDocumentOutline} />
              </SvgIcon>
              <Typography variant="h6" component="div" sx={{ fontWeight: 500 }} noWrap>
                {contextInfo?.title || t('untitled_document', '未命名文档')}
              </Typography>
            </Stack>
          </Stack>

          {/* Quill自动生成的Toolbar容器 */}
          <Box
            ref={toolbarContainerRef}
            id="quill-toolbar-container"
            sx={{
              display: 'flex',
              alignItems: 'center',
              flex: 2,
              justifyContent: 'center',
              minHeight: 42,
              position: 'relative',
            }}
          />

          {/* Right side actions and indicators */}
          <Stack direction="row" spacing={1} alignItems="center">
            {/* 内置保存按钮 */}
            {showSaveButton && onSave && (
              <Button
                startIcon={isSaving ? <CircularProgress size={16} /> : <Save />}
                variant="contained"
                color="primary"
                size="small"
                onClick={handleSave}
                disabled={isSaving}
                sx={{ minWidth: 100 }}
              >
                {isSaving 
                  ? t('saving', '保存中...') 
                  : (saveButtonText || t('save', '保存'))
                }
              </Button>
            )}

            {/* 外部传入的其他actions */}
            {actions}
            
            {/* Collaboration indicators */}
            {Object.keys(remoteCursors).length > 0 && (
              <Stack direction="row" spacing={-1}>
                {Object.values(remoteCursors).slice(0, 3).map((cursor) => (
                  <Tooltip key={cursor.userId} title={cursor.userName || cursor.userId}>
                    <Avatar
                      sx={{
                        width: 24,
                        height: 24,
                        fontSize: '0.75rem',
                        bgcolor: cursor.color,
                        border: `2px solid ${theme.palette.background.paper}`,
                      }}
                    >
                      {(cursor.userName || cursor.userId).charAt(0).toUpperCase()}
                    </Avatar>
                  </Tooltip>
                ))}
                {Object.keys(remoteCursors).length > 3 && (
                  <Avatar
                    sx={{
                      width: 24,
                      height: 24,
                      fontSize: '0.75rem',
                      bgcolor: 'text.secondary',
                      border: `2px solid ${theme.palette.background.paper}`,
                    }}
                  >
                    +{Object.keys(remoteCursors).length - 3}
                  </Avatar>
                )}
              </Stack>
            )}

            {/* Add Comment button */}
            <Tooltip title={t('add_comment', '添加批注')}>
              <IconButton
                size="small"
                onClick={onAddComment}
                sx={{ color: 'text.secondary' }}
              >
                <AddComment />
              </IconButton>
            </Tooltip>

            {/* Context panel toggle */}
            {contextInfo && (
              <Tooltip title={showContextPanel ? t('hide_details_panel', '隐藏详情面板') : t('show_details_panel', '显示详情面板')}>
                <IconButton
                  size="small"
                  onClick={onToggleContextPanel}
                  sx={{
                    color: showContextPanel ? 'primary.main' : 'text.secondary',
                  }}
                >
                  <SvgIcon>
                    <path d={mdiInformation} />
                  </SvgIcon>
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default EditorToolbar; 