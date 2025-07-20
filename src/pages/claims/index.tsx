// STYLING: This page currently uses Tailwind CSS. Per 规范.md, consider migration to MUI components.
// TODO: Access Control - This page should be accessible only to users with 'admin' or specific claim review roles.
// TODO: Auto-Navigation - Logic for automatic navigation to this page (e.g., if case status is '债权申报' and user has permissions) should be handled in higher-level routing.
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { useTranslation } from 'react-i18next';
import { useSurrealClient,AuthenticationRequiredError } from '@/src/contexts/SurrealProvider';
import { useAuth } from '@/src/contexts/AuthContext';
import { useOperationPermission } from '@/src/hooks/usePermission';
import { queryWithAuth } from '@/src/utils/surrealAuth';
import { useDebounce } from '@/src/hooks/useDebounce';
import type { RecordId } from 'surrealdb';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  SvgIcon,
  Link as MuiLink,
  TablePagination,
  Card,
  CardContent,
  Grid,
  LinearProgress
} from '@mui/material';
import {
  mdiMagnify,
  mdiPlusCircleOutline,
  mdiCloseCircleOutline,
  mdiPencilOutline,
  mdiEyeOutline,
  mdiFileDocumentOutline, // For attachment icon
} from '@mdi/js';
// Import the new dialog
import AdminCreateClaimBasicInfoDialog, { AdminBasicClaimData } from '@/src/components/admin/claims/AdminCreateClaimBasicInfoDialog';


// 数据库原始数据接口
interface RawClaimData {
  id: RecordId | string;
  claim_number: string;
  case_id: RecordId | string;
  creditor_id: RecordId | string;
  status: string;
  submission_time: string;
  review_status_id?: RecordId | string;
  review_time?: string;
  reviewer_id?: RecordId | string;
  review_comments?: string;
  created_at: string;
  updated_at: string;
  created_by: RecordId | string;
  // 主张债权详情
  asserted_claim_details: {
    nature: string;
    principal: number;
    interest: number;
    other_amount?: number;
    total_asserted_amount: number;
    currency: string;
    brief_description?: string;
    attachment_doc_id: RecordId | string;
  };
  // 认定债权详情
  approved_claim_details?: {
    nature: string;
    principal: number;
    interest: number;
    other_amount?: number;
    total_approved_amount: number;
    currency: string;
    approved_attachment_doc_id?: RecordId | string;
  };
}

// 债权人信息接口
interface CreditorInfo {
  id: RecordId | string;
  name: string;
  type: 'organization' | 'individual';
  legal_id: string;
  contact_person_name?: string;
  contact_phone?: string;
  contact_address?: string;
}

// 审核状态定义接口
interface ReviewStatusDefinition {
  id: RecordId | string;
  name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
}

// 前端展示用的债权接口
interface Claim {
  id: string;
  // Creditor Info
  creditorName: string;
  creditorType: '组织' | '个人';
  creditorIdentifier: string;
  // Contact Info
  contactPersonName: string;
  contactPersonPhone: string;
  // Claim Basic Info
  claim_number: string;
  // Asserted Claim
  assertedNature: string;
  assertedPrincipal: number;
  assertedInterest: number;
  assertedOtherFees: number;
  asserted_total: number;
  assertedAttachmentsLink?: string;
  // Approved Claim
  approvedNature: string | null;
  approvedPrincipal: number | null;
  approvedInterest: number | null;
  approvedOtherFees: number | null;
  approved_total: number | null;
  approvedAttachmentsLink?: string | null;
  // Audit Info
  auditor: string;
  audit_status: '待审核' | '部分通过' | '已驳回' | '审核通过';
  audit_time: string;
  reviewOpinion?: string | null;
}



