/**
 * 债权统计分析页面
 * 展示债权处理的各种统计图表和报告
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  GetApp as GetAppIcon
} from '@mui/icons-material';
import { RecordId } from 'surrealdb';
import ClaimStatisticsCharts from '../components/claim/ClaimStatisticsCharts';
import { claimDataExportService } from '../services/claimDataExportService';
import type { ExportConfig, ExportTask, ExportFormat } from '../services/claimDataExportService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`statistics-tabpanel-${index}`}
      aria-labelledby={`statistics-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const ClaimStatisticsPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportTasks, setExportTasks] = useState<ExportTask[]>([]);
  const [exportTasksDialogOpen, setExportTasksDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info'>('info');

  // 导出配置状态
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    format: 'excel',
    includeCharts: true,
    sections: {
      overview: true,
      efficiency: true,
      quality: true,
      workload: true,
      statusFlow: true,
      bottleneck: true,
      timeSeries: true,
      rawData: false
    }
  });

  // 筛选状态
  const [selectedCaseId, setSelectedCaseId] = useState<RecordId | string | undefined>();
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30天前
    end: new Date()
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // 处理导出配置变更
  const handleExportConfigChange = (field: keyof ExportConfig, value: any) => {
    setExportConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSectionChange = (section: keyof ExportConfig['sections'], checked: boolean) => {
    setExportConfig(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [section]: checked
      }
    }));
  };

  // 创建导出任务
  const handleCreateExportTask = async () => {
    try {
      const finalConfig: ExportConfig = {
        ...exportConfig,
        caseId: selectedCaseId,
        dateRange: dateRange
      };

      const task = await claimDataExportService.createExportTask(finalConfig);
      
      setSnackbarMessage(`导出任务已创建：${task.id}`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setExportDialogOpen(false);
      
      // 刷新导出任务列表
      loadExportTasks();
      
    } catch (error) {
      setSnackbarMessage(`创建导出任务失败：${error instanceof Error ? error.message : '未知错误'}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  // 加载导出任务列表
  const loadExportTasks = () => {
    const tasks = claimDataExportService.getAllExportTasks();
    setExportTasks(tasks);
  };

  // 处理数据导出（来自图表组件）
  const handleExportData = (data: any) => {
    console.log('Export data from charts:', data);
    // 这里可以直接处理图表组件传来的数据
    setSnackbarMessage('数据已准备完成，可在导出任务中下载');
    setSnackbarSeverity('info');
    setSnackbarOpen(true);
  };

  // 下载文件
  const handleDownloadFile = (task: ExportTask) => {
    if (task.downloadUrl) {
      // 创建下载链接
      const link = document.createElement('a');
      link.href = task.downloadUrl;
      link.download = `claim_statistics_${task.id}.${task.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSnackbarMessage('文件下载已开始');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    }
  };

  // 获取任务状态颜色
  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'in_progress':
        return 'info';
      default:
        return 'default';
    }
  };

  // 获取任务状态文本
  const getTaskStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '等待中';
      case 'in_progress':
        return '处理中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      default:
        return status;
    }
  };

  useEffect(() => {
    // 定期刷新导出任务状态
    const interval = setInterval(() => {
      loadExportTasks();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadExportTasks();
  }, []);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          债权统计分析
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          查看债权处理效率、质量指标和工作量统计
        </Typography>
      </Box>

      <Paper elevation={1} sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'between', alignItems: 'center', px: 2 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="统计分析标签页">
            <Tab label="综合统计" />
            <Tab label="效率分析" />
            <Tab label="质量分析" />
            <Tab label="工作量分析" />
            <Tab label="瓶颈分析" />
          </Tabs>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<GetAppIcon />}
              onClick={() => setExportTasksDialogOpen(true)}
            >
              导出任务
            </Button>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={() => setExportDialogOpen(true)}
            >
              导出报告
            </Button>
          </Box>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <ClaimStatisticsCharts
            caseId={selectedCaseId}
            defaultDateRange={dateRange}
            onExportData={handleExportData}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <ClaimStatisticsCharts
            caseId={selectedCaseId}
            defaultDateRange={dateRange}
            onExportData={handleExportData}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <ClaimStatisticsCharts
            caseId={selectedCaseId}
            defaultDateRange={dateRange}
            onExportData={handleExportData}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <ClaimStatisticsCharts
            caseId={selectedCaseId}
            defaultDateRange={dateRange}
            onExportData={handleExportData}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <ClaimStatisticsCharts
            caseId={selectedCaseId}
            defaultDateRange={dateRange}
            onExportData={handleExportData}
          />
        </TabPanel>
      </Paper>

      {/* 导出配置对话框 */}
      <Dialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>导出统计报告</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>导出格式</InputLabel>
              <Select
                value={exportConfig.format}
                onChange={(e) => handleExportConfigChange('format', e.target.value as ExportFormat)}
                label="导出格式"
              >
                <MenuItem value="excel">Excel (.xlsx)</MenuItem>
                <MenuItem value="pdf">PDF (.pdf)</MenuItem>
                <MenuItem value="csv">CSV (.csv)</MenuItem>
              </Select>
            </FormControl>

            <Typography variant="subtitle2" gutterBottom>
              包含内容
            </Typography>
            <Box sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={exportConfig.sections.overview}
                    onChange={(e) => handleSectionChange('overview', e.target.checked)}
                  />
                }
                label="概览统计"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={exportConfig.sections.efficiency}
                    onChange={(e) => handleSectionChange('efficiency', e.target.checked)}
                  />
                }
                label="处理效率"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={exportConfig.sections.quality}
                    onChange={(e) => handleSectionChange('quality', e.target.checked)}
                  />
                }
                label="质量指标"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={exportConfig.sections.workload}
                    onChange={(e) => handleSectionChange('workload', e.target.checked)}
                  />
                }
                label="工作量统计"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={exportConfig.sections.statusFlow}
                    onChange={(e) => handleSectionChange('statusFlow', e.target.checked)}
                  />
                }
                label="状态流转"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={exportConfig.sections.bottleneck}
                    onChange={(e) => handleSectionChange('bottleneck', e.target.checked)}
                  />
                }
                label="瓶颈分析"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={exportConfig.sections.timeSeries}
                    onChange={(e) => handleSectionChange('timeSeries', e.target.checked)}
                  />
                }
                label="时间趋势"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={exportConfig.sections.rawData}
                    onChange={(e) => handleSectionChange('rawData', e.target.checked)}
                  />
                }
                label="原始数据"
              />
            </Box>

            {exportConfig.format !== 'csv' && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={exportConfig.includeCharts}
                    onChange={(e) => handleExportConfigChange('includeCharts', e.target.checked)}
                  />
                }
                label="包含图表"
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>
            取消
          </Button>
          <Button onClick={handleCreateExportTask} variant="contained">
            开始导出
          </Button>
        </DialogActions>
      </Dialog>

      {/* 导出任务列表对话框 */}
      <Dialog
        open={exportTasksDialogOpen}
        onClose={() => setExportTasksDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          导出任务
          <IconButton
            onClick={loadExportTasks}
            sx={{ float: 'right' }}
          >
            <RefreshIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {exportTasks.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              暂无导出任务
            </Typography>
          ) : (
            <List>
              {exportTasks.map((task) => (
                <ListItem key={task.id} divider>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">
                          {task.format.toUpperCase()} 报告
                        </Typography>
                        <Chip
                          label={getTaskStatusText(task.status)}
                          color={getTaskStatusColor(task.status) as any}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          创建时间: {task.createdAt.toLocaleString('zh-CN')}
                        </Typography>
                        {task.completedAt && (
                          <Typography variant="caption" display="block">
                            完成时间: {task.completedAt.toLocaleString('zh-CN')}
                          </Typography>
                        )}
                        {task.status === 'in_progress' && (
                          <LinearProgress
                            variant="determinate"
                            value={task.progress}
                            sx={{ mt: 1 }}
                          />
                        )}
                        {task.error && (
                          <Typography variant="caption" color="error" display="block">
                            错误: {task.error}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    {task.status === 'completed' && task.downloadUrl && (
                      <IconButton
                        edge="end"
                        onClick={() => handleDownloadFile(task)}
                      >
                        <DownloadIcon />
                      </IconButton>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportTasksDialogOpen(false)}>
            关闭
          </Button>
        </DialogActions>
      </Dialog>

      {/* 通知栏 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ClaimStatisticsPage;