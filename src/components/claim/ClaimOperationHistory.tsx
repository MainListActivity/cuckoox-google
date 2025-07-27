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
  Divider,
  SvgIcon
} from '@mui/material';
import {
  mdiChevronDown,
  mdiChevronUp,
  mdiEyeOutline,
  mdiRefresh,
  mdiFilterOutline,
  mdiClockOutline,
  mdiAccountOutline,
  mdiFileDocumentOutline,
  mdiAlertCircleOutline,
  mdiCheckCircleOutline,
  mdiCloseCircleOutline
} from '@mdi/js';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { zhCN } from 'date-fns/locale';
import { format } from 'date-fns';

import { ClaimOperationService } from '@/src/services/claimOperationService';
import { useSurreal } from '@/src/contexts/SurrealProvider';
import {
  ClaimOperationLog,
  OperationType,
  OperationResult,
  OperationLogQueryOptions
} from '@/src/types/claimTracking';
import { touchFriendlyIconButtonSx } from '@/src/utils/touchTargetUtils';

interface ClaimOperationHistoryProps {
  claimId: string;
  showFilters?: boolean;
  maxHeight?: number;
  onOperationClick?: (operation: ClaimOperationLog) => void;
}

interface FilterState {
  operationType?: OperationType;
  operationResult?: OperationResult;
  startDate?: Date;
  endDate?: Date;
  operatorName?: string;
}