// 将数据库原始数据转换为前端展示格式
const transformClaimData = (rawClaim: RawClaimData, creditor: CreditorInfo, reviewStatus?: ReviewStatusDefinition, reviewer?: { name: string }): Claim => {
  return {
    id: String(rawClaim.id),
    creditorName: creditor.name,
    creditorType: creditor.type === 'organization' ? '组织' : '个人',
    creditorIdentifier: creditor.legal_id,
    contactPersonName: creditor.contact_person_name || '',
    contactPersonPhone: creditor.contact_phone || '',
    claim_number: rawClaim.claim_number,
    assertedNature: rawClaim.asserted_claim_details.nature,
    assertedPrincipal: rawClaim.asserted_claim_details.principal,
    assertedInterest: rawClaim.asserted_claim_details.interest,
    assertedOtherFees: rawClaim.asserted_claim_details.other_amount || 0,
    asserted_total: rawClaim.asserted_claim_details.total_asserted_amount,
    assertedAttachmentsLink: rawClaim.asserted_claim_details.attachment_doc_id ? `/documents/${rawClaim.asserted_claim_details.attachment_doc_id}` : undefined,
    approvedNature: rawClaim.approved_claim_details?.nature || null,
    approvedPrincipal: rawClaim.approved_claim_details?.principal || null,
    approvedInterest: rawClaim.approved_claim_details?.interest || null,
    approvedOtherFees: rawClaim.approved_claim_details?.other_amount || null,
    approved_total: rawClaim.approved_claim_details?.total_approved_amount || null,
    approvedAttachmentsLink: rawClaim.approved_claim_details?.approved_attachment_doc_id ? `/documents/${rawClaim.approved_claim_details.approved_attachment_doc_id}` : null,
    auditor: reviewer?.name || '',
    audit_status: reviewStatus?.name === '待提交' ? '待审核' : (reviewStatus?.name as any) || '待审核',
    audit_time: rawClaim.review_time ? new Date(rawClaim.review_time).toLocaleDateString('zh-CN') : '',
    reviewOpinion: rawClaim.review_comments || null
  };
};

const ClaimListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showSuccess, showWarning, showError } = useSnackbar();
  const client = useSurrealClient();
  const { selectedCaseId } = useAuth();
  const { hasPermission: canCreateClaim } = useOperationPermission('claim_create_admin');
  const { hasPermission: canBatchReject } = useOperationPermission('claim_batch_reject');

  const [claimsData, setClaimsData] = useState<Claim[]>([]);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [totalClaims, setTotalClaims] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);
  
  // 统计数据状态
  const [claimsStats, setClaimsStats] = useState({
    totalClaims: 0,
    totalAssertedAmount: 0,
    totalApprovedAmount: 0,
    statusDistribution: {} as Record<string, number>,
    reviewProgress: 0,
  });
  
  // 搜索防抖
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // 获取债权统计数据
  const fetchClaimsStats = useCallback(async () => {
    if (!selectedCaseId || !client) {
      return;
    }

    try {
      // 统计查询
      const statsQuery = `
        -- 基础统计
        SELECT 
          count() AS total_claims,
          math::sum(asserted_claim_details.total_asserted_amount) AS total_asserted_amount,
          math::sum(approved_claim_details.total_approved_amount) AS total_approved_amount
        FROM claim 
        WHERE case_id = $caseId
        GROUP ALL;
        
        -- 状态分布统计
        SELECT 
          review_status_id.name AS status,
          count() AS count
        FROM claim 
        WHERE case_id = $caseId
        GROUP BY review_status_id.name;
        
        -- 审核进度统计
        SELECT 
          count() AS reviewed_claims
        FROM claim 
        WHERE case_id = $caseId 
        AND review_status_id.name IN ['审核通过', '已驳回', '部分通过']
        GROUP ALL;
      `;

      const results = await queryWithAuth<any[]>(client, statsQuery, { caseId: selectedCaseId });
      
      if (results && results.length >= 3) {
        const basicStats = results[0]?.[0] || {};
        const statusDistribution = results[1] || [];
        const reviewedStats = results[2]?.[0] || {};

        // 处理状态分布
        const statusMap: Record<string, number> = {};
        statusDistribution.forEach((item: any) => {
          if (item.status) {
            statusMap[item.status] = item.count || 0;
          }
        });

        // 计算审核进度
        const totalClaims = basicStats.total_claims || 0;
        const reviewedClaims = reviewedStats.reviewed_claims || 0;
        const reviewProgress = totalClaims > 0 ? Math.round((reviewedClaims / totalClaims) * 100) : 0;

        setClaimsStats({
          totalClaims,
          totalAssertedAmount: basicStats.total_asserted_amount || 0,
          totalApprovedAmount: basicStats.total_approved_amount || 0,
          statusDistribution: statusMap,
          reviewProgress,
        });
      }
    } catch (error) {
      console.error('获取债权统计数据失败:', error);
    }
  }, [selectedCaseId, client]);

  // 获取债权数据
  const fetchClaims = useCallback(async (
    currentPage: number,
    currentRowsPerPage: number,
    currentSearchTerm: string
  ) => {
    if (!selectedCaseId || !client) {
      setClaimsData([]);
      setTotalClaims(0);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // 构建查询条件
      let whereClause = `case_id = $caseId`;
      const queryParams: Record<string, any> = { caseId: selectedCaseId };

      // 构建搜索条件 - 简单全文检索
      const searchConditions: string[] = [];
      
      if (currentSearchTerm && currentSearchTerm.trim() !== '') {
        // 全文检索 - 对债权相关字段进行搜索
        searchConditions.push(` AND (claim_number @@ $searchTerm OR asserted_claim_details.nature @@ $searchTerm OR asserted_claim_details.brief_description @@ $searchTerm OR creditor_id.name @@ $searchTerm)`);
        queryParams.searchTerm = currentSearchTerm.trim();
      }

      // 状态筛选
      if (filterStatus) {
        searchConditions.push(` AND review_status_id.name = $filterStatus`);
        queryParams.filterStatus = filterStatus;
      }
      
      // 应用搜索条件
      const searchConditionStr = searchConditions.join(' ');
      whereClause += searchConditionStr;

      // 数据查询
      const dataQuery = `
        SELECT 
          id,
          claim_number,
          case_id,
          creditor_id,
          status,
          submission_time,
          review_status_id,
          review_time,
          reviewer_id,
          review_comments,
          created_at,
          updated_at,
          created_by,
          asserted_claim_details,
          approved_claim_details
        FROM claim 
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $limit START $start
      `;
      
      queryParams.limit = currentRowsPerPage;
      queryParams.start = currentPage * currentRowsPerPage;

      // 统计查询
      const countQuery = `
        SELECT count() AS total 
        FROM claim 
        WHERE ${whereClause}
        GROUP ALL
      `;

      // 执行查询 - 使用 client.query 直接查询以获取多个结果
      const combinedQuery = `return $auth;${dataQuery};${countQuery}`;
      const rawResults = await client.query(combinedQuery, queryParams);
      
      if (!rawResults || !Array.isArray(rawResults) || rawResults.length < 3) {
        throw new Error(t('error_invalid_query_response', '查询返回数据格式错误'));
      }

      // 检查认证状态
      const authResult = rawResults[0];
      if (!authResult || typeof authResult !== 'object') {
        throw new AuthenticationRequiredError('用户未登录，请先登录');
      }

      const rawClaims: RawClaimData[] = rawResults[1] || [];
      const countResult = rawResults[2]?.[0];
      const total = countResult?.total || 0;

      // 获取债权人信息
      const creditorIds = [...new Set(rawClaims.map(claim => claim.creditor_id))];
      let creditors: CreditorInfo[] = [];
      if (creditorIds.length > 0) {
        const creditorQuery = `
          SELECT id, name, type, legal_id, contact_person_name, contact_phone, contact_address
          FROM creditor 
          WHERE id IN $creditorIds
        `;
        const creditorResults = await queryWithAuth<any[]>(client, creditorQuery, { creditorIds });
        creditors = creditorResults[0] || [];
      }

      // 获取审核状态定义
      const reviewStatusIds = [...new Set(rawClaims.map(claim => claim.review_status_id).filter(Boolean))];
      let reviewStatuses: ReviewStatusDefinition[] = [];
      if (reviewStatusIds.length > 0) {
        const statusQuery = `
          SELECT id, name, description, display_order, is_active
          FROM claim_review_status_definition 
          WHERE id IN $statusIds
        `;
        const statusResults = await queryWithAuth<any[]>(client, statusQuery, { statusIds: reviewStatusIds });
        reviewStatuses = statusResults[0] || [];
      }

      // 获取审核人信息
      const reviewerIds = [...new Set(rawClaims.map(claim => claim.reviewer_id).filter(Boolean))];
      let reviewers: { id: string; name: string }[] = [];
      if (reviewerIds.length > 0) {
        const reviewerQuery = `
          SELECT id, name
          FROM user 
          WHERE id IN $reviewerIds
        `;
        const reviewerResults = await queryWithAuth<any[]>(client, reviewerQuery, { reviewerIds });
        reviewers = reviewerResults[0] || [];
      }

      // 转换数据格式
      const transformedClaims = rawClaims.map(rawClaim => {
        const creditor = creditors.find(c => String(c.id) === String(rawClaim.creditor_id));
        const reviewStatus = reviewStatuses.find(rs => String(rs.id) === String(rawClaim.review_status_id));
        const reviewer = reviewers.find(r => String(r.id) === String(rawClaim.reviewer_id));
        
        if (!creditor) {
          console.warn(`Creditor not found for claim ${rawClaim.id}:`, rawClaim.creditor_id);
          return null;
        }
        
        return transformClaimData(rawClaim, creditor, reviewStatus, reviewer);
      }).filter(Boolean) as Claim[];

      setClaimsData(transformedClaims);
      setTotalClaims(total);
    } catch (err) {
      console.error('Error fetching claims:', err);
      if (err instanceof AuthenticationRequiredError) {
        navigate('/login');
        showError(err.message);
      } else {
        const errorMessage = err instanceof Error ? err.message : t('error_fetching_claims', '获取债权列表失败。');
        setError(errorMessage);
        showError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedCaseId, client, t, navigate, showError]);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectReasonError, setRejectReasonError] = useState('');
  const [adminCreateClaimDialogOpen, setAdminCreateClaimDialogOpen] = useState(false); // New state for admin create claim dialog

  // 无需本地筛选，数据已在服务端筛选
  const filteredClaims = claimsData;

  // 初始化加载数据
  useEffect(() => {
    fetchClaims(page, rowsPerPage, debouncedSearchTerm);
    fetchClaimsStats(); // 同时加载统计数据
  }, [fetchClaims, fetchClaimsStats, page, rowsPerPage, debouncedSearchTerm]);

  // 搜索或筛选条件变化时重置选中状态
  useEffect(() => {
    setSelected([]);
  }, [debouncedSearchTerm, filterStatus]);

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelecteds = filteredClaims.map((n) => n.id);
      setSelected(newSelecteds);
      return;
    }
    setSelected([]);
  };

  const handleClick = (event: React.MouseEvent<unknown>, id: string) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected: readonly string[] = [];
    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(selected.slice(0, selectedIndex), selected.slice(selectedIndex + 1));
    }
    setSelected(newSelected);
  };

  const isSelected = (id: string) => selected.indexOf(id) !== -1;

  const getStatusChipColor = (status: Claim['audit_status']): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (status) {
      case '待审核': return 'info';
      case '部分通过': return 'warning';
      case '已驳回': return 'error';
      case '审核通过': return 'success';
      default: return 'default';
    }
  };

  const handleOpenRejectModal = () => {
    if (selected.length === 0) {
      showWarning('没有选中任何债权。');
      return;
    }
    const nonRejectableClaim = filteredClaims.find(claim => selected.includes(claim.id) && claim.audit_status === '已驳回');
    if (nonRejectableClaim) {
      showWarning(`债权 ${nonRejectableClaim.claim_number} 已是"已驳回"状态，无需再次驳回。`);
    }
    setRejectionReason('');
    setRejectReasonError('');
    setRejectModalOpen(true);
  };

  const handleCloseRejectModal = () => {
    setRejectModalOpen(false);
    setRejectionReason('');
    setRejectReasonError('');
  }

  const handleConfirmBatchReject = async () => {
    if (!rejectionReason.trim()) {
      setRejectReasonError(t('rejection_reason_required', '驳回原因不能为空。'));
      return;
    }
    
    if (!client || !selectedCaseId) {
      showError(t('error_no_client_or_case', '缺少必要的连接信息'));
      return;
    }
    
    try {
      setRejectReasonError('');
      
      // 获取驳回状态定义
      const rejectStatusQuery = `
        SELECT id FROM claim_review_status_definition 
        WHERE name = '已驳回' AND is_active = true
        LIMIT 1
      `;
      
      const statusResults = await queryWithAuth<any[]>(client, rejectStatusQuery, {});
      const rejectStatus = statusResults[0]?.[0];
      
      if (!rejectStatus) {
        showError(t('error_reject_status_not_found', '未找到驳回状态定义'));
        return;
      }
      
      // 批量更新债权状态
      const updateQuery = `
        FOR $claimId IN $claimIds {
          UPDATE $claimId SET 
            review_status_id = $rejectStatusId,
            review_comments = $rejectionReason,
            review_time = time::now()
        }
      `;
      
      await queryWithAuth(client, updateQuery, {
        claimIds: selected,
        rejectStatusId: rejectStatus.id,
        rejectionReason: rejectionReason
      });
      
      showSuccess(t('batch_reject_success', `${selected.length} 个债权已批量驳回。`));
      handleCloseRejectModal();
      setSelected([]);
      
      // 刷新数据
      await fetchClaims(page, rowsPerPage, debouncedSearchTerm);
    } catch (err) {
      console.error('Error in batch reject:', err);
      if (err instanceof AuthenticationRequiredError) {
        navigate('/login');
        showError(err.message);
      } else {
        const errorMessage = err instanceof Error ? err.message : t('error_batch_reject', '批量驳回失败');
        showError(errorMessage);
      }
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || typeof amount === 'undefined') return '-';
    return amount.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' }); // Assuming CNY for all for now
  };

  const handleAdminCreateClaimNext = async (basicClaimData: AdminBasicClaimData) => {
    if (!client || !selectedCaseId) {
      showError(t('error_no_client_or_case', '缺少必要的连接信息'));
      return;
    }
    
    try {
      // TODO: 实现创建债权的完整逻辑
      // 这里只是临时实现，实际需要根据具体业务逻辑调整
      const tempClaimId = `temp-${Date.now()}`;
      
      // 将基本信息存储到 localStorage 供后续使用
      localStorage.setItem('tempClaimData', JSON.stringify({
        ...basicClaimData,
        caseId: selectedCaseId,
        tempId: tempClaimId
      }));
      
      setAdminCreateClaimDialogOpen(false);
      showSuccess(t('admin_claim_basic_info_saved_success', '基本信息已保存，请继续添加附件材料。'));
      navigate(`/admin/create-claim/${tempClaimId}/attachments`);
    } catch (err) {
      console.error('Error creating claim:', err);
      showError(t('error_create_claim', '创建债权失败'));
    }
  };


  return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t('claim_list_admin_page_title', '债权申报与审核 (管理员)')}
        </Typography>

        {/* 统计数据卡片 */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="overline">
                  债权总数
                </Typography>
                <Typography variant="h4">
                  {claimsStats.totalClaims}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="overline">
                  主张总金额
                </Typography>
                <Typography variant="h4">
                  ¥{(claimsStats.totalAssertedAmount / 10000).toFixed(1)}万
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="overline">
                  认定总金额
                </Typography>
                <Typography variant="h4">
                  ¥{(claimsStats.totalApprovedAmount / 10000).toFixed(1)}万
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="overline">
                  审核进度
                </Typography>
                <Typography variant="h4" sx={{ mb: 1 }}>
                  {claimsStats.reviewProgress}%
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={claimsStats.reviewProgress} 
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 状态分布 */}
        {Object.keys(claimsStats.statusDistribution).length > 0 && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                审核状态分布
              </Typography>
              <Grid container spacing={2}>
                {Object.entries(claimsStats.statusDistribution).map(([status, count]) => (
                  <Grid size={{ xs: 6, sm: 4, md: 2 }} key={status}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" color="primary">
                        {count}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {status}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        )}

        <Paper sx={{ mb: 2, p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <TextField
                label={t('search_claims_label', '搜索债权人/编号/联系人...')}
                variant="outlined"
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="支持搜索债权编号、债权性质、债权描述、债权人姓名等信息"
                InputProps={{
                  startAdornment: (
                      <InputAdornment position="start">
                        <SvgIcon fontSize="small"><path d={mdiMagnify} /></SvgIcon>
                      </InputAdornment>
                  ),
                }}
                sx={{ flexGrow: 1, minWidth: '400px' }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="filter-status-label">{t('filter_by_status_label', '审核状态')}</InputLabel>
              <Select
                  labelId="filter-status-label"
                  value={filterStatus}
                  label={t('filter_by_status_label', '审核状态')}
                  onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="">{t('all_statuses_option', '所有状态')}</MenuItem>
                <MenuItem value="待审核">{t('status_pending', '待审核')}</MenuItem>
                <MenuItem value="部分通过">{t('status_partially_approved', '部分通过')}</MenuItem>
                <MenuItem value="已驳回">{t('status_rejected', '已驳回')}</MenuItem>
                <MenuItem value="审核通过">{t('status_approved', '审核通过')}</MenuItem>
              </Select>
            </FormControl>
            
            {canCreateClaim && (
              <Button
                  variant="contained"
                  startIcon={<SvgIcon><path d={mdiPlusCircleOutline} /></SvgIcon>}
                  onClick={() => setAdminCreateClaimDialogOpen(true)}
              >
                {t('create_claim_button', '创建债权')}
              </Button>
            )}
            {canBatchReject && (
              <Button
                  variant="outlined"
                  color="error"
                  startIcon={<SvgIcon><path d={mdiCloseCircleOutline} /></SvgIcon>}
                  onClick={handleOpenRejectModal}
                  disabled={selected.length === 0}
              >
                {t('batch_reject_button', '批量驳回')}
              </Button>
            )}
          </Stack>
        </Paper>

        {error && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
            <Typography variant="body2">{error}</Typography>
          </Paper>
        )}
        
        <TableContainer component={Paper}>
          <Table stickyHeader size="small" aria-label="claims table">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                      color="primary"
                      indeterminate={selected.length > 0 && selected.length < filteredClaims.length}
                      checked={filteredClaims.length > 0 && selected.length === filteredClaims.length}
                      onChange={handleSelectAllClick}
                      inputProps={{ 'aria-label': t('select_all_claims_aria_label', 'select all claims') }}
                  />
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('column_creditor_info', '债权人信息')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('column_creditor_id', '债权人ID')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('column_contact_person', '联系人')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('column_contact_phone', '联系方式')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('column_claim_number', '债权编号')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('column_asserted_nature', '主张性质')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{t('column_asserted_principal', '主张本金')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{t('column_asserted_interest', '主张利息')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{t('column_asserted_other_fees', '主张其他')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{t('column_asserted_total', '主张总额')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('column_asserted_attachments', '主张附件')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('column_approved_nature', '认定性质')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{t('column_approved_principal', '认定本金')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{t('column_approved_interest', '认定利息')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{t('column_approved_other_fees', '认定其他')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{t('column_approved_total', '认定总额')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('column_approved_attachments', '认定附件')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('column_audit_status', '审核状态')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('column_review_opinion', '审核意见')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('column_auditor', '审核人')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('column_audit_time', '审核时间')}</TableCell>
                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{t('column_actions', '操作')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={23} align="center">
                    <Typography sx={{p:2}}>{t('loading_claims', '正在加载债权数据...')}</Typography>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filteredClaims.length === 0 && (
                <TableRow>
                  <TableCell colSpan={23} align="center">
                    <Typography sx={{p:2}}>{t('no_claims_found', '暂无匹配的债权数据')}</Typography>
                  </TableCell>
                </TableRow>
              )}
              {filteredClaims.map((claim) => {
                const isItemSelected = isSelected(claim.id);
                return (
                    <TableRow
                        hover
                        key={claim.id}
                        selected={isItemSelected}
                        onClick={(event) => {
                          if ((event.target as HTMLElement).closest('button, a, input[type="checkbox"]')) return;
                          handleClick(event, claim.id);
                        }}
                        sx={{ cursor: 'pointer' }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                            color="primary"
                            checked={isItemSelected}
                            onChange={(event) => {
                              event.stopPropagation();
                              handleClick(event as unknown as React.MouseEvent<unknown>, claim.id);
                            }}
                            inputProps={{ 'aria-labelledby': `claim-checkbox-${claim.id}` }}
                        />
                      </TableCell>
                      <TableCell>{claim.creditorName} ({claim.creditorType})</TableCell>
                      <TableCell>{claim.creditorIdentifier}</TableCell>
                      <TableCell>{claim.contactPersonName}</TableCell>
                      <TableCell>{claim.contactPersonPhone}</TableCell>
                      <TableCell>{claim.claim_number}</TableCell>
                      <TableCell>{claim.assertedNature}</TableCell>
                      <TableCell sx={{textAlign: 'right'}}>{formatCurrency(claim.assertedPrincipal)}</TableCell>
                      <TableCell sx={{textAlign: 'right'}}>{formatCurrency(claim.assertedInterest)}</TableCell>
                      <TableCell sx={{textAlign: 'right'}}>{formatCurrency(claim.assertedOtherFees)}</TableCell>
                      <TableCell sx={{textAlign: 'right'}}>{formatCurrency(claim.asserted_total)}</TableCell>
                      <TableCell>
                        {claim.assertedAttachmentsLink && (
                            <Tooltip title={t('view_attachments_tooltip', '查看附件')}>
                              <IconButton size="small" component={MuiLink} href={claim.assertedAttachmentsLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                <SvgIcon fontSize="small"><path d={mdiFileDocumentOutline} /></SvgIcon>
                              </IconButton>
                            </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>{claim.approvedNature || '-'}</TableCell>
                      <TableCell sx={{textAlign: 'right'}}>{formatCurrency(claim.approvedPrincipal)}</TableCell>
                      <TableCell sx={{textAlign: 'right'}}>{formatCurrency(claim.approvedInterest)}</TableCell>
                      <TableCell sx={{textAlign: 'right'}}>{formatCurrency(claim.approvedOtherFees)}</TableCell>
                      <TableCell sx={{textAlign: 'right'}}>{formatCurrency(claim.approved_total)}</TableCell>
                      <TableCell>
                        {claim.approvedAttachmentsLink && (
                            <Tooltip title={t('view_admin_attachments_tooltip', '查看管理人附件')}>
                              <IconButton size="small" component={MuiLink} href={claim.approvedAttachmentsLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                <SvgIcon fontSize="small"><path d={mdiFileDocumentOutline} /></SvgIcon>
                              </IconButton>
                            </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={claim.audit_status} color={getStatusChipColor(claim.audit_status)} size="small" />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={claim.reviewOpinion || ''}>
                        {claim.reviewOpinion || '-'}
                      </TableCell>
                      <TableCell>{claim.auditor || '-'}</TableCell>
                      <TableCell>{claim.audit_time || '-'}</TableCell>
                      <TableCell align="center">
                        <Tooltip title={claim.audit_status === '待审核' ? t('review_claim_tooltip', '审核债权') : t('view_claim_details_tooltip', '查看详情')}>
                          <IconButton
                              component={Link}
                              to={`/claims/${claim.id}/review`}
                              size="small"
                              onClick={(e) => e.stopPropagation()}
                          >
                            <SvgIcon fontSize="small"><path d={claim.audit_status === '待审核' ? mdiPencilOutline : mdiEyeOutline} /></SvgIcon>
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={totalClaims}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          labelRowsPerPage={t('rows_per_page', '每页显示:')}
          labelDisplayedRows={({ from, to, count }) => 
            t('pagination_info', `${from}-${to} / ${count !== -1 ? count : `${to}以上`}`)
          }
        />
        
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {t('claim_list_admin_footer_note', '此页面供管理员审核债权申报。支持创建、批量驳回、搜索和筛选功能。')}
        </Typography>

        <Dialog open={rejectModalOpen} onClose={handleCloseRejectModal} maxWidth="sm" fullWidth>
          <DialogTitle>{t('batch_reject_modal_title', '批量驳回原因')}</DialogTitle>
          <DialogContent>
            <TextField
                autoFocus
                margin="dense"
                id="rejectionReason"
                label={t('rejection_reason_label', '驳回原因')}
                type="text"
                fullWidth
                variant="outlined"
                multiline
                rows={4}
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  if (e.target.value.trim()) setRejectReasonError('');
                }}
                error={!!rejectReasonError}
                helperText={rejectReasonError}
                sx={{mt:1}}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseRejectModal}>{t('cancel_button', '取消')}</Button>
            <Button onClick={handleConfirmBatchReject} variant="contained" color="error">
              {t('confirm_reject_button', '确认驳回')} ({selected.length})
            </Button>
          </DialogActions>
        </Dialog>

        <AdminCreateClaimBasicInfoDialog
            open={adminCreateClaimDialogOpen}
            onClose={() => setAdminCreateClaimDialogOpen(false)}
            onNext={handleAdminCreateClaimNext}
        />
      </Box>
  );
};

export default ClaimListPage;
