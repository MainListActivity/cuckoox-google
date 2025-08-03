import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  IconButton,
  Typography,
  Box,
  Chip,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Slide,
  Alert,
  AlertTitle
} from '@mui/material';
import {
  Camera as CameraIcon,
  PhotoLibrary as GalleryIcon,
  FolderOpen as FileIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';
import mediaFileHandler, {
  MobileFilePickerMode,
  MobileFilePickerOptions,
  MobileFilePickerResult,
  FileMetadata
} from '@/src/services/mediaFileHandler';
import { useSnackbar } from '@/src/contexts/SnackbarContext';

// 过渡动画组件
const Transition = React.forwardRef<unknown, TransitionProps & { children: React.ReactElement }>((props, ref) => {
  return <Slide direction="up" ref={ref} {...props} />;
});

// 组件属性
export interface MobileFilePickerProps {
  open: boolean;
  onClose: () => void;
  onFileSelect: (files: FileMetadata[]) => void;
  options?: MobileFilePickerOptions;
  title?: string;
  maxFiles?: number;
}

// 文件选择模式配置
interface PickerModeConfig {
  mode: MobileFilePickerMode;
  icon: React.ReactNode;
  title: string;
  description: string;
  supportedTypes: string[];
}

const MobileFilePicker: React.FC<MobileFilePickerProps> = ({
  open,
  onClose,
  onFileSelect,
  options = {},
  title = '选择文件',
  maxFiles = 10
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { showSuccess, showError, showWarning } = useSnackbar();

  // 组件状态
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  // 文件选择模式配置
  const modes: PickerModeConfig[] = [
    {
      mode: 'camera',
      icon: <CameraIcon color="primary" />,
      title: '拍照',
      description: '使用相机拍摄照片',
      supportedTypes: ['image/*']
    },
    {
      mode: 'gallery',
      icon: <GalleryIcon color="secondary" />,
      title: '相册',
      description: '从相册选择图片或视频',
      supportedTypes: ['image/*', 'video/*']
    },
    {
      mode: 'file',
      icon: <FileIcon color="info" />,
      title: '文件',
      description: '从文件管理器选择文件',
      supportedTypes: ['*/*']
    }
  ];

  // 处理文件选择
  const handleModeSelect = useCallback(async (mode: MobileFilePickerMode) => {
    try {
      setIsProcessing(true);
      setProcessingMessage(getProcessingMessage(mode));

      // 执行文件选择
      const result: MobileFilePickerResult = await mediaFileHandler.pickFiles(mode, options);

      if (result.cancelled) {
        // 用户取消选择
        setIsProcessing(false);
        setProcessingMessage('');
        return;
      }

      if (result.files.length === 0) {
        showWarning('未选择任何文件');
        setIsProcessing(false);
        setProcessingMessage('');
        return;
      }

      // 检查文件数量限制
      if (result.files.length > maxFiles) {
        showError(`最多只能选择 ${maxFiles} 个文件`);
        setIsProcessing(false);
        setProcessingMessage('');
        return;
      }

      setProcessingMessage('正在处理文件...');

      // 验证并处理文件
      const processedFiles: FileMetadata[] = [];
      const failedFiles: string[] = [];

      for (const file of result.files) {
        try {
          // 移动端文件验证
          const validation = mediaFileHandler.validateMobileFile(file, options);
          
          if (!validation.valid) {
            failedFiles.push(`${file.name}: ${validation.reason}`);
            continue;
          }

          // 显示建议（如果有）
          if (validation.suggestions) {
            validation.suggestions.forEach(suggestion => {
              console.log(`文件建议 (${file.name}): ${suggestion}`);
            });
          }

          // 分片处理文件
          const { metadata } = await mediaFileHandler.splitFileToChunks(file);
          processedFiles.push(metadata);

        } catch (error) {
          console.error(`处理文件失败 (${file.name}):`, error);
          failedFiles.push(`${file.name}: 处理失败`);
        }
      }

      // 显示结果
      if (processedFiles.length > 0) {
        showSuccess(`成功选择 ${processedFiles.length} 个文件`);
        onFileSelect(processedFiles);
        onClose();
      }

      if (failedFiles.length > 0) {
        showError(`${failedFiles.length} 个文件处理失败:\n${failedFiles.join('\n')}`);
      }

    } catch (error) {
      console.error('文件选择失败:', error);
      showError(`文件选择失败: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  }, [options, maxFiles, onFileSelect, onClose, showSuccess, showError, showWarning]);

  // 获取处理消息
  const getProcessingMessage = (mode: MobileFilePickerMode): string => {
    switch (mode) {
      case 'camera':
        return '正在启动相机...';
      case 'gallery':
        return '正在打开相册...';
      case 'file':
        return '正在打开文件管理器...';
      default:
        return '正在处理...';
    }
  };

  // 检查模式是否可用
  const isModeAvailable = (mode: MobileFilePickerMode): boolean => {
    if (mode === 'camera') {
      // 相机模式需要移动端支持
      return isMobile && 'mediaDevices' in navigator;
    }
    return true;
  };

  // 获取接受的文件类型描述
  const getAcceptedTypesDescription = (): string => {
    const { accept = '*/*' } = options;
    
    if (accept === '*/*') {
      return '支持所有文件类型';
    }
    
    if (accept.includes('image')) {
      return '支持图片文件';
    }
    
    if (accept.includes('video')) {
      return '支持视频文件';
    }
    
    if (accept.includes('audio')) {
      return '支持音频文件';
    }
    
    return `支持: ${accept}`;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      TransitionComponent={isMobile ? Transition : undefined}
      PaperProps={{
        sx: {
          ...(isMobile && {
            margin: 0,
            width: '100%',
            maxHeight: '100%',
            borderRadius: 0
          })
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{title}</Typography>
          <IconButton edge="end" color="inherit" onClick={onClose} aria-label="关闭">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 3 }}>
        {/* 文件类型说明 */}
        <Alert severity="info" sx={{ mb: 2 }}>
          <AlertTitle>文件选择说明</AlertTitle>
          <Typography variant="body2">
            {getAcceptedTypesDescription()}
            {maxFiles > 1 && ` • 最多选择 ${maxFiles} 个文件`}
          </Typography>
        </Alert>

        {/* 处理中状态 */}
        {isProcessing && (
          <Box 
            display="flex" 
            flexDirection="column" 
            alignItems="center" 
            justifyContent="center"
            py={4}
          >
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              {processingMessage}
            </Typography>
          </Box>
        )}

        {/* 选择模式列表 */}
        {!isProcessing && (
          <List sx={{ pt: 0 }}>
            {modes
              .filter(mode => isModeAvailable(mode.mode))
              .map((modeConfig) => (
                <ListItem key={modeConfig.mode} disablePadding>
                  <ListItemButton
                    onClick={() => handleModeSelect(modeConfig.mode)}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      border: `1px solid ${theme.palette.divider}`,
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                        borderColor: theme.palette.primary.main
                      }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 56 }}>
                      {modeConfig.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="subtitle1" fontWeight="medium">
                          {modeConfig.title}
                        </Typography>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {modeConfig.description}
                          </Typography>
                          <Box mt={0.5}>
                            {modeConfig.supportedTypes.map((type, index) => (
                              <Chip
                                key={index}
                                label={type}
                                size="small"
                                variant="outlined"
                                sx={{ mr: 0.5, fontSize: '0.7rem' }}
                              />
                            ))}
                          </Box>
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
          </List>
        )}

        {/* 移动端使用提示 */}
        {isMobile && !isProcessing && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Box display="flex" alignItems="center" gap={1}>
              <WarningIcon fontSize="small" />
              <Typography variant="body2">
                在移动端，相机和相册功能需要浏览器权限支持
              </Typography>
            </Box>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MobileFilePicker;