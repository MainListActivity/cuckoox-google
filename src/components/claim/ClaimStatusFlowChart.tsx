import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
  SvgIcon,
  Paper,
  Divider
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,} from '@mui/lab';
import {
  mdiCheckCircleOutline,
  mdiCloseCircleOutline,
  mdiClockOutline,
  mdiArrowRightBoldOutline,
  mdiEyeOutline,
  mdiAccountOutline,
  mdiCalendarClockOutline,
  mdiCommentTextOutline,
  mdiInformationOutline,
  mdiTimelineClockOutline,
  mdiRefresh
} from '@mdi/js';
import { format, formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { ClaimStatusFlowService } from '@/src/services/claimStatusFlowService';
import { useSurreal } from '@/src/contexts/SurrealProvider';
import {
  ClaimStatusFlow,
  TransitionType
} from '@/src/types/claimTracking';

interface ClaimStatusFlowChartProps {
  claimId: string;
  interactive?: boolean;
  showTimeline?: boolean;
  maxHeight?: number;
  onRefresh?: () => void;
}

interface StatusFlowDetail {
  flow: ClaimStatusFlow;
  statusName: string;
  fromStatusName?: string;
}

const ClaimStatusFlowChart: React.FC<ClaimStatusFlowChartProps> = ({
  claimId,
  interactive = false,
  showTimeline = true,
  maxHeight = 600,
  onRefresh
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { client } = useSurreal();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFlows, setStatusFlows] = useState<StatusFlowDetail[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<StatusFlowDetail | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const statusFlowService = new ClaimStatusFlowService(client);

  // 状态流转类型映射
  const transitionTypeLabels: Record<TransitionType, string> = {
    [TransitionType.USER_ACTION]: '用户操作',
    [TransitionType.SYSTEM_ACTION]: '系统操作',
    [TransitionType.ADMIN_ACTION]: '管理员操作',
    [TransitionType.AUTO_TRANSITION]: '自动流转'
  };

  // 获取流转类型颜色
  const getTransitionTypeColor = (type: TransitionType): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
    switch (type) {
      case TransitionType.USER_ACTION:
        return 'primary';
      case TransitionType.SYSTEM_ACTION:
        return 'info';
      case TransitionType.ADMIN_ACTION:
        return 'warning';
      case TransitionType.AUTO_TRANSITION:
        return 'success';
      default:
        return 'default';
    }
  };

  // 获取状态流转图标
  const getTransitionIcon = (type: TransitionType) => {
    switch (type) {
      case TransitionType.USER_ACTION:
        return mdiAccountOutline;
      case TransitionType.SYSTEM_ACTION:
        return mdiTimelineClockOutline;
      case TransitionType.ADMIN_ACTION:
        return mdiCheckCircleOutline;
      case TransitionType.AUTO_TRANSITION:
        return mdiArrowRightBoldOutline;
      default:
        return mdiInformationOutline;
    }
  };

  // 加载状态流转历史
  const loadStatusFlows = async () => {
    if (!claimId) return;

    setLoading(true);
    setError(null);

    try {
      const flows = await statusFlowService.getStatusFlowHistory(claimId);
      
      // 转换数据，添加状态名称
      const flowsWithNames: StatusFlowDetail[] = flows.map(flow => ({
        flow,
        statusName: getStatusName(flow.to_status),
        fromStatusName: flow.from_status ? getStatusName(flow.from_status) : undefined
      }));

      setStatusFlows(flowsWithNames);
    } catch (err) {
      console.error('加载状态流转历史失败:', err);
      setError('加载状态流转历史失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取状态名称（简化处理，实际应该从状态定义中获取）
  const getStatusName = (statusId: string | any): string => {
    if (typeof statusId === 'string') {
      // 从ID中提取状态名称
      const parts = statusId.split(':');
      return parts[parts.length - 1] || statusId;
    }
    return String(statusId);
  };

  // 初始加载
  useEffect(() => {
    loadStatusFlows();
  }, [claimId]);

  // 处理刷新
  const handleRefresh = () => {
    loadStatusFlows();
    onRefresh?.();
  };

  // 处理查看详情
  const handleViewDetails = (flowDetail: StatusFlowDetail) => {
    if (!interactive) return;
    
    setSelectedFlow(flowDetail);
    setDetailDialogOpen(true);
  };

  // 格式化时间
  const formatTime = (timeStr: string) => {
    try {
      return format(new Date(timeStr), 'yyyy-MM-dd HH:mm:ss');
    } catch {
      return timeStr;
    }
  };

  // 格式化相对时间
  const formatRelativeTime = (timeStr: string) => {
    try {
      return formatDistanceToNow(new Date(timeStr), { 
        addSuffix: true, 
        locale: zhCN 
      });
    } catch {
      return timeStr;
    }
  };

  // 格式化持续时间
  const formatDuration = (duration?: string) => {
    if (!duration) return '未知';
    
    try {
      // 简化处理ISO 8601持续时间格式
      const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
      if (match) {
        const hours = match[1] ? parseInt(match[1]) : 0;
        const minutes = match[2] ? parseInt(match[2]) : 0;
        const seconds = match[3] ? parseInt(match[3]) : 0;
        
        if (hours > 0) {
          return `${hours}小时${minutes}分钟`;
        } else if (minutes > 0) {
          return `${minutes}分钟${seconds}秒`;
        } else {
          return `${seconds}秒`;
        }
      }
    } catch {
      // 忽略解析错误
    }
    
    return duration;
  };

  // 渲染时间轴项目
  const renderTimelineItem = (flowDetail: StatusFlowDetail, index: number) => {
    const { flow, statusName, fromStatusName } = flowDetail;
    const isLast = index === statusFlows.length - 1;

    return (
      <TimelineItem key={flow.id || index}>
        {!isMobile && (
          <TimelineOppositeContent sx={{ m: 'auto 0' }} variant="body2" color="text.secondary">
            <Stack spacing={0.5} alignItems="flex-end">
              <Typography variant="caption">
                {formatTime(flow.transition_time)}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                {formatRelativeTime(flow.transition_time)}
              </Typography>
            </Stack>
          </TimelineOppositeContent>
        )}
        
        <TimelineSeparator>
          <TimelineDot 
            color={getTransitionTypeColor(flow.transition_type)}
            variant={isLast ? 'filled' : 'outlined'}
          >
            <SvgIcon fontSize="small">
              <path d={getTransitionIcon(flow.transition_type)} />
            </SvgIcon>
          </TimelineDot>
          {!isLast && <TimelineConnector />}
        </TimelineSeparator>
        
        <TimelineContent sx={{ py: '12px', px: 2 }}>
          <Card 
            variant="outlined" 
            sx={{ 
              cursor: interactive ? 'pointer' : 'default',
              '&:hover': interactive ? { 
                boxShadow: theme.shadows[2],
                borderColor: theme.palette.primary.main 
              } : {}
            }}
            onClick={() => handleViewDetails(flowDetail)}
          >
            <CardContent sx={{ pb: '16px !important' }}>
              <Stack spacing={2}>
                {/* 状态变更信息 */}
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      {fromStatusName && (
                        <>
                          <Chip label={fromStatusName} size="small" variant="outlined" />
                          <SvgIcon fontSize="small" color="action">
                            <path d={mdiArrowRightBoldOutline} />
                          </SvgIcon>
                        </>
                      )}
                      <Chip 
                        label={statusName} 
                        size="small" 
                        color="primary"
                        variant={isLast ? 'filled' : 'outlined'}
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {flow.trigger_reason}
                    </Typography>
                  </Stack>
                  
                  {interactive && (
                    <Tooltip title="查看详情">
                      <IconButton size="small">
                        <SvgIcon fontSize="small">
                          <path d={mdiEyeOutline} />
                        </SvgIcon>
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>

                {/* 操作信息 */}
                <Stack direction={isMobile ? 'column' : 'row'} spacing={2} alignItems="flex-start">
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <SvgIcon fontSize="small" color="action">
                      <path d={mdiAccountOutline} />
                    </SvgIcon>
                    <Typography variant="caption" color="text.secondary">
                      {flow.operator_role}
                    </Typography>
                  </Stack>
                  
                  <Chip
                    label={transitionTypeLabels[flow.transition_type]}
                    size="small"
                    color={getTransitionTypeColor(flow.transition_type)}
                    variant="outlined"
                  />
                  
                  {flow.duration_in_previous_status && (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <SvgIcon fontSize="small" color="action">
                        <path d={mdiClockOutline} />
                      </SvgIcon>
                      <Typography variant="caption" color="text.secondary">
                        停留 {formatDuration(flow.duration_in_previous_status)}
                      </Typography>
                    </Stack>
                  )}
                </Stack>

                {/* 备注信息 */}
                {(flow.transition_notes || flow.review_comments) && (
                  <Box>
                    {flow.transition_notes && (
                      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                        <SvgIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }}>
                          <path d={mdiCommentTextOutline} />
                        </SvgIcon>
                        {flow.transition_notes}
                      </Typography>
                    )}
                    {flow.review_comments && (
                      <Typography variant="body2" color="warning.main" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                        <strong>审核意见:</strong> {flow.review_comments}
                      </Typography>
                    )}
                  </Box>
                )}

                {/* 移动端时间显示 */}
                {isMobile && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <SvgIcon fontSize="small" color="action">
                      <path d={mdiCalendarClockOutline} />
                    </SvgIcon>
                    <Typography variant="caption" color="text.secondary">
                      {formatTime(flow.transition_time)}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      ({formatRelativeTime(flow.transition_time)})
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>
        </TimelineContent>
      </TimelineItem>
    );
  };

  // 渲染详情对话框
  const renderDetailDialog = () => {
    if (!selectedFlow) return null;

    const { flow, statusName, fromStatusName } = selectedFlow;

    return (
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          状态流转详情
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            {/* 状态变更信息 */}
            <Box>
              <Typography variant="h6" gutterBottom>
                状态变更
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                {fromStatusName && (
                  <>
                    <Chip label={fromStatusName} variant="outlined" />
                    <SvgIcon color="action">
                      <path d={mdiArrowRightBoldOutline} />
                    </SvgIcon>
                  </>
                )}
                <Chip label={statusName} color="primary" />
              </Stack>
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>变更原因:</strong> {flow.trigger_reason}
              </Typography>
            </Box>

            <Divider />

            {/* 操作信息 */}
            <Box>
              <Typography variant="h6" gutterBottom>
                操作信息
              </Typography>
              <Stack spacing={2}>
                <Typography variant="body2">
                  <strong>操作人角色:</strong> {flow.operator_role}
                </Typography>
                <Typography variant="body2">
                  <strong>操作类型:</strong> 
                  <Chip
                    label={transitionTypeLabels[flow.transition_type]}
                    size="small"
                    color={getTransitionTypeColor(flow.transition_type)}
                    sx={{ ml: 1 }}
                  />
                </Typography>
                <Typography variant="body2">
                  <strong>操作时间:</strong> {formatTime(flow.transition_time)}
                </Typography>
                {flow.duration_in_previous_status && (
                  <Typography variant="body2">
                    <strong>前一状态停留时长:</strong> {formatDuration(flow.duration_in_previous_status)}
                  </Typography>
                )}
              </Stack>
            </Box>

            {/* 备注和意见 */}
            {(flow.transition_notes || flow.review_comments) && (
              <>
                <Divider />
                <Box>
                  <Typography variant="h6" gutterBottom>
                    备注信息
                  </Typography>
                  <Stack spacing={2}>
                    {flow.transition_notes && (
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                        <Typography variant="body2">
                          <strong>流转备注:</strong>
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          {flow.transition_notes}
                        </Typography>
                      </Paper>
                    )}
                    {flow.review_comments && (
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'warning.light', opacity: 0.1 }}>
                        <Typography variant="body2" color="warning.dark">
                          <strong>审核意见:</strong>
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          {flow.review_comments}
                        </Typography>
                      </Paper>
                    )}
                  </Stack>
                </Box>
              </>
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
          状态流转历史
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<SvgIcon><path d={mdiRefresh} /></SvgIcon>}
          onClick={handleRefresh}
          disabled={loading}
        >
          刷新
        </Button>
      </Stack>

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

        {!loading && !error && statusFlows.length === 0 && (
          <Box display="flex" flexDirection="column" alignItems="center" py={4}>
            <SvgIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}>
              <path d={mdiTimelineClockOutline} />
            </SvgIcon>
            <Typography color="text.secondary">
              暂无状态流转记录
            </Typography>
          </Box>
        )}

        {!loading && !error && statusFlows.length > 0 && showTimeline && (
          <Timeline position={isMobile ? 'right' : 'alternate'}>
            {statusFlows.map((flowDetail, index) => 
              renderTimelineItem(flowDetail, index)
            )}
          </Timeline>
        )}

        {!loading && !error && statusFlows.length > 0 && !showTimeline && (
          <Stack spacing={2}>
            {statusFlows.map((flowDetail, index) => (
              <Card 
                key={flowDetail.flow.id || index}
                variant="outlined"
                sx={{ 
                  cursor: interactive ? 'pointer' : 'default',
                  '&:hover': interactive ? { 
                    boxShadow: theme.shadows[2],
                    borderColor: theme.palette.primary.main 
                  } : {}
                }}
                onClick={() => handleViewDetails(flowDetail)}
              >
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          {flowDetail.fromStatusName && (
                            <>
                              <Chip label={flowDetail.fromStatusName} size="small" variant="outlined" />
                              <SvgIcon fontSize="small" color="action">
                                <path d={mdiArrowRightBoldOutline} />
                              </SvgIcon>
                            </>
                          )}
                          <Chip 
                            label={flowDetail.statusName} 
                            size="small" 
                            color="primary"
                          />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {flowDetail.flow.trigger_reason}
                        </Typography>
                      </Stack>
                      
                      <Stack spacing={1} alignItems="flex-end">
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(flowDetail.flow.transition_time)}
                        </Typography>
                        <Chip
                          label={transitionTypeLabels[flowDetail.flow.transition_type]}
                          size="small"
                          color={getTransitionTypeColor(flowDetail.flow.transition_type)}
                          variant="outlined"
                        />
                      </Stack>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Box>

      {/* 详情对话框 */}
      {renderDetailDialog()}
    </Box>
  );
};

export default ClaimStatusFlowChart;