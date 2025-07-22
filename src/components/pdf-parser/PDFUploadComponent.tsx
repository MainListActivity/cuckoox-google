import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Paper,
  Typography,
  Button,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  PictureAsPdf as PdfIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassTop as HourglassIcon,
} from '@mui/icons-material';
import { UploadedFile } from '@/types/pdfParser';
import { useFileUpload } from '@/src/hooks/usePDFParser';
import { formatFileSize } from '@/src/utils/formatters';

interface PDFUploadComponentProps {
  onFilesUploaded?: (files: UploadedFile[]) => void;
  onFileSelected?: (file: UploadedFile) => void;
  maxFiles?: number;
  maxSize?: number;
  disabled?: boolean;
  caseId?: string;
  multiple?: boolean;
}

const PDFUploadComponent: React.FC<PDFUploadComponentProps> = ({
  onFilesUploaded,
  onFileSelected,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB
  disabled = false,
  caseId,
  multiple = true,
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const { upload, isUploading, error, getProgress, clearProgress } = useFileUpload();

  // 文件验证
  const validateFile = useCallback((file: File): string | null => {
    if (file.type !== 'application/pdf') {
      return '仅支持PDF格式文件';
    }
    if (file.size > maxSize) {
      return `文件大小不能超过 ${formatFileSize(maxSize)}`;
    }
    return null;
  }, [maxSize]);

  // 处理文件拖拽
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // 处理拒绝的文件
    if (rejectedFiles.length > 0) {
      console.warn('部分文件被拒绝:', rejectedFiles);
    }

    // 检查文件数量限制
    const totalFiles = uploadedFiles.length + acceptedFiles.length;
    if (totalFiles > maxFiles) {
      alert(`最多只能上传 ${maxFiles} 个文件`);
      return;
    }

    // 处理接受的文件
    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      file,
      status: 'pending',
      progress: 0,
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // 开始上传文件
    newFiles.forEach(uploadedFile => {
      const validationError = validateFile(uploadedFile.file);
      if (validationError) {
        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === uploadedFile.id 
              ? { ...f, status: 'error', error: validationError }
              : f
          )
        );
        return;
      }

      // 更新状态为上传中
      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === uploadedFile.id 
            ? { ...f, status: 'uploading' }
            : f
        )
      );

      // 开始上传
      upload({
        file: uploadedFile.file,
        caseId,
        fileId: uploadedFile.id,
      }, {
        onSuccess: () => {
          setUploadedFiles(prev => 
            prev.map(f => 
              f.id === uploadedFile.id 
                ? { 
                    ...f, 
                    status: 'completed', 
                    progress: 100,
                    uploadedAt: new Date(),
                  }
                : f
            )
          );
          clearProgress(uploadedFile.id);
          
          // 通知父组件
          if (onFilesUploaded) {
            onFilesUploaded(uploadedFiles.filter(f => f.status === 'completed'));
          }
        },
        onError: (error: any) => {
          setUploadedFiles(prev => 
            prev.map(f => 
              f.id === uploadedFile.id 
                ? { 
                    ...f, 
                    status: 'error', 
                    error: error.message || '上传失败',
                  }
                : f
            )
          );
          clearProgress(uploadedFile.id);
        },
      });
    });
  }, [upload, uploadedFiles, maxFiles, caseId, onFilesUploaded, validateFile, clearProgress]);

  // 配置dropzone
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
  } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize,
    multiple,
    disabled: disabled || isUploading,
    maxFiles,
  });

  // 删除文件
  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    clearProgress(fileId);
  }, [clearProgress]);

  // 重试上传
  const retryUpload = useCallback((file: UploadedFile) => {
    const validationError = validateFile(file.file);
    if (validationError) {
      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === file.id 
            ? { ...f, status: 'error', error: validationError }
            : f
        )
      );
      return;
    }

    setUploadedFiles(prev => 
      prev.map(f => 
        f.id === file.id 
          ? { ...f, status: 'uploading', error: undefined }
          : f
      )
    );

    upload({
      file: file.file,
      caseId,
      fileId: file.id,
    });
  }, [upload, caseId, validateFile]);

  // 选择文件
  const selectFile = useCallback((file: UploadedFile) => {
    if (onFileSelected && file.status === 'completed') {
      onFileSelected(file);
    }
  }, [onFileSelected]);

  // 获取状态图标
  const getStatusIcon = (file: UploadedFile) => {
    switch (file.status) {
      case 'pending':
        return <HourglassIcon color="disabled" />;
      case 'uploading':
        return <HourglassIcon color="primary" />;
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <PdfIcon />;
    }
  };

  // 获取状态标签
  const getStatusChip = (file: UploadedFile) => {
    switch (file.status) {
      case 'pending':
        return <Chip label="等待中" size="small" color="default" />;
      case 'uploading':
        return <Chip label="上传中" size="small" color="primary" />;
      case 'completed':
        return <Chip label="已完成" size="small" color="success" />;
      case 'error':
        return <Chip label="失败" size="small" color="error" />;
      default:
        return null;
    }
  };

  return (
    <Box>
      {/* 上传区域 */}
      <Paper
        {...getRootProps()}
        sx={{
          p: 4,
          border: '2px dashed',
          borderColor: isDragReject 
            ? 'error.main' 
            : isDragActive 
              ? 'primary.main' 
              : 'grey.300',
          backgroundColor: isDragReject 
            ? 'error.light' 
            : isDragActive 
              ? 'primary.light' 
              : 'background.paper',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'center',
          transition: 'all 0.2s ease-in-out',
          opacity: disabled ? 0.5 : 1,
          '&:hover': {
            borderColor: disabled ? 'grey.300' : 'primary.main',
            backgroundColor: disabled ? 'background.paper' : 'primary.light',
          },
        }}
      >
        <input {...getInputProps()} />
        
        <CloudUploadIcon 
          sx={{ 
            fontSize: 48, 
            color: isDragReject ? 'error.main' : 'primary.main',
            mb: 2,
          }} 
        />
        
        {isDragActive ? (
          <Typography variant="h6" color="primary">
            {isDragReject ? '文件格式不支持' : '释放文件开始上传'}
          </Typography>
        ) : (
          <>
            <Typography variant="h6" gutterBottom>
              拖拽PDF文件到这里，或点击选择文件
            </Typography>
            <Typography variant="body2" color="text.secondary">
              支持PDF格式，单个文件最大 {formatFileSize(maxSize)}
              {multiple && `，最多上传 ${maxFiles} 个文件`}
            </Typography>
          </>
        )}

        {!disabled && (
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            sx={{ mt: 2 }}
            disabled={isUploading}
          >
            选择文件
          </Button>
        )}
      </Paper>

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          上传失败: {error.message}
        </Alert>
      )}

      {/* 文件列表 */}
      {uploadedFiles.length > 0 && (
        <Paper sx={{ mt: 2 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6">文件列表</Typography>
            <Typography variant="body2" color="text.secondary">
              {uploadedFiles.filter(f => f.status === 'completed').length} / {uploadedFiles.length} 个文件已完成
            </Typography>
          </Box>
          
          <List>
            {uploadedFiles.map((file) => (
              <ListItem 
                key={file.id}
                sx={{
                  cursor: file.status === 'completed' && onFileSelected ? 'pointer' : 'default',
                  '&:hover': file.status === 'completed' && onFileSelected ? {
                    backgroundColor: 'action.hover',
                  } : {},
                }}
                onClick={() => selectFile(file)}
              >
                <ListItemIcon>
                  {getStatusIcon(file)}
                </ListItemIcon>
                
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body1" noWrap>
                        {file.name}
                      </Typography>
                      {getStatusChip(file)}
                    </Stack>
                  }
                  secondary={
                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        {formatFileSize(file.size)}
                        {file.uploadedAt && ` • 上传于 ${file.uploadedAt.toLocaleString()}`}
                      </Typography>
                      
                      {file.status === 'uploading' && (
                        <LinearProgress 
                          variant="determinate" 
                          value={getProgress(file.id)} 
                          sx={{ width: '100%' }}
                        />
                      )}
                      
                      {file.error && (
                        <Typography variant="body2" color="error">
                          {file.error}
                        </Typography>
                      )}
                    </Stack>
                  }
                />
                
                <ListItemSecondaryAction>
                  <Stack direction="row" spacing={1}>
                    {file.status === 'error' && (
                      <IconButton
                        edge="end"
                        onClick={(e) => {
                          e.stopPropagation();
                          retryUpload(file);
                        }}
                        size="small"
                        disabled={isUploading}
                      >
                        <RefreshIcon />
                      </IconButton>
                    )}
                    
                    <IconButton
                      edge="end"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file.id);
                      }}
                      size="small"
                      disabled={file.status === 'uploading'}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
};

export default PDFUploadComponent;