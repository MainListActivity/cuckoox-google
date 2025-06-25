import React from 'react';
import {
  Paper,
  Box,
  Typography,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import { ChevronLeft } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { OutlinePanelProps } from './types';

const OutlinePanel: React.FC<OutlinePanelProps> = ({
  isOpen,
  outline,
  onClose,
  onScrollToHeader,
  activeHeaderIndex = -1,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <Paper
      elevation={4}
      sx={{
        width: 280,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: 1,
        borderColor: 'divider',
        position: 'relative',
        zIndex: 20
      }}
    >
      {/* 标题栏 */}
      <Box 
        sx={{ 
          p: '12px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          borderBottom: 1, 
          borderColor: 'divider' 
        }}
      >
        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
          {t('outline', '大纲')}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <ChevronLeft />
        </IconButton>
      </Box>

      {/* 大纲内容 */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <List sx={{ p: 1 }}>
          {outline.length > 0 ? (
            outline.map((item, index) => (
              <ListItemButton
                key={index}
                selected={index === activeHeaderIndex}
                sx={{
                  pl: item.level * 2, 
                  borderRadius: 1,
                  py: 0.5,
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                  },
                }}
                onClick={() => onScrollToHeader(item.text, item.level)}
              >
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    fontWeight: item.level === 1 ? 600 : 400,
                  }}
                />
              </ListItemButton>
            ))
          ) : (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ fontSize: '0.875rem' }}
              >
                {t('no_headings_found', '文档中未找到标题')}
              </Typography>
            </Box>
          )}
        </List>
      </Box>
    </Paper>
  );
};

export default OutlinePanel; 