/**
 * 债权追踪审计监控组件
 * 展示审计日志、异常检测结果和安全统计
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Alert,
  AlertTitle,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  LinearProgress,
  Tooltip,
  Badge,
  Stack,
  Tabs,
  Tab,
  Divider
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Security as SecurityIcon,
  Assessment as AssessmentIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  Schedule as ScheduleIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { RecordId } from 'surrealdb';

import { 
  claimTrackingAuditService,
  type AuditEvent,
  type AuditStatistics,
  type AnomalyDetectionResult,
  AuditEventType,
  RiskLevel
} from '../../services/claimTrackingAuditService';
import { useSurrealClient } from '../../contexts/SurrealProvider';
import { useAuth } from '../../contexts/AuthContext';

interface ClaimAuditMonitorProps {
  caseId?: RecordId | string;
  claimId?: RecordId | string;
  height?: number;
}

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
      id={`audit-tabpanel-${index}`}
      aria-labelledby={`audit-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

export const ClaimAuditMonitor: React.FC<ClaimAuditMonitorProps> = ({
  caseId,
  _claimId,
  height = 600
}) => {
  const client = useSurrealClient();
  const { user } = useAuth();
  
  const [currentTab, setCurrentTab] = useState(0);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [statistics, setStatistics] = useState<AuditStatistics | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyDetectionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 筛选状态
  const [filters, setFilters] = useState({
    eventType: '' as AuditEventType | '',
    riskLevel: '' as RiskLevel | '',
    userId: '',
    startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 默认7天前
    endTime: new Date()
  });
  
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // 初始化服务
  useEffect(() => {
    if (client) {
      claimTrackingAuditService.setClientGetter(client);
    }
  }, [client]);

  /**
   * 加载审计数据
   */
  const loadAuditData = useCallback(async () => {
    if (!client || !user) return;

    setLoading(true);
    setError(null);

    try {
      // 并行加载数据
      const [eventsResult, statsResult] = await Promise.all([
        claimTrackingAuditService.queryAuditEvents({
          caseId,
          eventType: filters.eventType || undefined,
          riskLevel: filters.riskLevel || undefined,
          userId: filters.userId || undefined,
          startTime: filters.startTime,
          endTime: filters.endTime,
          limit: 100
        }),
        claimTrackingAuditService.getAuditStatistics({
          caseId,
          startTime: filters.startTime,
          endTime: filters.endTime
        })
      ]);

      setAuditEvents(eventsResult);
      setStatistics(statsResult);

      // 模拟异常检测结果（实际项目中从数据库查询）
      setAnomalies([]);

    } catch (err) {
      console.error('Failed to load audit data:', err);
      setError(err instanceof Error ? err.message : '加载审计数据失败');
    } finally {
      setLoading(false);
    }
  }, [client, user, caseId, filters]);

  // 初始加载
  useEffect(() => {
    loadAuditData();
  }, [loadAuditData]);

  /**
   * 获取事件类型显示名称
   */
  const getEventTypeLabel = (eventType: AuditEventType): string => {
    const labels = {
      [AuditEventType.LOGIN]: '登录',
      [AuditEventType.LOGOUT]: '登出',
      [AuditEventType.ACCESS]: '访问',
      [AuditEventType.OPERATION]: '操作',
      [AuditEventType.PERMISSION_DENIED]: '权限拒绝',
      [AuditEventType.DATA_EXPORT]: '数据导出',
      [AuditEventType.SENSITIVE_ACCESS]: '敏感访问',
      [AuditEventType.BULK_OPERATION]: '批量操作',
      [AuditEventType.SYSTEM_ERROR]: '系统错误'
    };
    return labels[eventType] || eventType;
  };

  /**
   * 获取风险级别颜色
   */
  const getRiskLevelColor = (riskLevel: RiskLevel): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    const colors = {
      [RiskLevel.LOW]: 'success' as const,
      [RiskLevel.MEDIUM]: 'warning' as const,
      [RiskLevel.HIGH]: 'error' as const,
      [RiskLevel.CRITICAL]: 'error' as const
    };
    return colors[riskLevel] || 'default';
  };

  /**
   * 获取风险级别显示名称
   */
  const getRiskLevelLabel = (riskLevel: RiskLevel): string => {
    const labels = {
      [RiskLevel.LOW]: '低',
      [RiskLevel.MEDIUM]: '中',
      [RiskLevel.HIGH]: '高',
      [RiskLevel.CRITICAL]: '严重'
    };
    return labels[riskLevel] || riskLevel;
  };

  /**
   * 获取结果状态颜色
   */
  const getResultColor = (result: 'success' | 'failure' | 'denied'): 'success' | 'error' | 'warning' => {
    const colors = {
      success: 'success' as const,
      failure: 'error' as const,
      denied: 'warning' as const
    };
    return colors[result] || 'error';
  };

  /**
   * 处理事件详情查看
   */
  const handleViewEventDetail = (event: AuditEvent) => {
    setSelectedEvent(event);
    setDetailDialogOpen(true);
  };

  /**
   * 导出审计报告
   */
  const handleExportReport = async () => {
    try {
      setLoading(true);
      const report = await claimTrackingAuditService.exportAuditReport({
        startTime: filters.startTime,
        endTime: filters.endTime,
        caseId,
        includeStatistics: true
      });

      // 创建下载链接
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-report-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      setError(err instanceof Error ? err.message : '导出报告失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 计算统计图表数据
   */
  const _statisticsChartData = useMemo(() => {
    if (!statistics) return null;

    const eventTypeData = Object.entries(statistics.events_by_type).map(([type, count]) => ({
      name: getEventTypeLabel(type as AuditEventType),
      value: count
    }));

    const riskLevelData = Object.entries(statistics.events_by_risk).map(([level, count]) => ({
      name: getRiskLevelLabel(level as RiskLevel),
      value: count,
      color: getRiskLevelColor(level as RiskLevel)
    }));

    return { eventTypeData, riskLevelData };
  }, [statistics]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhCN}>
      <Card sx={{ height, display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', pb: 1 }}>
          {/* 头部控制区 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon />
              审计监控
              {statistics && (
                <Badge badgeContent={statistics.total_events} max={9999} color="primary">
                  <AssessmentIcon />
                </Badge>
              )}
            </Typography>
            
            <Stack direction="row" spacing={1}>
              <Tooltip title="导出报告">
                <IconButton onClick={handleExportReport} disabled={loading}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="刷新数据">
                <IconButton onClick={loadAuditData} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          {/* 筛选器 */}
          <Box sx={{ mb: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>事件类型</InputLabel>
                  <Select
                    value={filters.eventType}
                    label="事件类型"
                    onChange={(e) => setFilters(prev => ({ ...prev, eventType: e.target.value as AuditEventType }))}
                  >
                    <MenuItem value="">全部</MenuItem>
                    {Object.values(AuditEventType).map(type => (
                      <MenuItem key={type} value={type}>
                        {getEventTypeLabel(type)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>风险级别</InputLabel>
                  <Select
                    value={filters.riskLevel}
                    label="风险级别"
                    onChange={(e) => setFilters(prev => ({ ...prev, riskLevel: e.target.value as RiskLevel }))}
                  >
                    <MenuItem value="">全部</MenuItem>
                    {Object.values(RiskLevel).map(level => (
                      <MenuItem key={level} value={level}>
                        {getRiskLevelLabel(level)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={2}>
                <DateTimePicker
                  label="开始时间"
                  value={filters.startTime}
                  onChange={(date) => date && setFilters(prev => ({ ...prev, startTime: date }))}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Grid>

              <Grid item xs={12} sm={2}>
                <DateTimePicker
                  label="结束时间"
                  value={filters.endTime}
                  onChange={(date) => date && setFilters(prev => ({ ...prev, endTime: date }))}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Grid>

              <Grid item xs={12} sm={2}>
                <Button
                  variant="outlined"
                  startIcon={<FilterIcon />}
                  onClick={loadAuditData}
                  disabled={loading}
                  fullWidth
                >
                  筛选
                </Button>
              </Grid>
            </Grid>
          </Box>

          {loading && <LinearProgress sx={{ mb: 2 }} />}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <AlertTitle>加载失败</AlertTitle>
              {error}
            </Alert>
          )}

          {/* 标签页 */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
              <Tab label="审计事件" />
              <Tab label="统计概览" />
              <Tab 
                label={
                  <Badge badgeContent={anomalies.length} color="error" max={99}>
                    异常检测
                  </Badge>
                } 
              />
            </Tabs>
          </Box>

          {/* 内容区 */}
          <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
            <TabPanel value={currentTab} index={0}>
              <TableContainer component={Paper} sx={{ maxHeight: height - 300 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>时间</TableCell>
                      <TableCell>事件类型</TableCell>
                      <TableCell>用户</TableCell>
                      <TableCell>资源</TableCell>
                      <TableCell>操作</TableCell>
                      <TableCell>结果</TableCell>
                      <TableCell>风险级别</TableCell>
                      <TableCell>IP地址</TableCell>
                      <TableCell>操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {auditEvents.map((event) => (
                      <TableRow key={event.id?.toString() || Math.random()}>
                        <TableCell>
                          <Tooltip title={format(event.created_at, 'yyyy-MM-dd HH:mm:ss')}>
                            <Typography variant="caption">
                              {formatDistanceToNow(event.created_at, { locale: zhCN, addSuffix: true })}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getEventTypeLabel(event.event_type)}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {String(event.user_id).replace('user:', '')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {event.resource_type}
                            {event.resource_id && `:${event.resource_id}`}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{event.action}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={event.result}
                            size="small"
                            color={getResultColor(event.result)}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getRiskLevelLabel(event.risk_level)}
                            size="small"
                            color={getRiskLevelColor(event.risk_level)}
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title={event.user_agent || 'Unknown'}>
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <LocationIcon fontSize="small" />
                              {event.ip_address}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleViewEventDetail(event)}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>

            <TabPanel value={currentTab} index={1}>
              {statistics && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          总体统计
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography>总事件数:</Typography>
                            <Typography fontWeight="bold">{statistics.total_events}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography>独立用户:</Typography>
                            <Typography fontWeight="bold">{statistics.unique_users}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography>失败操作:</Typography>
                            <Typography fontWeight="bold" color="error.main">
                              {statistics.failed_operations}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography>权限拒绝:</Typography>
                            <Typography fontWeight="bold" color="warning.main">
                              {statistics.permission_denials}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography>平均处理时间:</Typography>
                            <Typography fontWeight="bold">
                              {statistics.avg_processing_time.toFixed(2)}ms
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          事件类型分布
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {Object.entries(statistics.events_by_type).map(([type, count]) => (
                            <Box key={type} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography>{getEventTypeLabel(type as AuditEventType)}:</Typography>
                              <Typography fontWeight="bold">{count}</Typography>
                            </Box>
                          ))}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          风险级别分布
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {Object.entries(statistics.events_by_risk).map(([level, count]) => (
                            <Box key={level} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography>{getRiskLevelLabel(level as RiskLevel)}:</Typography>
                              <Typography 
                                fontWeight="bold" 
                                color={`${getRiskLevelColor(level as RiskLevel)}.main`}
                              >
                                {count}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
            </TabPanel>

            <TabPanel value={currentTab} index={2}>
              {anomalies.length === 0 ? (
                <Alert severity="success">
                  <AlertTitle>未发现异常</AlertTitle>
                  在指定时间范围内未检测到异常活动。
                </Alert>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {anomalies.map((anomaly, index) => (
                    <Alert
                      key={index}
                      severity={anomaly.risk_level === RiskLevel.CRITICAL ? 'error' : 
                              anomaly.risk_level === RiskLevel.HIGH ? 'warning' : 'info'}
                      sx={{ '& .MuiAlert-message': { width: '100%' } }}
                    >
                      <AlertTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {anomaly.rule_name}
                        <Chip 
                          label={`评分: ${anomaly.score}`} 
                          size="small" 
                          color={getRiskLevelColor(anomaly.risk_level)}
                        />
                      </AlertTitle>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {anomaly.description}
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ScheduleIcon fontSize="small" />
                        {format(anomaly.triggered_at, 'yyyy-MM-dd HH:mm:ss')}
                        <Divider orientation="vertical" flexItem />
                        用户: {String(anomaly.user_id).replace('user:', '')}
                        <Divider orientation="vertical" flexItem />
                        事件数: {anomaly.event_count}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                        建议操作: {anomaly.recommended_action}
                      </Typography>
                    </Alert>
                  ))}
                </Box>
              )}
            </TabPanel>
          </Box>
        </CardContent>

        {/* 事件详情对话框 */}
        <Dialog
          open={detailDialogOpen}
          onClose={() => setDetailDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            审计事件详情
          </DialogTitle>
          <DialogContent dividers>
            {selectedEvent && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">事件ID:</Typography>
                    <Typography variant="body2">{selectedEvent.id?.toString()}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">事件类型:</Typography>
                    <Typography variant="body2">{getEventTypeLabel(selectedEvent.event_type)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">用户ID:</Typography>
                    <Typography variant="body2">{String(selectedEvent.user_id)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">时间:</Typography>
                    <Typography variant="body2">
                      {format(selectedEvent.created_at, 'yyyy-MM-dd HH:mm:ss')}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">资源类型:</Typography>
                    <Typography variant="body2">{selectedEvent.resource_type}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">资源ID:</Typography>
                    <Typography variant="body2">{selectedEvent.resource_id || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">操作:</Typography>
                    <Typography variant="body2">{selectedEvent.action}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">结果:</Typography>
                    <Chip
                      label={selectedEvent.result}
                      size="small"
                      color={getResultColor(selectedEvent.result)}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">风险级别:</Typography>
                    <Chip
                      label={getRiskLevelLabel(selectedEvent.risk_level)}
                      size="small"
                      color={getRiskLevelColor(selectedEvent.risk_level)}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">IP地址:</Typography>
                    <Typography variant="body2">{selectedEvent.ip_address}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2">用户代理:</Typography>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {selectedEvent.user_agent}
                    </Typography>
                  </Grid>
                  {selectedEvent.error_message && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="error">错误信息:</Typography>
                      <Typography variant="body2" color="error">
                        {selectedEvent.error_message}
                      </Typography>
                    </Grid>
                  )}
                  {selectedEvent.additional_data && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2">附加数据:</Typography>
                      <Paper sx={{ p: 1, backgroundColor: 'grey.50' }}>
                        <pre style={{ fontSize: '12px', margin: 0, overflow: 'auto' }}>
                          {JSON.stringify(selectedEvent.additional_data, null, 2)}
                        </pre>
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailDialogOpen(false)}>
              关闭
            </Button>
          </DialogActions>
        </Dialog>
      </Card>
    </LocalizationProvider>
  );
};

export default ClaimAuditMonitor;