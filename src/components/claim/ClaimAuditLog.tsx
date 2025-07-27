import React, { useState, useEffect, useCallback } from 'react';
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
  Tooltip,
  TextField,
  MenuItem,
  Stack,
  Pagination,
  CircularProgress,
  Alert,
  Collapse,
  useTheme,
  useMediaQuery,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  SvgIcon
} from '@mui/material';
import {
  mdiEyeOutline,
  mdiRefresh,
  mdiFilterOutline,
  mdiClockOutline,
  mdiAccountOutline,
  mdiShieldCheckOutline,
  mdiAlertCircleOutline,
  mdiCheckCircleOutline,
  mdiCloseCircleOutline,
  mdiDownloadOutline,
  mdiPrinterOutline,
  mdiFileExportOutline,
  mdiIpOutline,
  mdiTimer
} from '@mdi/js';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { zhCN } from 'date-fns/locale';
import { format } from 'date-fns';

import { ClaimAuditService } from '@/src/services/claimAuditService';
import { useSurreal } from '@/src/contexts/SurrealProvider';
import {
  ClaimAccessLog,
  AccessType,
  AccessResult,
  AuditLogQueryOptions
} from '@/src/types/claimTracking';
import { touchFriendlyIconButtonSx } from '@/src/utils/touchTargetUtils';

interface ClaimAuditLogProps {
  claimId?: string;
  userId?: string;
  showFilters?: boolean;
  maxHeight?: number;
  onAccessLogClick?: (accessLog: ClaimAccessLog) => void;
}

interface FilterState {
  accessType?: AccessType;
  accessResult?: AccessResult;
  startDate?: Date;
  endDate?: Date;
  accessorName?: string;
}

