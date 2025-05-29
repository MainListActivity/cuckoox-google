// STYLING: This page currently uses Tailwind CSS. Per 规范.md, consider migration to MUI components.
// TODO: Access Control - This page should be accessible only to users with 'admin' or specific claim review roles.
// TODO: Auto-Navigation - Logic for automatic navigation to this page (e.g., if case status is '债权申报' and user has permissions) should be handled in higher-level routing.
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { useTranslation } from 'react-i18next';
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
  Link as MuiLink, // For attachment links
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
import AdminCreateClaimBasicInfoDialog, { AdminBasicClaimData } from '../../components/admin/claims/AdminCreateClaimBasicInfoDialog';


// Updated Claim interface
interface Claim {
  id: string;
  // Creditor Info
  creditorName: string;
  creditorType: '组织' | '个人';
  creditorIdentifier: string; // New
  // Contact Info
  contactPersonName: string; // New
  contactPersonPhone: string; // New
  // Claim Basic Info
  claim_number: string;
  // Asserted Claim
  assertedNature: string; // New
  assertedPrincipal: number; // New
  assertedInterest: number; // New
  assertedOtherFees: number; // New
  asserted_total: number; // Existing
  assertedAttachmentsLink?: string; // New - placeholder
  // Approved Claim
  approvedNature: string | null; // New
  approvedPrincipal: number | null; // New
  approvedInterest: number | null; // New
  approvedOtherFees: number | null; // New
  approved_total: number | null; // Existing
  approvedAttachmentsLink?: string | null; // New - placeholder
  // Audit Info
  auditor: string;
  audit_status: '待审核' | '部分通过' | '已驳回' | '审核通过';
  audit_time: string;
  reviewOpinion?: string | null; // New
}


// Updated Mock Data
const initialMockClaims: Claim[] = [
  {
    id: 'claim001',
    creditorName: 'Acme Corp', creditorType: '组织', creditorIdentifier: '91330100MA2XXXXX1A',
    contactPersonName: 'John Doe', contactPersonPhone: '13800138000',
    claim_number: 'CL-2023-001',
    assertedNature: '货款', assertedPrincipal: 140000, assertedInterest: 5000, assertedOtherFees: 0,
    asserted_total: 150000, assertedAttachmentsLink: '#',
    approvedNature: '货款', approvedPrincipal: 140000, approvedInterest: 5000, approvedOtherFees: 0,
    approved_total: 145000, approvedAttachmentsLink: '#',
    auditor: 'Reviewer A', audit_status: '部分通过', audit_time: '2023-04-10', reviewOpinion: '利息部分需核实'
  },
  {
    id: 'claim002',
    creditorName: 'Jane Smith', creditorType: '个人', creditorIdentifier: '33010219900101XXXX',
    contactPersonName: 'Jane Smith', contactPersonPhone: '13900139000',
    claim_number: 'CL-2023-002',
    assertedNature: '服务费', assertedPrincipal: 75000, assertedInterest: 0, assertedOtherFees: 0,
    asserted_total: 75000, assertedAttachmentsLink: '#',
    approvedNature: null, approvedPrincipal: null, approvedInterest: null, approvedOtherFees: null,
    approved_total: 0, approvedAttachmentsLink: null,
    auditor: 'Reviewer B', audit_status: '已驳回', audit_time: '2023-04-12', reviewOpinion: '服务合同无效'
  },
  {
    id: 'claim003',
    creditorName: 'Beta LLC', creditorType: '组织', creditorIdentifier: '91330100MA2YYYYY2B',
    contactPersonName: 'Mike Johnson', contactPersonPhone: '13700137000',
    claim_number: 'CL-2023-003',
    assertedNature: '工程款', assertedPrincipal: 200000, assertedInterest: 20000, assertedOtherFees: 0,
    asserted_total: 220000, assertedAttachmentsLink: '#',
    approvedNature: null, approvedPrincipal: null, approvedInterest: null, approvedOtherFees: null,
    approved_total: null, approvedAttachmentsLink: null,
    auditor: '', audit_status: '待审核', audit_time: '', reviewOpinion: null
  },
  {
    id: 'claim004',
    creditorName: 'Gamma Inc', creditorType: '组织', creditorIdentifier: '91330100MA2ZZZZZ3C',
    contactPersonName: 'Carol Williams', contactPersonPhone: '13600136000',
    claim_number: 'CL-2023-004',
    assertedNature: '借款', assertedPrincipal: 50000, assertedInterest: 0, assertedOtherFees: 0,
    asserted_total: 50000, assertedAttachmentsLink: '#',
    approvedNature: '借款', approvedPrincipal: 50000, approvedInterest: 0, approvedOtherFees: 0,
    approved_total: 50000, approvedAttachmentsLink: null,
    auditor: 'Reviewer C', audit_status: '审核通过', audit_time: '2023-05-15', reviewOpinion: '材料齐全，予以确认'
  },
];

const ClaimListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();

  const [claimsData, setClaimsData] = useState<Claim[]>(initialMockClaims);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectReasonError, setRejectReasonError] = useState('');
  const [adminCreateClaimDialogOpen, setAdminCreateClaimDialogOpen] = useState(false); // New state for admin create claim dialog

  const filteredClaims = useMemo(() => {
    let currentClaims = [...claimsData];
    if (searchTerm) {
      currentClaims = currentClaims.filter(claim =>
          claim.creditorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          claim.claim_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          claim.creditorIdentifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
          claim.contactPersonName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          claim.contactPersonPhone.includes(searchTerm)
      );
    }
    if (filterStatus) {
      currentClaims = currentClaims.filter(claim => claim.audit_status === filterStatus);
    }
    return currentClaims;
  }, [claimsData, searchTerm, filterStatus]);

  useEffect(() => {
    setSelected([]);
  }, [searchTerm, filterStatus]);

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
      showSnackbar('没有选中任何债权。', 'warning');
      return;
    }
    const nonRejectableClaim = filteredClaims.find(claim => selected.includes(claim.id) && claim.audit_status === '已驳回');
    if (nonRejectableClaim) {
      showSnackbar(`债权 ${nonRejectableClaim.claim_number} 已是“已驳回”状态，无需再次驳回。`, 'warning');
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

  const handleConfirmBatchReject = () => {
    if (!rejectionReason.trim()) {
      setRejectReasonError('驳回原因不能为空。');
      return;
    }
    setRejectReasonError('');

    setClaimsData(prevClaims =>
        prevClaims.map(claim =>
            selected.includes(claim.id)
                ? { ...claim, audit_status: '已驳回', reviewOpinion: rejectionReason, auditor: 'AdminUser', audit_time: new Date().toISOString().split('T')[0] }
                : claim
        )
    );

    showSnackbar(`${selected.length} 个债权已批量驳回。`, 'success');
    handleCloseRejectModal();
    setSelected([]);
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || typeof amount === 'undefined') return '-';
    return amount.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' }); // Assuming CNY for all for now
  };

  const handleAdminCreateClaimNext = (basicClaimData: AdminBasicClaimData) => {
    const tempClaimId = `ADMIN-CLAIM-${Date.now()}`;
    console.log('Admin Basic Claim Data:', basicClaimData);
    console.log('Generated Temporary Claim ID:', tempClaimId);

    // TODO: Store basicClaimData temporarily (e.g., in state, context, or localStorage)
    // if it needs to be combined with attachment data later.
    // For now, we just navigate.

    setAdminCreateClaimDialogOpen(false);
    showSnackbar(t('admin_claim_basic_info_saved_success', '基本信息已保存，请继续添加附件材料。'), 'success');
    navigate(`/admin/create-claim/${tempClaimId}/attachments`);
  };

  return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t('claim_list_admin_page_title', '债权申报与审核 (管理员)')}
        </Typography>

        <Paper sx={{ mb: 2, p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <TextField
                label={t('search_claims_label', '搜索债权人/编号/联系人...')}
                variant="outlined"
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                      <InputAdornment position="start">
                        <SvgIcon fontSize="small"><path d={mdiMagnify} /></SvgIcon>
                      </InputAdornment>
                  ),
                }}
                sx={{ flexGrow: 1, minWidth: '250px' }}
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
            {/* // TODO: Access Control - This button's visibility/enabled state should depend on user permissions (e.g., 'admin_create_claim'). */}
            <Button
                variant="contained"
                startIcon={<SvgIcon><path d={mdiPlusCircleOutline} /></SvgIcon>}
                onClick={() => setAdminCreateClaimDialogOpen(true)} // Open the new dialog
            >
              {t('create_claim_button', '创建债权')}
            </Button>
            {/* // TODO: Access Control - This button's visibility/enabled state should depend on user permissions (e.g., 'batch_reject_claims'). */}
            <Button
                variant="outlined"
                color="error"
                startIcon={<SvgIcon><path d={mdiCloseCircleOutline} /></SvgIcon>}
                onClick={handleOpenRejectModal}
                disabled={selected.length === 0}
            >
              {t('batch_reject_button', '批量驳回')}
            </Button>
          </Stack>
        </Paper>

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
              {filteredClaims.length === 0 && (
                  <TableRow><TableCell colSpan={23} align="center"><Typography sx={{p:2}}>{t('no_claims_found', '暂无匹配的债权数据')}</Typography></TableCell></TableRow>
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
                            onChange={(event) => handleClick(event, claim.id)}
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
                        {/* // TODO: Access Control - Access to review details might depend on specific claim assignment or general admin rights. */}
                        <Tooltip title={claim.audit_status === '待审核' ? t('review_claim_tooltip', '审核债权') : t('view_claim_details_tooltip', '查看详情')}>
                          <IconButton
                              component={Link}
                              to={`/admin/claims/${claim.id}/review`}
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
        {/* TODO: Add MUI Pagination component here */}
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
