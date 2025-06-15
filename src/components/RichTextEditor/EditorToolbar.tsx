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
  useTheme,
} from '@mui/material';
import { AddComment } from '@mui/icons-material';
import SvgIcon from '@mui/material/SvgIcon';
import { mdiFileDocumentOutline, mdiInformation } from '@mdi/js';
import { useTranslation } from 'react-i18next';
import type { EditorToolbarProps } from './types';

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  breadcrumbs,
  actions,
  contextInfo,
  showContextPanel,
  onToggleContextPanel,
  onAddComment,
  remoteCursors,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

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

          {/* QuillJS Toolbar Container */}
          <Box
            id="quill-toolbar"
            style={{
              borderBottom: 'none',
              boxShadow: 'none',
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              flex: 2,
              justifyContent: 'center',
              minHeight: 42,
              '& .ql-formats': {
                display: 'flex',
                alignItems: 'center',
                mr: 1
              },
              '& .ql-picker': {
                height: 24,
              },
              '& button': {
                width: 28,
                height: 28,
                padding: 0
              },
            }}
          >
            <span className="ql-formats">
              <select className="ql-header" defaultValue={4}>
                <option value="1">{t('heading_1', '标题 1')}</option>
                <option value="2">{t('heading_2', '标题 2')}</option>
                <option value="3">{t('heading_3', '标题 3')}</option>
                <option value="4">{t('normal_text', '正文')}</option>
              </select>
            </span>
            <span className="ql-formats">
              <button className="ql-bold"></button>
              <button className="ql-italic"></button>
              <button className="ql-underline"></button>
            </span>
            <span className="ql-formats">
              <select className="ql-color"></select>
              <select className="ql-background"></select>
            </span>
            <span className="ql-formats">
              <button className="ql-list" value="ordered"></button>
              <button className="ql-list" value="bullet"></button>
              <button className="ql-indent" value="-1"></button>
              <button className="ql-indent" value="+1"></button>
            </span>
            <span className="ql-formats">
              <button className="ql-link"></button>
              <button className="ql-image"></button>
              <button className="ql-attach"></button>
            </span>
            <span className="ql-formats">
              <button className="ql-clean"></button>
            </span>
          </Box>

          {/* Right side actions and indicators */}
          <Stack direction="row" spacing={1} alignItems="center">
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