const ClaimAuditLog: React.FC<ClaimAuditLogProps> = ({
  claimId,
  userId,
  showFilters = true,
  maxHeight = 600,
  onAccessLogClick
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { client } = useSurreal();
  
  const [accessLogs, setAccessLogs] = useState<ClaimAccessLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<FilterState>({});
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [selectedAccessLog, setSelectedAccessLog] = useState<ClaimAccessLog | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const pageSize = 20;

  // 访问类型映射
  const accessTypeLabels: Record<AccessType, string> = {
    [AccessType.VIEW]: '查看',
    [AccessType.DOWNLOAD]: '下载',
    [AccessType.EXPORT]: '导出',
    [AccessType.PRINT]: '打印'
  };

  // 访问结果映射
  const accessResultLabels: Record<AccessResult, string> = {
    [AccessResult.SUCCESS]: '成功',
    [AccessResult.DENIED]: '拒绝',
    [AccessResult.ERROR]: '错误'
  };

  // 获取访问类型颜色和图标
  const getAccessTypeDisplay = (type: AccessType) => {
    switch (type) {
      case AccessType.VIEW:
        return {
          color: 'info' as const,
          icon: mdiEyeOutline,
          label: accessTypeLabels[type]
        };
      case AccessType.DOWNLOAD:
        return {
          color: 'primary' as const,
          icon: mdiDownloadOutline,
          label: accessTypeLabels[type]
        };
      case AccessType.EXPORT:
        return {
          color: 'warning' as const,
          icon: mdiFileExportOutline,
          label: accessTypeLabels[type]
        };
      case AccessType.PRINT:
        return {
          color: 'secondary' as const,
          icon: mdiPrinterOutline,
          label: accessTypeLabels[type]
        };
      default:
        return {
          color: 'default' as const,
          icon: mdiEyeOutline,
          label: '未知'
        };
    }
  };

  // 获取访问结果颜色和图标
  const getAccessResultDisplay = (result: AccessResult) => {
    switch (result) {
      case AccessResult.SUCCESS:
        return {
          color: 'success' as const,
          icon: mdiCheckCircleOutline,
          label: accessResultLabels[result]
        };
      case AccessResult.DENIED:
        return {
          color: 'error' as const,
          icon: mdiCloseCircleOutline,
          label: accessResultLabels[result]
        };
      case AccessResult.ERROR:
        return {
          color: 'warning' as const,
          icon: mdiAlertCircleOutline,
          label: accessResultLabels[result]
        };
      default:
        return {
          color: 'default' as const,
          icon: mdiAlertCircleOutline,
          label: '未知'
        };
    }
  };

  // 加载审计日志
  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const auditService = new ClaimAuditService(client);
      const options: AuditLogQueryOptions = {
        claim_id: claimId,
        user_id: userId,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        access_type: filters.accessType,
        access_result: filters.accessResult,
        date_range: filters.startDate && filters.endDate ? {
          start: filters.startDate,
          end: filters.endDate
        } : undefined
      };

      const result = await auditService.getAuditLog(options);
      setAccessLogs(result);

      // 计算总页数（这里简化处理，实际应该从服务返回总数）
      const estimatedTotal = result.length === pageSize ? page * pageSize + 1 : (page - 1) * pageSize + result.length;
      setTotalPages(Math.ceil(estimatedTotal / pageSize));
    } catch (err) {
      console.error('加载审计日志失败:', err);
      setError('加载审计日志失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [claimId, userId, page, filters, client, pageSize]);

  // 初始加载和依赖更新时重新加载
  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  // 处理筛选器变更
  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1); // 重置到第一页
  };

  // 清除筛选器
  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  // 处理访问日志详情查看
  const handleViewDetails = (accessLog: ClaimAccessLog) => {
    setSelectedAccessLog(accessLog);
    setDetailDialogOpen(true);
    onAccessLogClick?.(accessLog);
  };

  // 格式化时间
  const formatTime = (timeStr: string) => {
    try {
      return format(new Date(timeStr), 'yyyy-MM-dd HH:mm:ss');
    } catch {
      return timeStr;
    }
  };

  // 格式化访问时长
  const formatDuration = (durationStr?: string) => {
    if (!durationStr) return '-';
    
    try {
      // 解析ISO 8601 duration格式 (PT1H30M45S)
      const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!match) return durationStr;
      
      const hours = parseInt(match[1] || '0');
      const minutes = parseInt(match[2] || '0');
      const seconds = parseInt(match[3] || '0');
      
      if (hours > 0) {
        return `${hours}小时${minutes}分${seconds}秒`;
      } else if (minutes > 0) {
        return `${minutes}分${seconds}秒`;
      } else {
        return `${seconds}秒`;
      }
    } catch {
      return durationStr;
    }
  };

  // 渲染筛选器
  const renderFilters = () => {
    if (!showFilters) return null;

    return (
      <Collapse in={showFiltersPanel}>
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              筛选条件
            </Typography>
            <Stack spacing={2}>
              <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                <TextField
                  select
                  label="访问类型"
                  value={filters.accessType || ''}
                  onChange={(e) => handleFilterChange({ 
                    accessType: e.target.value as AccessType || undefined 
                  })}
                  size="small"
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="">全部</MenuItem>
                  {Object.entries(accessTypeLabels).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  label="访问结果"
                  value={filters.accessResult || ''}
                  onChange={(e) => handleFilterChange({ 
                    accessResult: e.target.value as AccessResult || undefined 
                  })}
                  size="small"
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="">全部</MenuItem>
                  {Object.entries(accessResultLabels).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  label="访问者"
                  value={filters.accessorName || ''}
                  onChange={(e) => handleFilterChange({ accessorName: e.target.value })}
                  size="small"
                  placeholder="输入访问者姓名"
                />
              </Stack>

              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhCN}>
                <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                  <DatePicker
                    label="开始日期"
                    value={filters.startDate || null}
                    onChange={(date) => handleFilterChange({ startDate: date || undefined })}
                    slotProps={{ textField: { size: 'small' } }}
                  />
                  <DatePicker
                    label="结束日期"
                    value={filters.endDate || null}
                    onChange={(date) => handleFilterChange({ endDate: date || undefined })}
                    slotProps={{ textField: { size: 'small' } }}
                  />
                </Stack>
              </LocalizationProvider>

              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={clearFilters}
                >
                  清除筛选
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={loadAuditLogs}
                  startIcon={<SvgIcon><path d={mdiRefresh} /></SvgIcon>}
                >
                  刷新
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Collapse>
    );
  };

  // 渲染移动端卡片视图
  const renderMobileView = () => {
    return (
      <Stack spacing={2}>
        {accessLogs.map((accessLog) => (
          <Card key={accessLog.id} variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        icon={<SvgIcon fontSize="small">
                          <path d={getAccessTypeDisplay(accessLog.access_type).icon} />
                        </SvgIcon>}
                        label={getAccessTypeDisplay(accessLog.access_type).label}
                        color={getAccessTypeDisplay(accessLog.access_type).color}
                        size="small"
                      />
                      <Chip
                        icon={<SvgIcon fontSize="small">
                          <path d={getAccessResultDisplay(accessLog.access_result).icon} />
                        </SvgIcon>}
                        label={getAccessResultDisplay(accessLog.access_result).label}
                        color={getAccessResultDisplay(accessLog.access_result).color}
                        size="small"
                      />
                    </Stack>
                    {accessLog.denial_reason && (
                      <Typography variant="body2" color="error.main">
                        拒绝原因: {accessLog.denial_reason}
                      </Typography>
                    )}
                  </Stack>
                  <IconButton
                    size="small"
                    onClick={() => handleViewDetails(accessLog)}
                    sx={touchFriendlyIconButtonSx}
                  >
                    <SvgIcon><path d={mdiEyeOutline} /></SvgIcon>
                  </IconButton>
                </Stack>

                <Stack spacing={1}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <SvgIcon fontSize="small" color="action">
                        <path d={mdiAccountOutline} />
                      </SvgIcon>
                      <Typography variant="caption" color="text.secondary">
                        {accessLog.accessor_name}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <SvgIcon fontSize="small" color="action">
                        <path d={mdiClockOutline} />
                      </SvgIcon>
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(accessLog.access_time)}
                      </Typography>
                    </Stack>
                  </Stack>

                  {accessLog.access_duration && (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <SvgIcon fontSize="small" color="action">
                        <path d={mdiTimer} />
                      </SvgIcon>
                      <Typography variant="caption" color="text.secondary">
                        访问时长: {formatDuration(accessLog.access_duration)}
                      </Typography>
                    </Stack>
                  )}

                  {accessLog.ip_address && (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <SvgIcon fontSize="small" color="action">
                        <path d={mdiIpOutline} />
                      </SvgIcon>
                      <Typography variant="caption" color="text.secondary">
                        IP: {accessLog.ip_address}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    );
  };

  // 渲染桌面端表格视图
  const renderDesktopView = () => {
    return (
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>访问类型</TableCell>
              <TableCell>访问者</TableCell>
              <TableCell>角色</TableCell>
              <TableCell>访问时间</TableCell>
              <TableCell>访问时长</TableCell>
              <TableCell>结果</TableCell>
              <TableCell>IP地址</TableCell>
              <TableCell width={100}>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accessLogs.map((accessLog) => (
              <TableRow key={accessLog.id} hover>
                <TableCell>
                  <Chip
                    icon={<SvgIcon fontSize="small">
                      <path d={getAccessTypeDisplay(accessLog.access_type).icon} />
                    </SvgIcon>}
                    label={getAccessTypeDisplay(accessLog.access_type).label}
                    color={getAccessTypeDisplay(accessLog.access_type).color}
                    size="small"
                  />
                </TableCell>
                <TableCell>{accessLog.accessor_name}</TableCell>
                <TableCell>{accessLog.accessor_role}</TableCell>
                <TableCell>{formatTime(accessLog.access_time)}</TableCell>
                <TableCell>{formatDuration(accessLog.access_duration)}</TableCell>
                <TableCell>
                  <Chip
                    icon={<SvgIcon fontSize="small">
                      <path d={getAccessResultDisplay(accessLog.access_result).icon} />
                    </SvgIcon>}
                    label={getAccessResultDisplay(accessLog.access_result).label}
                    color={getAccessResultDisplay(accessLog.access_result).color}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {accessLog.ip_address || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Tooltip title="查看详情">
                    <IconButton
                      size="small"
                      onClick={() => handleViewDetails(accessLog)}
                    >
                      <SvgIcon><path d={mdiEyeOutline} /></SvgIcon>
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // 渲染访问详情对话框
  const renderDetailDialog = () => {
    if (!selectedAccessLog) return null;

    return (
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          访问详情 - {getAccessTypeDisplay(selectedAccessLog.access_type).label}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            <Stack spacing={2}>
              <Typography variant="h6">基本信息</Typography>
              <Stack spacing={1}>
                <Typography variant="body2">
                  <strong>访问类型:</strong> 
                  <Chip
                    icon={<SvgIcon fontSize="small">
                      <path d={getAccessTypeDisplay(selectedAccessLog.access_type).icon} />
                    </SvgIcon>}
                    label={getAccessTypeDisplay(selectedAccessLog.access_type).label}
                    color={getAccessTypeDisplay(selectedAccessLog.access_type).color}
                    size="small"
                    sx={{ ml: 1 }}
                  />
                </Typography>
                <Typography variant="body2">
                  <strong>访问者:</strong> {selectedAccessLog.accessor_name} ({selectedAccessLog.accessor_role})
                </Typography>
                <Typography variant="body2">
                  <strong>访问时间:</strong> {formatTime(selectedAccessLog.access_time)}
                </Typography>
                <Typography variant="body2">
                  <strong>访问结果:</strong> 
                  <Chip
                    icon={<SvgIcon fontSize="small">
                      <path d={getAccessResultDisplay(selectedAccessLog.access_result).icon} />
                    </SvgIcon>}
                    label={getAccessResultDisplay(selectedAccessLog.access_result).label}
                    color={getAccessResultDisplay(selectedAccessLog.access_result).color}
                    size="small"
                    sx={{ ml: 1 }}
                  />
                </Typography>
                {selectedAccessLog.access_duration && (
                  <Typography variant="body2">
                    <strong>访问时长:</strong> {formatDuration(selectedAccessLog.access_duration)}
                  </Typography>
                )}
              </Stack>
            </Stack>

            <Stack spacing={2}>
              <Typography variant="h6">技术信息</Typography>
              <Stack spacing={1}>
                {selectedAccessLog.ip_address && (
                  <Typography variant="body2">
                    <strong>IP地址:</strong> {selectedAccessLog.ip_address}
                  </Typography>
                )}
                {selectedAccessLog.user_agent && (
                  <Typography variant="body2">
                    <strong>用户代理:</strong> 
                    <Paper variant="outlined" sx={{ p: 1, mt: 0.5, bgcolor: 'grey.50' }}>
                      <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                        {selectedAccessLog.user_agent}
                      </Typography>
                    </Paper>
                  </Typography>
                )}
              </Stack>
            </Stack>

            {selectedAccessLog.accessed_fields && selectedAccessLog.accessed_fields.length > 0 && (
              <Stack spacing={2}>
                <Typography variant="h6">访问字段</Typography>
                <Box>
                  {selectedAccessLog.accessed_fields.map((field, index) => (
                    <Chip key={index} label={field} size="small" sx={{ mr: 1, mb: 1 }} />
                  ))}
                </Box>
              </Stack>
            )}

            {selectedAccessLog.denial_reason && (
              <Stack spacing={2}>
                <Typography variant="h6">拒绝原因</Typography>
                <Alert severity="error">
                  {selectedAccessLog.denial_reason}
                </Alert>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>
            关闭
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Box>
      {/* 标题和操作栏 */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">
          <SvgIcon sx={{ mr: 1, verticalAlign: 'middle' }}>
            <path d={mdiShieldCheckOutline} />
          </SvgIcon>
          审计日志
        </Typography>
        <Stack direction="row" spacing={1}>
          {showFilters && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<SvgIcon><path d={mdiFilterOutline} /></SvgIcon>}
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            >
              筛选
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            startIcon={<SvgIcon><path d={mdiRefresh} /></SvgIcon>}
            onClick={loadAuditLogs}
            disabled={loading}
          >
            刷新
          </Button>
        </Stack>
      </Stack>

      {/* 筛选器 */}
      {renderFilters()}

      {/* 内容区域 */}
      <Box sx={{ maxHeight, overflow: 'auto' }}>
        {loading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && accessLogs.length === 0 && (
          <Box display="flex" flexDirection="column" alignItems="center" py={4}>
            <SvgIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}>
              <path d={mdiShieldCheckOutline} />
            </SvgIcon>
            <Typography color="text.secondary">
              暂无审计记录
            </Typography>
          </Box>
        )}

        {!loading && !error && accessLogs.length > 0 && (
          <>
            {isMobile ? renderMobileView() : renderDesktopView()}
            
            {/* 分页 */}
            {totalPages > 1 && (
              <Box display="flex" justifyContent="center" mt={2}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, newPage) => setPage(newPage)}
                  color="primary"
                  size={isMobile ? 'small' : 'medium'}
                />
              </Box>
            )}
          </>
        )}
      </Box>

      {/* 详情对话框 */}
      {renderDetailDialog()}
    </Box>
  );
};

export default ClaimAuditLog;