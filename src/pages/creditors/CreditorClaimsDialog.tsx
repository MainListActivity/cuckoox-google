import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  IconButton,
  SvgIcon,
  Box,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Divider,
  Tooltip,
} from '@mui/material';
import { 
  mdiClose, 
  mdiEyeOutline, 
  mdiPencilOutline,
  mdiCashMultiple,
  mdiFileDocumentOutline,
  mdiAccountOutline,
} from '@mdi/js';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { useSurrealClient } from '@/src/contexts/SurrealProvider';
import { useAuth } from '@/src/contexts/AuthContext';
import { RecordId } from 'surrealdb';
import type { Creditor } from './types';

// 债权基本信息类型定义
export interface ClaimInfo {
  id: RecordId | string;
  claim_number: string;
  status: string;
  submission_time: string;
  review_status_id?: RecordId | string;
  reviewer_id?: RecordId | string;
  review_time?: string;
  review_comments?: string;
  asserted_claim_details: {
    principal: number;
    interest: number;
    other_amount?: number;
    total_asserted_amount: number;
    nature: string;
    currency: string;
  };
  approved_claim_details?: {
    principal: number;
    interest: number;
    other_amount?: number;
    total_approved_amount: number;
    nature: string;
    currency: string;
  };
  created_at: string;
  updated_at: string;
}

export interface CreditorClaimsDialogProps {
  open: boolean;
  onClose: () => void;
  creditor: Creditor | null;
}