const ClaimOperationHistory: React.FC<ClaimOperationHistoryProps> = ({
  claimId,
  showFilters = true,
  maxHeight = 600,
  onOperationClick
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { client } = useSurreal();
  
  const [operations, setOperations] = useState<ClaimOperationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<FilterState>({});
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<ClaimOperationLog | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const pageSize = 20;
  const operationService = new ClaimOperationService(client);

  // 操作类型映射
  const operationTypeLabels: Record<OperationType, string> = {
    [OperationType.CREATE]: '创建',
    [OperationType.UPDATE]: '更新',
    [OperationType.SUBMIT]: '提交',
    [OperationType.WITHDRAW]: '撤回',
    [OperationType.REVIEW]: '审核',
    [OperationType.APPROVE]: '通过',
    [OperationType.REJECT]: '驳回',
    [OperationType.SUPPLEMENT_REQUEST]: '补充要求',
    [OperationType.DELETE]: '删除',
    [OperationType.VIEW]: '查看'
  };

  // 操作结果映射
  const operationResultLabels: Record<OperationResult, string> = {
    [OperationResult.SUCCESS]: '成功',
    [OperationResult.FAILED]: '失败',
    [OperationResult.PARTIAL]: '部分成功'
  };

  // 获取操作类型颜色
  const getOperationTypeColor = (type: OperationType): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
    switch (type) {
      case OperationType.CREATE:
        return 'success';
      case OperationType.UPDATE:
        return 'info';
      case OperationType.SUBMIT:
        return 'primary';
      case OperationType.APPROVE:
        return 'success';
      case OperationType.REJECT:
        return 'error';
      case OperationType.DELETE:
        return 'error';
      case OperationType.WITHDRAW:
        return 'warning';
      default:
        return 'default';
    }
  };

  // 获取操作结果颜色和图标
  const getOperationResultDisplay = (result: OperationResult) => {
    switch (result) {
      case OperationResult.SUCCESS:
        return {
          color: 'success' as const,
          icon: mdiCheckCircleOutline,
          label: operationResultLabels[result]
        };
      case OperationResult.FAILED:
        return {
          color: 'error' as const,
          icon: mdiCloseCircleOutline,
          label: operationResultLabels[result]
        };
      case OperationResult.PARTIAL:
        return {
          color: 'warning' as const,
          icon: mdiAlertCircleOutline,
          label: operationResultLabels[result]
        };
      default:
        return {
          color: 'default' as const,
          icon: mdiAlertCircleOutline,
          label: '未知'
        };
    }
  };

  // 加载操作历史
  const loadOperations = useCallback(async () => {
    if (!claimId) return;

    setLoading(true);
    setError(null);

    try {
      const options: OperationLogQueryOptions = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
        operation_type: filters.operationType,
        operation_result: filters.operationResult,
        date_range: filters.startDate && filters.endDate ? {
          start: filters.startDate,
          end: filters.endDate
        } : undefined
      };

      const result = await operationService.getOperationHistory(claimId, options);
      setOperations(result);

      // 计算总页数（这里简化处理，实际应该从服务返回总数）
      const estimatedTotal = result.length === pageSize ? page * pageSize + 1 : (page - 1) * pageSize + result.length;
      setTotalPages(Math.ceil(estimatedTotal / pageSize));
    } catch (err) {
      console.error('加载操作历史失败:', err);
      setError('加载操作历史失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [claimId, page, filters, operationService, pageSize]);

  // 初始加载和依赖更新时重新加载
  useEffect(() => {
    loadOperations();
  }, [loadOperations]);

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

  // 处理行展开/收起
  const toggleRowExpansion = (operationId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(operationId)) {
      newExpanded.delete(operationId);
    } else {
      newExpanded.add(operationId);
    }
    setExpandedRows(newExpanded);
  };

  // 处理操作详情查看
  const handleViewDetails = (operation: ClaimOperationLog) => {
    setSelectedOperation(operation);
    setDetailDialogOpen(true);
    onOperationClick?.(operation);
  };

  // 格式化时间
  const formatTime = (timeStr: string) => {
    try {
      return format(new Date(timeStr), 'yyyy-MM-dd HH:mm:ss');
    } catch {
      return timeStr;
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
                  label="操作类型"
                  value={filters.operationType || ''}
                  onChange={(e) => handleFilterChange({ 
                    operationType: e.target.value as OperationType || undefined 
                  })}
                  size="small"
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="">全部</MenuItem>
                  {Object.entries(operationTypeLabels).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  label="操作结果"
                  value={filters.operationResult || ''}
                  onChange={(e) => handleFilterChange({ 
                    operationResult: e.target.value as OperationResult || undefined 
                  })}
                  size="small"
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="">全部</MenuItem>
                  {Object.entries(operationResultLabels).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  label="操作人"
                  value={filters.operatorName || ''}
                  onChange={(e) => handleFilterChange({ operatorName: e.target.value })}
                  size="small"
                  placeholder="输入操作人姓名"
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
                  onClick={loadOperations}
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
        {operations.map((operation) => (
          <Card key={operation.id} variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        label={operationTypeLabels[operation.operation_type]}
                        color={getOperationTypeColor(operation.operation_type)}
                        size="small"
                      />
                      <Chip
                        icon={<SvgIcon fontSize="small">
                          <path d={getOperationResultDisplay(operation.operation_result).icon} />
                        </SvgIcon>}
                        label={getOperationResultDisplay(operation.operation_result).label}
                        color={getOperationResultDisplay(operation.operation_result).color}
                        size="small"
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {operation.operation_description}
                    </Typography>
                  </Stack>
                  <IconButton
                    size="small"
                    onClick={() => handleViewDetails(operation)}
                    sx={touchFriendlyIconButtonSx}
                  >
                    <SvgIcon><path d={mdiEyeOutline} /></SvgIcon>
                  </IconButton>
                </Stack>

                <Stack direction="row" spacing={2} alignItems="center">
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <SvgIcon fontSize="small" color="action">
                      <path d={mdiAccountOutline} />
                    </SvgIcon>
                    <Typography variant="caption" color="text.secondary">
                      {operation.operator_name}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <SvgIcon fontSize="small" color="action">
                      <path d={mdiClockOutline} />
                    </SvgIcon>
                    <Typography variant="caption" color="text.secondary">
                      {formatTime(operation.operation_time)}
                    </Typography>
                  </Stack>
                </Stack>

                {operation.error_message && (
                  <Alert severity="error" size="small">
                    {operation.error_message}
                  </Alert>
                )}
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
              <TableCell width={40}></TableCell>
              <TableCell>操作类型</TableCell>
              <TableCell>操作描述</TableCell>
              <TableCell>操作人</TableCell>
              <TableCell>操作时间</TableCell>
              <TableCell>结果</TableCell>
              <TableCell width={100}>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {operations.map((operation) => (
              <React.Fragment key={operation.id}>
                <TableRow hover>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => toggleRowExpansion(operation.id as string)}
                    >
                      <SvgIcon>
                        <path d={expandedRows.has(operation.id as string) ? mdiChevronUp : mdiChevronDown} />
                      </SvgIcon>
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={operationTypeLabels[operation.operation_type]}
                      color={getOperationTypeColor(operation.operation_type)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{operation.operation_description}</TableCell>
                  <TableCell>{operation.operator_name}</TableCell>
                  <TableCell>{formatTime(operation.operation_time)}</TableCell>
                  <TableCell>
                    <Chip
                      icon={<SvgIcon fontSize="small">
                        <path d={getOperationResultDisplay(operation.operation_result).icon} />
                      </SvgIcon>}
                      label={getOperationResultDisplay(operation.operation_result).label}
                      color={getOperationResultDisplay(operation.operation_result).color}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="查看详情">
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetails(operation)}
                      >
                        <SvgIcon><path d={mdiEyeOutline} /></SvgIcon>
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 0 }}>
                    <Collapse in={expandedRows.has(operation.id as string)}>
                      <Box sx={{ py: 2 }}>
                        <Stack spacing={1}>
                          {operation.changed_fields && operation.changed_fields.length > 0 && (
                            <Typography variant="body2">
                              <strong>变更字段:</strong> {operation.changed_fields.join(', ')}
                            </Typography>
                          )}
                          {operation.ip_address && (
                            <Typography variant="body2" color="text.secondary">
                              <strong>IP地址:</strong> {operation.ip_address}
                            </Typography>
                          )}
                          {operation.error_message && (
                            <Alert severity="error" size="small">
                              {operation.error_message}
                            </Alert>
                          )}
                        </Stack>
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // 渲染操作详情对话框
  const renderDetailDialog = () => {
    if (!selectedOperation) return null;

    return (
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          操作详情 - {operationTypeLabels[selectedOperation.operation_type]}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            <Stack spacing={2}>
              <Typography variant="h6">基本信息</Typography>
              <Stack spacing={1}>
                <Typography variant="body2">
                  <strong>操作描述:</strong> {selectedOperation.operation_description}
                </Typography>
                <Typography variant="body2">
                  <strong>操作人:</strong> {selectedOperation.operator_name} ({selectedOperation.operator_role})
                </Typography>
                <Typography variant="body2">
                  <strong>操作时间:</strong> {formatTime(selectedOperation.operation_time)}
                </Typography>
                <Typography variant="body2">
                  <strong>操作结果:</strong> 
                  <Chip
                    icon={<SvgIcon fontSize="small">
                      <path d={getOperationResultDisplay(selectedOperation.operation_result).icon} />
                    </SvgIcon>}
                    label={getOperationResultDisplay(selectedOperation.operation_result).label}
                    color={getOperationResultDisplay(selectedOperation.operation_result).color}
                    size="small"
                    sx={{ ml: 1 }}
                  />
                </Typography>
                {selectedOperation.ip_address && (
                  <Typography variant="body2">
                    <strong>IP地址:</strong> {selectedOperation.ip_address}
                  </Typography>
                )}
              </Stack>
            </Stack>

            {selectedOperation.changed_fields && selectedOperation.changed_fields.length > 0 && (
              <Stack spacing={2}>
                <Typography variant="h6">变更字段</Typography>
                <Box>
                  {selectedOperation.changed_fields.map((field, index) => (
                    <Chip key={index} label={field} size="small" sx={{ mr: 1, mb: 1 }} />
                  ))}
                </Box>
              </Stack>
            )}

            {selectedOperation.before_data && (
              <Stack spacing={2}>
                <Typography variant="h6">变更前数据</Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <pre style={{ margin: 0, fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(selectedOperation.before_data, null, 2)}
                  </pre>
                </Paper>
              </Stack>
            )}

            {selectedOperation.after_data && (
              <Stack spacing={2}>
                <Typography variant="h6">变更后数据</Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <pre style={{ margin: 0, fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(selectedOperation.after_data, null, 2)}
                  </pre>
                </Paper>
              </Stack>
            )}

            {selectedOperation.error_message && (
              <Stack spacing={2}>
                <Typography variant="h6">错误信息</Typography>
                <Alert severity="error">
                  {selectedOperation.error_message}
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
          操作历史
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
            onClick={loadOperations}
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

        {!loading && !error && operations.length === 0 && (
          <Box display="flex" flexDirection="column" alignItems="center" py={4}>
            <SvgIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}>
              <path d={mdiFileDocumentOutline} />
            </SvgIcon>
            <Typography color="text.secondary">
              暂无操作记录
            </Typography>
          </Box>
        )}

        {!loading && !error && operations.length > 0 && (
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

export default ClaimOperationHistory;