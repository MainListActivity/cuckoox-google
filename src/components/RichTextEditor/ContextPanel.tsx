import React from 'react';
import {
  Paper,
  Box,
  Typography,
  IconButton,
  Stack,
  Avatar,
  Divider,
  Fade,
  useTheme,
  alpha,
} from '@mui/material';
import SvgIcon from '@mui/material/SvgIcon';
import { mdiClose } from '@mdi/js';
import type { ContextPanelProps } from './types';

const ContextPanel: React.FC<ContextPanelProps> = ({
  contextInfo,
  showPanel,
  onClose,
}) => {
  const theme = useTheme();

  if (!contextInfo || !showPanel) return null;

  return (
    <Fade in={showPanel}>
      <Paper
        elevation={3}
        sx={{
          width: '100%',
          maxHeight: '100%',
          overflow: 'auto',
          backdropFilter: 'blur(10px)',
          backgroundColor: alpha(theme.palette.background.paper, 0.95),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        <Box sx={{ p: 2 }}>
          {/* 标题栏 */}
          <Stack 
            direction="row" 
            justifyContent="space-between" 
            alignItems="flex-start" 
            mb={2}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              {contextInfo.avatar && (
                <Avatar
                  sx={{
                    bgcolor: contextInfo.avatar.color || theme.palette.primary.main,
                    width: 32,
                    height: 32,
                    fontSize: '0.875rem',
                  }}
                >
                  {contextInfo.avatar.text}
                </Avatar>
              )}
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  {contextInfo.title}
                </Typography>
                {contextInfo.subtitle && (
                  <Typography variant="caption" color="text.secondary">
                    {contextInfo.subtitle}
                  </Typography>
                )}
              </Box>
            </Stack>
            <IconButton
              size="small"
              onClick={onClose}
              sx={{ ml: 1 }}
            >
              <SvgIcon>
                <path d={mdiClose} />
              </SvgIcon>
            </IconButton>
          </Stack>

          <Divider sx={{ mb: 2 }} />

          {/* 详情列表 */}
          <Stack spacing={1.5}>
            {contextInfo.details.map((detail, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                {detail.icon && (
                  <SvgIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.25 }}>
                    <path d={detail.icon} />
                  </SvgIcon>
                )}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {detail.label}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      wordBreak: 'break-word',
                      lineHeight: 1.4,
                    }}
                  >
                    {detail.value}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      </Paper>
    </Fade>
  );
};

export default ContextPanel; 