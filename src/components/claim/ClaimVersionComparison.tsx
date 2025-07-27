import React, { useState, useEffect } from 'react';
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
  Stack,
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  useTheme,
  useMediaQuery,
  SvgIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  mdiClose,
  mdiChevronDown,
  mdiAlertCircleOutline,
  mdiCheckCircleOutline,
  mdiMinusCircleOutline,
  mdiPlusCircleOutline,
  mdiSwapHorizontal,
  mdiContentCopy,
  mdiEyeOutline
} from '@mdi/js';
import { format } from 'date-fns';

import { ClaimVersionService } from '@/src/services/claimVersionService';
import { useSurreal } from '@/src/contexts/SurrealProvider';
import {
  ClaimVersionHistory,
  VersionDiff,
  FieldChange
} from '@/src/types/claimTracking';

interface ClaimVersionComparisonProps {
  claimId: string;
  fromVersion: number;
  toVersion: number;
  onClose: () => void;
  open?: boolean;
}

const ClaimVersionComparison: React.FC<ClaimVersionComparisonProps> = ({
  claimId,
  fromVersion,
  toVersion,
  onClose,
  open = true
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { client } = useSurreal();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versionDiff, setVersionDiff] = useState<VersionDiff | null>(null);
  const [fromVersionData, setFromVersionData] = useState<ClaimVersionHistory | null>(null);
  const [toVersionData, setToVersionData] = useState<ClaimVersionHistory | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['changes']));

  const versionService = new ClaimVersionService(client);

  // 加载版本对比数据
  useEffect(() => {
    if (!open || !claimId || fromVersion === toVersion) return;

    const loadVersionComparison = async () => {
      setLoading(true);
      setError(null);

      try {
        // 并行加载版本对比和版本详情
        const [diffResult, versionHistory] = await Promise.all([
          versionService.compareVersions({
            claimId,
            fromVersion,
            toVersion
          }),
          versionService.getVersionHistory(claimId)
        ]);

        setVersionDiff(diffResult);

        // 找到对应的版本数据
        const fromData = versionHistory.find(v => v.version_number === fromVersion);
        const toData = versionHistory.find(v => v.version_number === toVersion);
        
        setFromVersionData(fromData || null);
        setToVersionData(toData || null);
      } catch (err) {
        console.error('加载版本对比失败:', err);
        setError('加载版本对比失败，请重试');
      } finally {
        setLoading(false);
      }
    };

    loadVersionComparison();
  }, [claimId, fromVersion, toVersion, open, versionService]);

  // 获取变更类型的显示信息
  const getChangeTypeDisplay = (changeType: 'added' | 'removed' | 'modified') => {
    switch (changeType) {
      case 'added':
        return {
          color: 'success' as const,
          icon: mdiPlusCircleOutline,
          label: '新增',
          bgColor: theme.palette.success.light + '20'
        };
      case 'removed':
        return {
          color: 'error' as const,
          icon: mdiMinusCircleOutline,
          label: '删除',
          bgColor: theme.palette.error.light + '20'
        };
      case 'modified':
        return {
          color: 'warning' as const,
          icon: mdiSwapHorizontal,
          label: '修改',
          bgColor: theme.palette.warning.light + '20'
        };
      default:
        return {
          color: 'default' as const,
          icon: mdiAlertCircleOutline,
          label: '未知',
          bgColor: theme.palette.grey[100]
        };
    }
  };

  // 格式化字段值显示
  const formatFieldValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '(空)';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'boolean') {
      return value ? '是' : '否';
    }
    return String(value);
  };

  // 格式化时间
  const formatTime = (timeStr: string) => {
    try {
      return format(new Date(timeStr), 'yyyy-MM-dd HH:mm:ss');
    } catch {
      return timeStr;
    }
  };

  // 处理手风琴展开/收起
  const handleAccordionToggle = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // 复制内容到剪贴板
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // 这里可以添加一个成功提示
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  // 渲染字段变更详情
  const renderFieldChange = (change: FieldChange, index: number) => {
    const typeDisplay = getChangeTypeDisplay(change.change_type);
    
    return (
      <Card key={index} variant="outlined" sx={{ mb: 2, bgcolor: typeDisplay.bgColor }}>
        <CardContent>
          <Stack spacing={2}>
            {/* 字段信息头部 */}
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  icon={<SvgIcon fontSize="small">
                    <path d={typeDisplay.icon} />
                  </SvgIcon>}
                  label={typeDisplay.label}
                  color={typeDisplay.color}
                  size="small"
                />
                <Typography variant="subtitle2" fontWeight="bold">
                  {change.field_name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ({change.field_path})
                </Typography>
              </Stack>
              <IconButton
                size="small"
                onClick={() => copyToClipboard(
                  `字段: ${change.field_name}\n路径: ${change.field_path}\n类型: ${typeDisplay.label}\n旧值: ${formatFieldValue(change.old_value)}\n新值: ${formatFieldValue(change.new_value)}`
                )}
                title="复制变更信息"
              >
                <SvgIcon fontSize="small">
                  <path d={mdiContentCopy} />
                </SvgIcon>
              </IconButton>
            </Stack>

            {/* 值对比 */}
            <Box>
              {change.change_type !== 'added' && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" color="error.main" fontWeight="bold">
                    旧值:
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1, mt: 0.5, bgcolor: 'error.light', opacity: 0.1 }}>
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{ 
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem'
                      }}
                    >
                      {formatFieldValue(change.old_value)}
                    </Typography>
                  </Paper>
                </Box>
              )}

              {change.change_type !== 'removed' && (
                <Box>
                  <Typography variant="caption" color="success.main" fontWeight="bold">
                    新值:
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1, mt: 0.5, bgcolor: 'success.light', opacity: 0.1 }}>
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{ 
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem'
                      }}
                    >
                      {formatFieldValue(change.new_value)}
                    </Typography>
                  </Paper>
                </Box>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  // 渲染版本信息
  const renderVersionInfo = () => {
    if (!fromVersionData || !toVersionData) return null;

    return (
      <Accordion 
        expanded={expandedSections.has('versions')}
        onChange={() => handleAccordionToggle('versions')}
      >
        <AccordionSummary expandIcon={<SvgIcon><path d={mdiChevronDown} /></SvgIcon>}>
          <Typography variant="h6">版本信息</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
            {/* 源版本信息 */}
            <Card variant="outlined" sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="subtitle1" color="error.main" gutterBottom>
                  版本 {fromVersion} (旧版本)
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">
                    <strong>类型:</strong> {fromVersionData.version_type}
                  </Typography>
                  <Typography variant="body2">
                    <strong>创建时间:</strong> {formatTime(fromVersionData.created_at)}
                  </Typography>
                  {fromVersionData.change_summary && (
                    <Typography variant="body2">
                      <strong>变更摘要:</strong> {fromVersionData.change_summary}
                    </Typography>
                  )}
                  {fromVersionData.change_reason && (
                    <Typography variant="body2">
                      <strong>变更原因:</strong> {fromVersionData.change_reason}
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* 目标版本信息 */}
            <Card variant="outlined" sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="subtitle1" color="success.main" gutterBottom>
                  版本 {toVersion} (新版本)
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">
                    <strong>类型:</strong> {toVersionData.version_type}
                  </Typography>
                  <Typography variant="body2">
                    <strong>创建时间:</strong> {formatTime(toVersionData.created_at)}
                  </Typography>
                  {toVersionData.change_summary && (
                    <Typography variant="body2">
                      <strong>变更摘要:</strong> {toVersionData.change_summary}
                    </Typography>
                  )}
                  {toVersionData.change_reason && (
                    <Typography variant="body2">
                      <strong>变更原因:</strong> {toVersionData.change_reason}
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </AccordionDetails>
      </Accordion>
    );
  };

  // 渲染变更统计
  const renderChangesSummary = () => {
    if (!versionDiff || !versionDiff.changes.length) return null;

    const stats = versionDiff.changes.reduce((acc, change) => {
      acc[change.change_type] = (acc[change.change_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return (
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            变更统计
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            {stats.added && (
              <Chip
                icon={<SvgIcon fontSize="small">
                  <path d={mdiPlusCircleOutline} />
                </SvgIcon>}
                label={`新增 ${stats.added} 项`}
                color="success"
                variant="outlined"
              />
            )}
            {stats.modified && (
              <Chip
                icon={<SvgIcon fontSize="small">
                  <path d={mdiSwapHorizontal} />
                </SvgIcon>}
                label={`修改 ${stats.modified} 项`}
                color="warning"
                variant="outlined"
              />
            )}
            {stats.removed && (
              <Chip
                icon={<SvgIcon fontSize="small">
                  <path d={mdiMinusCircleOutline} />
                </SvgIcon>}
                label={`删除 ${stats.removed} 项`}
                color="error"
                variant="outlined"
              />
            )}
          </Stack>
          {versionDiff.change_summary && (
            <Typography variant="body2" sx={{ mt: 2 }}>
              <strong>变更摘要:</strong> {versionDiff.change_summary}
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: { height: isMobile ? '100%' : '90vh' }
      }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            版本对比: v{fromVersion} → v{toVersion}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <SvgIcon>
              <path d={mdiClose} />
            </SvgIcon>
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
          {loading && (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {!loading && !error && versionDiff && (
            <Stack spacing={2}>
              {/* 版本信息 */}
              {renderVersionInfo()}

              {/* 变更统计 */}
              {renderChangesSummary()}

              {/* 详细变更列表 */}
              <Accordion 
                expanded={expandedSections.has('changes')}
                onChange={() => handleAccordionToggle('changes')}
              >
                <AccordionSummary expandIcon={<SvgIcon><path d={mdiChevronDown} /></SvgIcon>}>
                  <Typography variant="h6">
                    详细变更 ({versionDiff.changes.length} 项)
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {versionDiff.changes.length === 0 ? (
                    <Box display="flex" flexDirection="column" alignItems="center" py={4}>
                      <SvgIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}>
                        <path d={mdiCheckCircleOutline} />
                      </SvgIcon>
                      <Typography color="text.secondary">
                        两个版本之间没有差异
                      </Typography>
                    </Box>
                  ) : (
                    <Stack spacing={2}>
                      {versionDiff.changes.map((change, index) => 
                        renderFieldChange(change, index)
                      )}
                    </Stack>
                  )}
                </AccordionDetails>
              </Accordion>
            </Stack>
          )}

          {!loading && !error && !versionDiff && (
            <Box display="flex" flexDirection="column" alignItems="center" py={4}>
              <SvgIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}>
                <path d={mdiAlertCircleOutline} />
              </SvgIcon>
              <Typography color="text.secondary">
                无法加载版本对比数据
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose} variant="outlined">
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClaimVersionComparison;