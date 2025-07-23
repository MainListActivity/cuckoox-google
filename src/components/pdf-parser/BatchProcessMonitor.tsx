import React, { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  LinearProgress,
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Divider,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  CloudUpload as CloudUploadIcon,
  Assessment as AssessmentIcon,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import { formatFileSize, formatPercentage } from '@/src/utils/formatters';

// 批量处理任务状态
export type BatchTaskStatus = 'pending' | 'uploading' | 'processing' | 'completed' | 'error' | 'cancelled';

// 单个文件任务
export interface FileTask {
  id: string;
  fileName: string;
  fileSize: number;
  status: BatchTaskStatus;
  progress: number;
  uploadProgress: number;
  parseProgress: number;
  error?: string;
  result?: {
    parseId: string;
    fieldsCount: number;
    confidence: number;
  };
  startTime?: Date;
  endTime?: Date;
  retryCount: number;
  maxRetries: number;
}

// 批量处理任务
export interface BatchTask {
  id: string;
  name: string;
  status: BatchTaskStatus;
  totalFiles: number;
  completedFiles: number;
  errorFiles: number;
  progress: number;
  files: FileTask[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  settings: BatchProcessSettings;
}

// 批量处理设置
export interface BatchProcessSettings {
  concurrent: number; // 并发数
  autoRetry: boolean;
  maxRetries: number;
  outputFormat: 'json' | 'csv' | 'excel';
  includeMetadata: boolean;
  confidenceThreshold: number;
}

// 统计信息
interface BatchStatistics {
  totalTasks: number;
  completedTasks: number;
  errorTasks: number;
  totalProcessingTime: number;
  averageFileSize: number;
  averageProcessingTime: number;
  successRate: number;
}

interface BatchProcessMonitorProps {
  batchTasks: BatchTask[];
  onTaskStart?: (taskId: string) => void;
  onTaskPause?: (taskId: string) => void;
  onTaskStop?: (taskId: string) => void;
  onTaskRetry?: (taskId: string, fileId: string) => void;
  onTaskDelete?: (taskId: string) => void;
  _onExportResults?: (taskId: string, format: string) => void;
}

const BatchProcessMonitor: React.FC<BatchProcessMonitorProps> = ({
  batchTasks,
  onTaskStart,
  onTaskPause,
  onTaskStop,
  onTaskRetry,
  onTaskDelete,
  _onExportResults,
}) => {
  const [_selectedTask, _setSelectedTask] = useState<BatchTask | null>(null);
  const [_showTaskDetails, _setShowTaskDetails] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<BatchTaskStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 过滤和搜索任务
  const filteredTasks = batchTasks.filter(task => {
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    const matchesSearch = task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.files.some(file => file.fileName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  // 计算统计信息
  const calculateStatistics = useCallback((): BatchStatistics => {
    const allFiles = batchTasks.flatMap(task => task.files);
    const completedFiles = allFiles.filter(file => file.status === 'completed');
    const errorFiles = allFiles.filter(file => file.status === 'error');
    
    const totalProcessingTime = completedFiles.reduce((sum, file) => {
      if (file.startTime && file.endTime) {
        return sum + (file.endTime.getTime() - file.startTime.getTime());
      }
      return sum;
    }, 0);

    const totalFileSize = allFiles.reduce((sum, file) => sum + file.fileSize, 0);

    return {
      totalTasks: allFiles.length,
      completedTasks: completedFiles.length,
      errorTasks: errorFiles.length,
      totalProcessingTime,
      averageFileSize: allFiles.length > 0 ? totalFileSize / allFiles.length : 0,
      averageProcessingTime: completedFiles.length > 0 ? totalProcessingTime / completedFiles.length : 0,
      successRate: allFiles.length > 0 ? (completedFiles.length / allFiles.length) * 100 : 0,
    };
  }, [batchTasks]);

  const statistics = calculateStatistics();

  // 获取状态图标
  const getStatusIcon = (status: BatchTaskStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'processing':
      case 'uploading':
        return <ScheduleIcon color="primary" />;
      case 'pending':
        return <CloudUploadIcon color="action" />;
      case 'cancelled':
        return <StopIcon color="action" />;
      default:
        return <ScheduleIcon color="action" />;
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: BatchTaskStatus): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      case 'processing':
      case 'uploading':
        return 'primary';
      case 'pending':
        return 'default';
      case 'cancelled':
        return 'secondary';
      default:
        return 'default';
    }
  };

  // 获取状态标签
  const getStatusLabel = (status: BatchTaskStatus) => {
    const labels = {
      pending: '等待中',
      uploading: '上传中',
      processing: '处理中',
      completed: '已完成',
      error: '错误',
      cancelled: '已取消',
    };
    return labels[status] || status;
  };

  // 切换任务展开状态
  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  // 格式化处理时间
  const formatDuration = (milliseconds: number) => {
    if (milliseconds === 0) return '0秒';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  };

  // 导出批量结果
  const handleExportResults = (task: BatchTask) => {
    const results = {
      taskInfo: {
        id: task.id,
        name: task.name,
        status: task.status,
        totalFiles: task.totalFiles,
        completedFiles: task.completedFiles,
        errorFiles: task.errorFiles,
        progress: task.progress,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
      },
      files: task.files.map(file => ({
        fileName: file.fileName,
        fileSize: file.fileSize,
        status: file.status,
        progress: file.progress,
        error: file.error,
        result: file.result,
        processingTime: file.startTime && file.endTime ? 
          file.endTime.getTime() - file.startTime.getTime() : null,
        retryCount: file.retryCount,
      })),
      statistics: {
        successRate: task.totalFiles > 0 ? (task.completedFiles / task.totalFiles) * 100 : 0,
        errorRate: task.totalFiles > 0 ? (task.errorFiles / task.totalFiles) * 100 : 0,
        totalProcessingTime: task.files.reduce((sum, file) => {
          if (file.startTime && file.endTime) {
            return sum + (file.endTime.getTime() - file.startTime.getTime());
          }
          return sum;
        }, 0),
      },
    };

    const blob = new Blob([JSON.stringify(results, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `批量处理结果_${task.name}_${new Date().toLocaleDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader
        title="批量处理监控"
        subheader={`总计 ${batchTasks.length} 个批量任务`}
        action={
          <Button
            variant="outlined"
            startIcon={<AssessmentIcon />}
            onClick={() => setShowStatistics(true)}
          >
            查看统计
          </Button>
        }
      />
      <CardContent>
        {/* 全局统计信息 */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="h4" color="primary">
                  {statistics.totalTasks}
                </Typography>
                <Typography variant="caption">总文件数</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="h4" color="success.main">
                  {statistics.completedTasks}
                </Typography>
                <Typography variant="caption">已完成</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="h4" color="error.main">
                  {statistics.errorTasks}
                </Typography>
                <Typography variant="caption">处理失败</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="h4" color="info.main">
                  {formatPercentage(statistics.successRate / 100)}
                </Typography>
                <Typography variant="caption">成功率</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 过滤和搜索 */}
        <Box display="flex" gap={2} mb={3}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>状态筛选</InputLabel>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as BatchTaskStatus | 'all')}
              label="状态筛选"
            >
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value="pending">等待中</MenuItem>
              <MenuItem value="processing">处理中</MenuItem>
              <MenuItem value="completed">已完成</MenuItem>
              <MenuItem value="error">错误</MenuItem>
              <MenuItem value="cancelled">已取消</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="搜索任务或文件"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flexGrow: 1 }}
          />
        </Box>

        {/* 批量任务列表 */}
        {filteredTasks.length === 0 ? (
          <Alert severity="info">
            没有找到匹配的批量任务。
          </Alert>
        ) : (
          <List>
            {filteredTasks.map((task) => (
              <Card key={task.id} sx={{ mb: 2 }}>
                <ListItem>
                  <ListItemIcon>
                    {getStatusIcon(task.status)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={2}>
                        <Typography variant="subtitle1">{task.name}</Typography>
                        <Chip 
                          label={getStatusLabel(task.status)} 
                          color={getStatusColor(task.status)}
                          size="small"
                        />
                        <Typography variant="caption">
                          {task.completedFiles}/{task.totalFiles} 完成
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box mt={1}>
                        <LinearProgress 
                          variant="determinate" 
                          value={task.progress} 
                          sx={{ mb: 1 }}
                        />
                        <Typography variant="caption" color="textSecondary">
                          创建时间: {task.createdAt.toLocaleString()}
                          {task.completedAt && ` | 完成时间: ${task.completedAt.toLocaleString()}`}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box display="flex" gap={1}>
                      {/* 任务控制按钮 */}
                      {task.status === 'pending' && (
                        <Tooltip title="开始处理">
                          <IconButton onClick={() => onTaskStart?.(task.id)}>
                            <PlayIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {task.status === 'processing' && (
                        <Tooltip title="暂停处理">
                          <IconButton onClick={() => onTaskPause?.(task.id)}>
                            <PauseIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {(task.status === 'processing' || task.status === 'pending') && (
                        <Tooltip title="停止处理">
                          <IconButton onClick={() => onTaskStop?.(task.id)}>
                            <StopIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {task.status === 'completed' && (
                        <Tooltip title="导出结果">
                          <IconButton onClick={() => handleExportResults(task)}>
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="查看详情">
                        <IconButton onClick={() => toggleTaskExpansion(task.id)}>
                          {expandedTasks.has(task.id) ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除任务">
                        <IconButton 
                          onClick={() => onTaskDelete?.(task.id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>

                {/* 任务详情 */}
                <Collapse in={expandedTasks.has(task.id)}>
                  <Box sx={{ px: 3, pb: 2 }}>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="subtitle2" gutterBottom>
                      文件处理详情
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>文件名</TableCell>
                            <TableCell>大小</TableCell>
                            <TableCell>状态</TableCell>
                            <TableCell>进度</TableCell>
                            <TableCell>结果</TableCell>
                            <TableCell>操作</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {task.files.map((file) => (
                            <TableRow key={file.id}>
                              <TableCell>
                                <Typography variant="body2">{file.fileName}</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {formatFileSize(file.fileSize)}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={getStatusLabel(file.status)}
                                  color={getStatusColor(file.status)}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                <Box sx={{ width: 80 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={file.progress}
                                    size="small"
                                  />
                                  <Typography variant="caption">
                                    {Math.round(file.progress)}%
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                {file.result ? (
                                  <Box>
                                    <Typography variant="caption">
                                      {file.result.fieldsCount} 字段
                                    </Typography>
                                    <br />
                                    <Typography variant="caption" color="textSecondary">
                                      置信度: {formatPercentage(file.result.confidence)}
                                    </Typography>
                                  </Box>
                                ) : file.error ? (
                                  <Typography variant="caption" color="error">
                                    {file.error}
                                  </Typography>
                                ) : (
                                  <Typography variant="caption" color="textSecondary">
                                    等待结果
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                {file.status === 'error' && file.retryCount < file.maxRetries && (
                                  <Tooltip title="重试处理">
                                    <IconButton
                                      size="small"
                                      onClick={() => onTaskRetry?.(task.id, file.id)}
                                    >
                                      <RefreshIcon />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Collapse>
              </Card>
            ))}
          </List>
        )}

        {/* 详细统计对话框 */}
        <Dialog open={showStatistics} onClose={() => setShowStatistics(false)} maxWidth="md" fullWidth>
          <DialogTitle>批量处理统计报告</DialogTitle>
          <DialogContent>
            <Grid container spacing={3}>
              <Grid size={12}>
                <Typography variant="h6" gutterBottom>
                  处理概览
                </Typography>
              </Grid>
              
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      文件处理统计
                    </Typography>
                    <Typography>总文件数: {statistics.totalTasks}</Typography>
                    <Typography>成功处理: {statistics.completedTasks}</Typography>
                    <Typography>处理失败: {statistics.errorTasks}</Typography>
                    <Typography>成功率: {formatPercentage(statistics.successRate / 100)}</Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      性能统计
                    </Typography>
                    <Typography>
                      平均文件大小: {formatFileSize(statistics.averageFileSize)}
                    </Typography>
                    <Typography>
                      平均处理时间: {formatDuration(statistics.averageProcessingTime)}
                    </Typography>
                    <Typography>
                      总处理时间: {formatDuration(statistics.totalProcessingTime)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={12}>
                <Typography variant="h6" gutterBottom>
                  任务分布
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>任务名称</TableCell>
                        <TableCell>状态</TableCell>
                        <TableCell align="right">文件数</TableCell>
                        <TableCell align="right">成功率</TableCell>
                        <TableCell align="right">处理时间</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {batchTasks.map((task) => {
                        const taskProcessingTime = task.files.reduce((sum, file) => {
                          if (file.startTime && file.endTime) {
                            return sum + (file.endTime.getTime() - file.startTime.getTime());
                          }
                          return sum;
                        }, 0);
                        
                        return (
                          <TableRow key={task.id}>
                            <TableCell>{task.name}</TableCell>
                            <TableCell>
                              <Chip
                                label={getStatusLabel(task.status)}
                                color={getStatusColor(task.status)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="right">{task.totalFiles}</TableCell>
                            <TableCell align="right">
                              {formatPercentage(task.totalFiles > 0 ? task.completedFiles / task.totalFiles : 0)}
                            </TableCell>
                            <TableCell align="right">
                              {formatDuration(taskProcessingTime)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowStatistics(false)}>关闭</Button>
            <Button variant="contained" startIcon={<DownloadIcon />}>
              导出报告
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default BatchProcessMonitor;