const CreditorClaimsDialog: React.FC<CreditorClaimsDialogProps> = ({
  open,
  onClose,
  creditor,
}) => {
  const { t } = useTranslation();
  const { showError } = useSnackbar();
  const client = useSurrealClient();
  const { selectedCaseId } = useAuth();
  
  const [claims, setClaims] = useState<ClaimInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 获取债权状态的显示文本和颜色
  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { text: string; color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' }> = {
      '草稿': { text: '草稿', color: 'default' },
      '已提交': { text: '已提交', color: 'info' },
      '审核中': { text: '审核中', color: 'warning' },
      '已确认': { text: '已确认', color: 'success' },
      '已驳回': { text: '已驳回', color: 'error' },
      '待补充': { text: '待补充', color: 'warning' },
    };
    return statusMap[status] || { text: status, color: 'default' };
  };

  // 格式化金额显示
  const formatAmount = (amount: number | undefined, currency: string = 'CNY') => {
    if (amount === undefined || amount === null) return '¥0.00';
    const symbol = currency === 'CNY' ? '¥' : currency;
    return `${symbol}${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // 格式化日期显示
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // 获取债权人的所有债权
  const fetchCreditorClaims = useCallback(async () => {
    if (!creditor || !selectedCaseId) return;

    setIsLoading(true);
    setError(null);

    try {
      const query = `
        SELECT 
          id,
          claim_number,
          status,
          submission_time,
          review_status_id,
          reviewer_id,
          review_time,
          review_comments,
          asserted_claim_details,
          approved_claim_details,
          created_at,
          updated_at
        FROM claim 
        WHERE creditor_id = $creditorId AND case_id = $caseId
        ORDER BY created_at DESC
      `;

      const result = await client.query(query, {
        creditorId: creditor.id,
        caseId: selectedCaseId,
      });

      const claimsData = Array.isArray(result) ? result as ClaimInfo[] : [];
      setClaims(claimsData);
    } catch (err) {
      console.error('Error fetching creditor claims:', err);
      const errorMessage = err instanceof Error ? err.message : '获取债权信息失败';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [creditor, selectedCaseId, client, showError]);

  // 当对话框打开时获取数据
  useEffect(() => {
    if (open && creditor) {
      fetchCreditorClaims();
    }
  }, [open, creditor, fetchCreditorClaims]);

  // 处理查看债权详情
  const handleViewClaim = (claim: ClaimInfo) => {
    // TODO: 实现债权详情查看功能
    console.log('查看债权详情:', claim);
  };

  // 处理编辑债权
  const handleEditClaim = (claim: ClaimInfo) => {
    // TODO: 实现债权编辑功能
    console.log('编辑债权:', claim);
  };

  // 计算统计信息
  const statistics = React.useMemo(() => {
    if (claims.length === 0) return null;

    const totalAsserted = claims.reduce((sum, claim) => 
      sum + (claim.asserted_claim_details?.total_asserted_amount || 0), 0
    );
    const totalApproved = claims.reduce((sum, claim) => 
      sum + (claim.approved_claim_details?.total_approved_amount || 0), 0
    );

    const statusCounts = claims.reduce((acc, claim) => {
      acc[claim.status] = (acc[claim.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalClaims: claims.length,
      totalAsserted,
      totalApproved,
      statusCounts,
    };
  }, [claims]);

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { 
          borderRadius: 2,
          minHeight: '60vh',
          maxHeight: '90vh',
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SvgIcon color="primary" sx={{ fontSize: 28 }}>
            <path d={mdiFileDocumentOutline} />
          </SvgIcon>
          <Box>
            <Typography variant="h6" component="div">
              {t('creditor_claims_title', '债权人债权明细')}
            </Typography>
            {creditor && (
              <Typography variant="body2" color="text.secondary">
                {creditor.name} ({creditor.type})
              </Typography>
            )}
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small">
          <SvgIcon fontSize="small">
            <path d={mdiClose} />
          </SvgIcon>
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* 统计信息 */}
        {statistics && (
          <Box sx={{ mb: 3 }}>
            <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                {t('claims_statistics', '债权统计')}
              </Typography>
              <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SvgIcon color="primary" fontSize="small">
                    <path d={mdiFileDocumentOutline} />
                  </SvgIcon>
                  <Typography variant="body2">
                    <strong>{statistics.totalClaims}</strong> 笔债权
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SvgIcon color="info" fontSize="small">
                    <path d={mdiCashMultiple} />
                  </SvgIcon>
                  <Typography variant="body2">
                    申报总额: <strong>{formatAmount(statistics.totalAsserted)}</strong>
                  </Typography>
                </Box>
                {statistics.totalApproved > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SvgIcon color="success" fontSize="small">
                      <path d={mdiCashMultiple} />
                    </SvgIcon>
                    <Typography variant="body2">
                      确认总额: <strong>{formatAmount(statistics.totalApproved)}</strong>
                    </Typography>
                  </Box>
                )}
              </Stack>
              <Box sx={{ mt: 2 }}>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {Object.entries(statistics.statusCounts).map(([status, count]) => {
                    const statusInfo = getStatusDisplay(status);
                    return (
                      <Chip
                        key={status}
                        label={`${statusInfo.text}: ${count}`}
                        size="small"
                        color={statusInfo.color}
                        variant="outlined"
                      />
                    );
                  })}
                </Stack>
              </Box>
            </Paper>
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />

        {/* 债权列表 */}
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>{t('loading_claims', '正在加载债权信息...')}</Typography>
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ my: 2 }}>
            {error}
          </Alert>
        ) : claims.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <SvgIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }}>
              <path d={mdiFileDocumentOutline} />
            </SvgIcon>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {t('no_claims_found', '暂无债权信息')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('no_claims_description', '该债权人尚未申报任何债权')}
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>{t('claim_number', '债权编号')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('claim_status', '状态')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('claim_nature', '债权性质')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{t('asserted_amount', '申报金额')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{t('approved_amount', '确认金额')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('submission_time', '申报时间')}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>{t('actions', '操作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {claims.map((claim) => {
                  const statusInfo = getStatusDisplay(claim.status);
                  return (
                    <TableRow key={claim.id.toString()} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {claim.claim_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={statusInfo.text}
                          size="small"
                          color={statusInfo.color}
                          variant="filled"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {claim.asserted_claim_details?.nature || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={500}>
                          {formatAmount(
                            claim.asserted_claim_details?.total_asserted_amount,
                            claim.asserted_claim_details?.currency
                          )}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={500}>
                          {claim.approved_claim_details ? 
                            formatAmount(
                              claim.approved_claim_details.total_approved_amount,
                              claim.approved_claim_details.currency
                            ) : '-'
                          }
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(claim.submission_time)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0} justifyContent="center">
                          <Tooltip title={t('view_claim_details', '查看详情')}>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleViewClaim(claim)}
                            >
                              <SvgIcon fontSize="small">
                                <path d={mdiEyeOutline} />
                              </SvgIcon>
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('edit_claim', '编辑债权')}>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleEditClaim(claim)}
                            >
                              <SvgIcon fontSize="small">
                                <path d={mdiPencilOutline} />
                              </SvgIcon>
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button 
          onClick={onClose} 
          variant="contained"
          color="primary"
        >
          {t('close', '关闭')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreditorClaimsDialog;